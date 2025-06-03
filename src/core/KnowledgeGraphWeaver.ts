import winston from 'winston';
import createLoggerWithPrefix from '../lib/console/logger';
import { DocumentProcessor } from './DocumentProcessor';
import { ChunkProcessor } from './ChunkProcessor';
import { GraphGenerator } from './GraphGenerator';
import { GraphMerger } from './GraphMerger';
import EntityStorage from '../database/EntityStorage';
import SourceManager from './SourceManager';
import { KnowledgeGraphProcessor } from './KnowledgeGraphProcessor';
import { RecordId } from 'surrealdb';
import { surrealDBClient } from '../database/surrealdbClient';
import { default as ChunkStorage } from '../database/chunkStorage';
import { embedding } from '../lib/embedding';
import pLimit from 'p-limit';
import { SemanticChunkingConfig, semantic_chunking } from '@/lib/chunking/semantic_chunking'; // Import semantic_chunking
import { createAlibabaBatchEmbeddingJob } from '@/lib/embedding/AlibabaBatchEmbedder'; // Import batch embedder
import PropertyStorage from './PropertyStorage';
import { EntityExtractor } from './EntityExtractor';


export interface KnowledgeGraphWeaverConfig {
    chunkTableName: string;
    embeddingConcurrencyLimit: number;
    entity_table_name: string;
    relation_table_name: string;
    reference_table_name: string;
    SemanticChunkingConfig: SemanticChunkingConfig;
    property_table_name: string; // Add property_table_name
    semantic_search_threshold: number; // Add semantic_search_threshold
    // Add other configuration options as needed, e.g., chunking options
}

export default class KnowledgeGraphWeaver {

    private logger: winston.Logger;
    documentProcessor: DocumentProcessor = new DocumentProcessor();
    chunkProcessor!: ChunkProcessor ;
    graphGenerator!: GraphGenerator;
    graphMerger!: GraphMerger;
    chunkStorage: ChunkStorage;
    entityStorage!: EntityStorage;
    propertyStorage: PropertyStorage;
    config: KnowledgeGraphWeaverConfig;
    sourceManager: SourceManager;
    knowledgeGraphProcessor!: KnowledgeGraphProcessor;
    entity_extractor: EntityExtractor


    constructor(config: KnowledgeGraphWeaverConfig) {
        this.config = config;
        this.logger = createLoggerWithPrefix('KnowledgeGraphWeaver');
        this.documentProcessor = new DocumentProcessor();
        this.sourceManager = new SourceManager();
        this.entityStorage = new EntityStorage(this.config.entity_table_name, this.config.reference_table_name);
        this.propertyStorage = new PropertyStorage(this.config.property_table_name)
        this.chunkStorage = new ChunkStorage(
            this.config.chunkTableName,
            embedding
        );
        this.graphGenerator = new GraphGenerator(this.entityStorage, this.chunkStorage, {
            relation_table_name: this.config.relation_table_name,
            reference_table_name: this.config.reference_table_name
        });

        this.chunkProcessor = new ChunkProcessor( {
            chunkTableName: this.config.chunkTableName,
            embeddingConcurrencyLimit: this.config.embeddingConcurrencyLimit,
            SemanticChunkingConfig: this.config.SemanticChunkingConfig
        });
        this.graphMerger = new GraphMerger(this.entityStorage, {
            relation_table_name: this.config.relation_table_name,
            reference_table_name: this.config.reference_table_name
        });
        this.knowledgeGraphProcessor = new KnowledgeGraphProcessor(this.config, this.logger);
        this.entity_extractor = new EntityExtractor(this.chunkStorage)
    }

    async weave(file_path: string) {
        await surrealDBClient.connect()

        const reference_document_id = await this.save_to_reference_document_storage(file_path);
        if(!reference_document_id) throw new Error(`Add new document failed: ${file_path}`);

        await this.chunking_and_embedding(reference_document_id)
        await this.generateKgsForReference(reference_document_id)
        await this.graphMerger.jointGraph(20)
        await this.build_global_EPE_graph(20)

    }

