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
import ReferenceDocumentStorage from '../database/referenceDocumentStorage';
import { embeddingInstance, RelationRecord } from '@/type';
import KnowledgeGraphRetriever from './KnowledgeGraphRetriever';
import { b, Entity, Relation } from 'baml_client';


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
        const db = await surrealDBClient.getDb()
        const chunkStorage = new ChunkStorage(
            db,
            this.config.chunkTableName,
            gte_Qwen2_7B_instruct_Embedding,
            0.2 // cosine_better_than_threshold
        );

        const retriever = new KnowledgeGraphRetriever({
            chunkStorage: chunkStorage,
            chunkTableName: this.config.chunkTableName
        })

        const relationRecords = await retriever.get_relations_of_entity(entity_id)
        this.logger.info(`Retrieve ${relationRecords.in_relations.length} in_relations and ${relationRecords.out_relations.length} out_relations of entity ${entity_id}`)
        
        const in_relations = await Promise.all(relationRecords.in_relations.map(e=>{
            return this.relationRecord_to_relation(e)
        }))

        const out_relations = await Promise.all(relationRecords.in_relations.map(e=>{
            return this.relationRecord_to_relation(e)
        }))

        const core_entity = await db.select<{
            name: string
            description: string
            type: string
        }>(entity_id)

        const relation_groups = await b.GroupRelations(core_entity,[...in_relations, ...out_relations])
        console.log(relation_groups)


    }

    async relationRecord_to_relation(relationRecord:RelationRecord): Promise<Relation> {
        return {
            source_entity: await this.get_entity_name_by_id(relationRecord.in),
            target_entity: await this.get_entity_name_by_id(relationRecord.out),
            relation: relationRecord.relation,
        };
    }

    async get_entity_name_by_id(id: RecordId): Promise<string> {
        const db = await surrealDBClient.getDb()
        const entity = await db.query<{name:string}[][]>(`SELECT name FROM ${this.config.entity_table_name} WHERE id = ${id}`)
        return entity[0][0].name
    }

    async extract_props(entity_id: RecordId) {

    }
}
