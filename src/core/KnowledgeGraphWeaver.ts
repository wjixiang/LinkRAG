import Logger from '../lib/console/logger';
import { RecordId } from 'surrealdb';
import { DocumentProcessor } from './DocumentProcessor';
import { ChunkProcessor } from './ChunkProcessor';
import { GraphGenerator } from './GraphGenerator';
import { GraphMerger } from './GraphMerger';
import EntityStorage from '../database/EntityStorage';
import { surrealDBClient } from '../database/surrealdbClient';
import { gte_Qwen2_7B_instruct_Embedding } from '../lib/embedding';
import { default as ChunkStorage } from '../database/chunkStorage';
import { Entity } from 'baml_client';
import ReferenceDocumentStorage from '../database/referenceDocumentStorage';


export interface KnowledgeGraphWeaverConfig {
    chunkTableName: string;
    embeddingConcurrencyLimit: number;
    relation_table_name: string;
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
        const db = await surrealDBClient.getDb();
        const chunkStorage = new ChunkStorage(
            db,
            this.config.chunkTableName,
            gte_Qwen2_7B_instruct_Embedding
        );
        this.entityStorage = new EntityStorage(db);

        this.chunkProcessor = new ChunkProcessor(this.referenceDocumentStorage, {
            chunkTableName: this.config.chunkTableName,
            embeddingConcurrencyLimit: this.config.embeddingConcurrencyLimit
        });
        this.graphGenerator = new GraphGenerator(this.entityStorage, chunkStorage, {
            relation_table_name: this.config.relation_table_name
        });
        this.graphMerger = new GraphMerger(this.entityStorage, {
            relation_table_name: this.config.relation_table_name
        });
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

    async joint_graph() {
        await this.graphMerger.jointGraph();
    }
}

interface EntityRecord extends Entity {
    id: RecordId
}
