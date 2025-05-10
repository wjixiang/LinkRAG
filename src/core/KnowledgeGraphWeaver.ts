import { ReferenceDocument, default as ReferenceDocumentStorage } from '../database/referenceDocumentStorage';
import { ChunkDocument, default as ChunkStorage } from '../database/chunkStorage';
import { surrealDBClient } from '../database/surrrealdbClient';
import { semantic_chunking } from '../lib/chunking/semantic_chunking';
import { gte_Qwen2_7B_instruct_Embedding } from '../lib/embedding';
import Logger from '../lib/console/logger';
import { RecordId } from 'surrealdb';
import pLimit from 'p-limit';

export interface KnowledgeGraphWeaverConfig {
    chunkTableName: string;
    embeddingConcurrencyLimit: number;
    // Add other configuration options as needed, e.g., chunking options
}

export default class KnowledgeGraphWeaver {

    private logger: Logger;
    private referenceDocumentStorage: ReferenceDocumentStorage;
    private chunkStorage: ChunkStorage;
    private config: KnowledgeGraphWeaverConfig;

    constructor(config: KnowledgeGraphWeaverConfig) {
        this.config = config;
        this.logger = new Logger('KnowledgeGraphWeaver');
        this.referenceDocumentStorage = new ReferenceDocumentStorage();
        this.chunkStorage = new ChunkStorage(
            surrealDBClient.getDb(),
            this.config.chunkTableName,
            gte_Qwen2_7B_instruct_Embedding // Use the specified embedding function
        );
    }

    /**
     * Saves the generated knowledge graph to the reference document storage.
     * @returns {string|null} - Returns the ReferenceDocument's ID if the knowledge graph is saved successfully, otherwise null.
     */
    async save_to_reference_document_storage(file_path: string): Promise<RecordId|null> {
        try {

            const content = await require('fs').promises.readFile(file_path, 'utf-8');
            const plainText = content; // For now, plain text is the same as content

            // Simple hash calculation (can be replaced with a more robust method if needed)
            const simpleHash = (str: string): string => {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    const char = str.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash; // Convert to 32bit integer
                }
                return hash.toString();
            };

            // Create a ReferenceDocument object (without id, which is handled by storage)
            const referenceDocument: ReferenceDocument = {
                type: 'markdown', // Or another appropriate type
                content: content,
                plainText: plainText,
                hash: simpleHash(content + plainText), // Calculate and add hash
                metadata: {
                    // Add any relevant metadata here
                    generatedAt: new Date().toISOString(),
                },
            };

            // Use ReferenceDocumentStorage to save the document
            const savedDocument = await this.referenceDocumentStorage.addReferenceDocument(referenceDocument);

            this.logger.info("Knowledge graph saved to reference document storage with ID:", savedDocument.id);
            return savedDocument.id || null;

        } catch (error) {
            this.logger.error("Failed to save knowledge graph to reference document storage:", error);
            return null;
        }
    }

    async chunking_and_embedding(id: RecordId) {
        this.logger.debug(`Starting chunking_and_embedding for ID: ${id}`);
        try {
            // 1. 从ReferenceDocument，根据传入的RecordId获取对应记录
            this.logger.debug(`Attempting to get reference document with ID: ${id}`);
            const referenceDocument = await this.referenceDocumentStorage.getReferenceDocument(id);
            this.logger.debug(`Finished getting reference document. Found: ${!!referenceDocument}`);

            if (!referenceDocument) {
                this.logger.error(`Reference document with ID ${id.id} not found.`);
                this.logger.debug(`Exiting chunking_and_embedding due to document not found.`);
                return;
            }

            // 2. 使用'src/lib/chunking/semantic_chunking.ts' 方法对ReferenceDocument进行切片
            this.logger.debug(`Starting semantic chunking for document ID: ${id.id}`);
            const chunks = await semantic_chunking(referenceDocument.plainText);
            this.logger.info(`Chunked document into ${chunks.length} chunks.`);
            this.logger.debug(`Semantic chunking finished. Generated ${chunks.length} chunks.`);

            // 3. 使用'src/lib/embedding.ts' 的 `gte_Qwen2_7B_instruct_Embedding`对chunks进行批量同步嵌入；使用p-limit限制并发；最终数据组装成`ChunkDocument`类型数据
            this.logger.debug(`Starting embedding process with concurrency limit: ${this.config.embeddingConcurrencyLimit}`);
            const limit = pLimit(this.config.embeddingConcurrencyLimit);
            const chunkDocuments: Omit<ChunkDocument, 'id'>[] = [];
            this.logger.debug(`Created p-limit instance and initialized chunkDocuments array.`);

            const embeddingPromises = chunks.map(async (chunkContent) => {
                return limit(async () => {
                    const embedding = await gte_Qwen2_7B_instruct_Embedding(chunkContent);
                    if (embedding) {
                        chunkDocuments.push({
                            referenceIds: [id.id], // Link chunk to the reference document
                            embedding: embedding,
                            content: chunkContent,
                            metadata: {
                                referenceDocumentId: id.id,
                                // Add other relevant metadata
                            },
                        });
                    } else {
                        this.logger.warning(`Failed to generate embedding for a chunk.`);
                    }
                });
            });

            this.logger.debug(`Mapping chunks to embedding promises.`);
            await Promise.all(embeddingPromises);
            this.logger.debug(`All embedding promises resolved.`);

            this.logger.info(`Generated ${chunkDocuments.length} chunk documents with embeddings.`);

            // 4. 使用'src/database/chunkStorage.ts' 保存嵌入后的结果
            // The upsert method in ChunkStorage expects a Record<string, Omit<ChunkDocument, 'id'>>
            this.logger.debug(`Preparing chunk documents for upsert. Total chunks: ${chunkDocuments.length}`);
            // The upsert method in ChunkStorage expects a Record<string, Omit<ChunkDocument, 'id'>>
            // We need to generate unique IDs for each chunk document before upserting
            const chunkDocumentsWithIds: Record<string, Omit<ChunkDocument, 'id'>> = {};
            chunkDocuments.forEach((chunk, index) => {
                this.logger.debug(`Generating ID for chunk index ${index}`);
                 // Generate a simple unique ID for the chunk, e.g., using reference ID and index
                const chunkId = `${id.id}_chunk_${index}`;
                chunkDocumentsWithIds[chunkId] = chunk;
            });


            this.logger.debug(`Calling chunkStorage.upsert with ${Object.keys(chunkDocumentsWithIds).length} documents.`);
            await this.chunkStorage.upsert(chunkDocumentsWithIds);
            this.logger.info(`Saved ${chunkDocuments.length} chunk documents to storage.`);
            this.logger.debug(`chunkStorage.upsert call completed.`);
            this.logger.debug(`Finished chunking_and_embedding for ID: ${id}`);

        } catch (error) {
            this.logger.error("Error during chunking and embedding:", error);
            this.logger.debug(`Caught error during chunking_and_embedding: ${error}`);
        }
    }
}
