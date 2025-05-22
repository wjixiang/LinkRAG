import { ChunkDocument, default as ChunkStorage } from '../database/chunkStorage';
import { surrealDBClient } from '../database/surrealdbClient';
import { semantic_chunking } from '../lib/chunking/semantic_chunking';
import { embedding } from '../lib/embedding';
import Logger from '../lib/console/logger';
import { RecordId } from 'surrealdb';
import pLimit from 'p-limit';
import ReferenceDocumentStorage from '../database/referenceDocumentStorage';
import { ChunkitOptions } from 'semantic-chunking';


export interface ChunkProcessorConfig {
    chunkTableName: string;
    embeddingConcurrencyLimit: number;
    ChunkitOptions: ChunkitOptions;
}

export class ChunkProcessor {
    private logger: Logger;
    private chunkStorage!: ChunkStorage;
    private config: ChunkProcessorConfig;


    constructor(config: ChunkProcessorConfig) {
        this.config = config;
        this.logger = new Logger('ChunkProcessor');
        this.initializeStorage().catch(error => {
            this.logger.error("Failed to initialize storage:", error);
        });
    }

    private async initializeStorage() {
        const db = await surrealDBClient.getDb();
        this.chunkStorage = new ChunkStorage(
            db,
            this.config.chunkTableName,
            embedding
        );
    }

    async processDocument(id: RecordId, plainText: string): Promise<void> {
        this.logger.debug(`Starting chunking_and_embedding for ID: ${id}`);
        try {
            this.logger.debug(`Starting semantic chunking for document ID: ${id.id}`);
            const chunks = await semantic_chunking(plainText,this.config.ChunkitOptions);
            this.logger.info(`Chunked document into ${chunks.length} chunks.`);
            this.logger.debug(`Semantic chunking finished. Generated ${chunks.length} chunks.`);

            // Combine adjacent chunks
            const combinedChunks: string[] = [];
            for (let i = 0; i < chunks.length - 1; i++) {
                combinedChunks.push(chunks[i] + ' ' + chunks[i + 1]);
            }
            this.logger.info(`Combined adjacent chunks, resulting in ${combinedChunks.length} new chunks.`);

            const allChunks = [ ...combinedChunks];
            this.logger.info(`Total chunks for embedding: ${allChunks.length}`);

            this.logger.debug(`Starting embedding process with concurrency limit: ${this.config.embeddingConcurrencyLimit}`);
            const limit = pLimit(this.config.embeddingConcurrencyLimit);
            const chunkDocuments: Omit<ChunkDocument, 'id'>[] = [];
            this.logger.debug(`Created p-limit instance and initialized chunkDocuments array.`);

            const embeddingPromises = allChunks.map(async (chunkContent, index) => {
                return limit(async () => {
                    const Embedding = await embedding(chunkContent);
                    if (Embedding) {
                        chunkDocuments.push({
                            referenceIds: [id], // Link chunk to the reference document
                            embedding: Embedding,
                            content: chunkContent,
                        });
                    } else {
                        this.logger.warning(`Failed to generate embedding for chunk index ${index}.`);
                    }
                });
            });

            this.logger.debug(`Mapping chunks to embedding promises.`);
            await Promise.all(embeddingPromises);
            this.logger.debug(`All embedding promises resolved.`);

            this.logger.info(`Generated ${chunkDocuments.length} chunk documents with embeddings.`);

            this.logger.debug(`Preparing chunk documents for upsert. Total chunks: ${chunkDocuments.length}`);
            const chunkDocumentsWithIds: Record<string, Omit<ChunkDocument, 'id'>> = {};
            chunkDocuments.forEach((chunk, index) => {
                this.logger.debug(`Generating ID for chunk index ${index}`);
                // Generate a unique ID for each chunk, distinguishing original and combined chunks
                const chunkId = `${id.id}_chunk_${index}`;
                chunkDocumentsWithIds[chunkId] = chunk;
            });

            this.logger.debug(`Calling chunkStorage.upsert with ${Object.keys(chunkDocumentsWithIds).length} documents.`);
            await this.chunkStorage.upsert(chunkDocumentsWithIds);
            this.logger.info(`Saved ${chunkDocuments.length} chunk documents to storage.`);
            this.logger.debug(`Finished chunking_and_embedding for ID: ${id}`);

        } catch (error) {
            this.logger.error("Error during chunking and embedding:", error);
            throw error;
        }
    }

    async getChunkById(id: RecordId): Promise<Omit<ChunkDocument, "embedding"> | null> {
        return this.chunkStorage.get_by_id(id);
    }
}