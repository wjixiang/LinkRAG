import Logger from '../lib/console/logger';
import { DocumentProcessor } from './DocumentProcessor';
import { ChunkProcessor } from './ChunkProcessor';
import { GraphGenerator } from './GraphGenerator';
import { GraphMerger } from './GraphMerger';
import EntityStorage from '../database/EntityStorage';
import ReferenceDocumentStorage from '../database/referenceDocumentStorage';
import { KnowledgeGraphProcessor } from './KnowledgeGraphProcessor';
import { RecordId } from 'surrealdb';
import { surrealDBClient } from '../database/surrealdbClient';
import { default as ChunkStorage } from '../database/chunkStorage';
import { embedding } from '../lib/embedding';
import pLimit from 'p-limit';
import { SemanticChunkingConfig } from '@/lib/chunking/semantic_chunking';


export interface KnowledgeGraphWeaverConfig {
    chunkTableName: string;
    embeddingConcurrencyLimit: number;
    entity_table_name: string;
    relation_table_name: string;
    reference_table_name: string;
    SemanticChunkingConfig: SemanticChunkingConfig;
    // Add other configuration options as needed, e.g., chunking options
}

export default class KnowledgeGraphWeaver {

    private logger: Logger;
    private documentProcessor: DocumentProcessor;
    private chunkProcessor!: ChunkProcessor;
    private graphGenerator!: GraphGenerator;
    private graphMerger!: GraphMerger;
    private entityStorage!: EntityStorage;
    private config: KnowledgeGraphWeaverConfig;
    private referenceDocumentStorage: ReferenceDocumentStorage;
    private knowledgeGraphProcessor!: KnowledgeGraphProcessor;


    constructor(config: KnowledgeGraphWeaverConfig) {
        this.config = config;
        this.logger = new Logger('KnowledgeGraphWeaver');
        this.documentProcessor = new DocumentProcessor();
        this.referenceDocumentStorage = new ReferenceDocumentStorage();
        this.initializeComponents().catch(error => {
            this.logger.error("Failed to initialize components:", error);
        });
    }

    private async initializeComponents() {
        // await surrealDBClient.connect()
        const db = await surrealDBClient.getDb();
        const chunkStorage = new ChunkStorage(
            db,
            this.config.chunkTableName,
            embedding
        );
        this.entityStorage = new EntityStorage(db, this.config.entity_table_name);
        

        this.chunkProcessor = new ChunkProcessor( {
            chunkTableName: this.config.chunkTableName,
            embeddingConcurrencyLimit: this.config.embeddingConcurrencyLimit,
            SemanticChunkingConfig: this.config.SemanticChunkingConfig
        });
        this.graphGenerator = new GraphGenerator(this.entityStorage, chunkStorage, {
            relation_table_name: this.config.relation_table_name,
            reference_table_name: this.config.reference_table_name
        });
        this.graphMerger = new GraphMerger(this.entityStorage, {
            relation_table_name: this.config.relation_table_name,
            reference_table_name: this.config.reference_table_name
        });
        this.knowledgeGraphProcessor = new KnowledgeGraphProcessor(this.config, this.logger);
    }

    async weave(file_path: string) {
        await surrealDBClient.connect()

        const reference_document_id = await this.save_to_reference_document_storage(file_path);
        if(!reference_document_id) throw new Error(`Add new document failed: ${file_path}`);

        await this.chunking_and_embedding(reference_document_id)
        await this.generateKgsForReference(reference_document_id)
        await this.joint_graph(20)
        await this.build_global_EPE_graph(20)

    }

    async generateKgsForReference(referenceId: RecordId,ConcurrencyLimit=50): Promise<void> {
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
                        await this.generate_kg(recordId);
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

    async chunking_and_embedding(id: RecordId) {
        const referenceDocument = await this.referenceDocumentStorage.getReferenceDocument(id);
        if (!referenceDocument) {
            this.logger.error(`Reference document with ID ${id.id} not found.`);
            return;
        }
        
        await this.chunkProcessor.processDocument(id, referenceDocument.plainText);
    }

    async generate_kg(chunkId: RecordId): Promise<void> {
        await this.graphGenerator.generateGraph(chunkId);
    }

    async joint_graph(concurrencyLimit=10) {
        await this.graphMerger.jointGraph(concurrencyLimit);
    }

    async classify_relation(entity_id: RecordId) {
        return this.knowledgeGraphProcessor.classify_relation(entity_id);
    }

    async extract_entity_props(id: RecordId) {
        return this.knowledgeGraphProcessor.extract_entity_props(id);
    }

    async build_global_EPE_graph(concurrencyLimit = 100) {
        return this.knowledgeGraphProcessor.build_global_EPE_graph(concurrencyLimit);
    }
}
