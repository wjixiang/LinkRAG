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
import { b, Entity, Relation, RelationReference } from 'baml_client';


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
        this.logger.debug(JSON.stringify(relation_groups))
        return relation_groups
    }

    async relationRecord_to_relation(relationRecord:RelationRecord): Promise<{
        id: RecordId,
        source_entity: string,
        target_entity: string,
        relation: string
    }> {
        return {
            id: relationRecord.id,
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

    async extract_entity_props(id: RecordId): Promise<string[] | void> {
        try {
            const db = await surrealDBClient.getDb();
            
            // Get core entity data
            const core_entity = await db.select<{
                name: string;
                description: string;
                type: string;
            }>(id);
            
            if (!core_entity) {
                this.logger.error(`Entity ${id} not found`);
                return;
            }

            // Get relation groups
            const relation_groups = await this.classify_relation(id);
            if (!relation_groups || relation_groups.length === 0) {
                this.logger.warning(`No relation groups found for entity ${id}`);
                return;
            }

            // Get all relation records first
            const chunkStorage = new ChunkStorage(
                db,
                this.config.chunkTableName,
                gte_Qwen2_7B_instruct_Embedding,
                0.2
            );
            const retriever = new KnowledgeGraphRetriever({
                chunkStorage,
                chunkTableName: this.config.chunkTableName
            });
            const relationRecords = await retriever.get_relations_of_entity(id);
            
            // Process all relation records to Relation format
            const all_relations = [
                ...await Promise.all(relationRecords.in_relations.map(e =>
                    this.relationRecord_to_relation(e))
                ),
                ...await Promise.all(relationRecords.out_relations.map(e =>
                    this.relationRecord_to_relation(e))
                )
            ];

            const summaries: string[] = [];
            
            for (const group of relation_groups) {
                // Get relations for this group using indices
                const group_relations = group.relation_index.map(idx => {
                    if (idx >= 0 && idx < all_relations.length) {
                        return all_relations[idx];
                    } else {
                        this.logger.warning(`Invalid relation index ${idx} in group ${group.group_name} for entity ${id}`);
                        return null; // Or handle error appropriately
                    }
                }).filter(relation => relation !== null) 

                if (group_relations.length === 0) {
                    this.logger.info(`No valid relations found for group ${group.group_name} of entity ${id}`);
                    continue; // Skip to next group
                }

                const relationReferences = await Promise.all(group_relations.map(async(e)=>{
                    return {
                        relation: {
                            source_entity: e.source_entity,
                            target_entity: e.target_entity,
                            relation: e.relation
                        },
                        doucment: await this.retrieve_relation_references(e.id)
                    }
                }));

                const summary = await b.SummarizeRelations(
                    relationReferences,
                    group.group_name,
                    {
                        name: core_entity.name,
                        description: core_entity.description,
                        type: core_entity.type
                    },
                    "中文"
                );
                
                summaries.push(summary);
                this.logger.debug(`Summary for ${group.group_name}: ${summary}`);
            }

            return summaries;
        } catch (error) {
            this.logger.error(`Failed to extract entity properties for ${id}:`, error);
            throw error;
        }
    }

    async retrieve_relation_references(relationId: RecordId): Promise<string[]> {
        try {
            const db = await surrealDBClient.getDb()
            const reference_chunks_of_relation = await db.query<{id: RecordId, in: RecordId, out: RecordId}[][]>(`SELECT * FROM reference WHERE in = ${relationId}`)
            this.logger.debug(`reference chunks of relation: ${JSON.stringify(reference_chunks_of_relation[0])}`)

            if (!reference_chunks_of_relation || reference_chunks_of_relation.length === 0) {
                return []
            }

            const retrieved_docs = await Promise.all(reference_chunks_of_relation.map(async(e) => {
                if (!e[0]?.out) {
                    this.logger.warning(`Missing 'out' reference in relation ${relationId}`)
                    return ''
                }
                const doc = await db.query<{content: string}[][]>(`SELECT content FROM chunks_test WHERE id = ${e[0].out}`)
                return doc[0][0]?.content || ''
            }))

            return retrieved_docs.filter(content => content !== '')
        } catch (error) {
            this.logger.error(`Failed to retrieve relation references for ${relationId}:`, error)
            return []
        }
    }

    async save_entity_property() {
        const db = await surrealDBClient.getDb()
    }
}
