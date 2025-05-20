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
import { gte_Qwen2_7B_instruct_Embedding } from '../lib/embedding';


export interface KnowledgeGraphWeaverConfig {
    chunkTableName: string;
    embeddingConcurrencyLimit: number;
    entity_table_name: string;
    relation_table_name: string;
    reference_table_name: string;
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
            relation_table_name: this.config.relation_table_name,
            reference_table_name: this.config.reference_table_name
        });
        this.graphMerger = new GraphMerger(this.entityStorage, {
            relation_table_name: this.config.relation_table_name,
            reference_table_name: this.config.reference_table_name
        });
        this.knowledgeGraphProcessor = new KnowledgeGraphProcessor(this.config, this.logger);
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