    async generateKgsForReference(referenceId: RecordId, ConcurrencyLimit=50): Promise<void> {
        try {
            
            const db = await surrealDBClient.getDb();
            const result = await db.query<{id: RecordId}[][]>(
                `SELECT id FROM ${this.config.chunkTableName} WHERE referenceIds CONTAINS ${referenceId}`
            );
            
            if (!result || result.length === 0) {
                this.logger.info('No matching chunks found');
                return;
            }

            const recordIds = result[0].map(r => r.id);
            this.logger.info(`Found ${recordIds.length} chunks to process`);

            const limit = pLimit(ConcurrencyLimit);
            await Promise.all(recordIds.map(recordId =>
                limit(async () => {
                    try {
                        this.logger.info(`Starting knowledge graph generation for chunk ID: ${recordId}`);
                        await this.graphGenerator.generateGraph(recordId);
                        this.logger.info(`Knowledge graph generation completed for chunk ID: ${recordId}`);
                    } catch (error) {
                        this.logger.error(`Error processing chunk ${recordId}:`, error);
                    }
                })
            ));
        } catch (error) {
            this.logger.error('Error during knowledge graph generation:', error);
            throw error;
        } finally {
            await surrealDBClient.close();
        }
    }


    async save_to_reference_document_storage(file_path: string): Promise<RecordId | null> {
        return this.documentProcessor.saveToReferenceDocumentStorage(file_path);
    }

    async chunking_and_embedding_from_path(file_path: string): Promise<void> {
        this.logger.debug(`Starting chunking_and_embedding from file path: ${file_path}`);
        try {
            // First read the file content
            const content = await require('fs').promises.readFile(file_path, 'utf-8');
            
            // Add source with metadata first to get a proper RecordId
            const metadata = await this.sourceManager.addSource(content, {
                name: file_path.split('/').pop() || file_path,
                type: file_path.endsWith('.pdf') ? 'pdf' :
                      file_path.endsWith('.md') ? 'markdown' : 'txt',
                origin: file_path,
                description: 'Temporary source for chunking and embedding'
            });

            if (!metadata?.id) {
                throw new Error('Failed to create source metadata');
            }

            // Get content through source manager using the metadata ID
            const storedContent = await this.sourceManager.getSourceContent(metadata.id);
            if (!storedContent) {
                throw new Error(`Failed to get content for file ${file_path}`);
            }

            // Process the document chunks using the metadata ID
            await this.chunkProcessor.processDocument(metadata.id, storedContent);
            this.logger.debug(`Finished chunking_and_embedding from file path: ${file_path}`);
        } catch (error) {
            this.logger.error(`Error during chunking and embedding from file path ${file_path}:`, error);
            throw error;
        }
    }
    async chunking_and_embedding(id: RecordId) {
        const content = await this.sourceManager.getSourceContent(id);
        if (!content) {
            this.logger.error(`Source content with ID ${id.id} not found.`);
            return;
        }
        
        await this.chunkProcessor.processDocument(id, content);
    }

    async chunking_and_embedding_batch(id: RecordId): Promise<string | null> {
        this.logger.debug(`Starting batch chunking and embedding for ID: ${id}`);
        try {
            const content = await this.sourceManager.getSourceContent(id);
            if (!content) {
                this.logger.error(`Source content with ID ${id.id} not found for batch processing.`);
                return null;
            }

            // Perform chunking
            const chunks = await semantic_chunking(content, this.config.SemanticChunkingConfig);
            this.logger.info(`Chunked document into ${chunks.length} chunks for batch embedding.`);

            // Combine adjacent chunks (optional, based on original logic)
            const combinedChunks: string[] = [];
            for (let i = 0; i < chunks.length - 1; i++) {
                combinedChunks.push(chunks[i] + ' ' + chunks[i + 1]);
            }
            const allChunks = [...chunks, ...combinedChunks]; // Include original chunks and combined
            this.logger.info(`Total chunks for batch embedding: ${allChunks.length}`);


            if (allChunks.length === 0) {
                this.logger.warn(`No chunks generated for batch embedding for ID: ${id}`);
                return null;
            }

            // Initiate the asynchronous batch embedding job
            const batchJobId = await createAlibabaBatchEmbeddingJob(allChunks);
            this.logger.info(`Alibaba batch embedding job initiated for ID ${id}. Job ID: ${batchJobId}`);

            // Note: The results of this batch job will need to be retrieved and processed separately
            // based on the batchJobId. This function only initiates the job.

            return batchJobId;

        } catch (error) {
            this.logger.error(`Error during batch chunking and embedding for ID ${id}:`, error);
            throw error;
        }
    }

    async build_global_EPE_graph(concurrencyLimit = 100) {
        return this.knowledgeGraphProcessor.build_global_EPE_graph(concurrencyLimit);
    }
}
