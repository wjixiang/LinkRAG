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
import { embeddingInstance, EntityRecord, PropertySummarizeResult, RelationRecord } from '@/type';
import KnowledgeGraphRetriever from './KnowledgeGraphRetriever';
import { b, Entity, Property, Relation, RelationReference } from 'baml_client';
import pLimit from 'p-limit';


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

    async extract_entity_props(id: RecordId): Promise<PropertySummarizeResult[] | void> {
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

            const summaries: PropertySummarizeResult[] = [];
            
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
                
                summaries.push({
                    core_entity: core_entity,
                    relation_set: group_relations,
                    property_name: group.group_name,
                    property_content: summary
                });
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

    /**
     * Build entity-property-entity graph
     */
    async build_local_EPE_graph(property: PropertySummarizeResult) {
        const db = await surrealDBClient.getDb()

        // save property
        const property_insert_result = await db.insert("property", {
            core_entity: property.core_entity.id,
            property_name: property.property_name,
            property_content: property.property_content
        })

        // build entity-->property relationship
        const entity_property_build_result = await db.insertRelation("subset",{
            in: property.core_entity.id,
            out: property_insert_result[0].id
        })

        // build property-->relation reference relationship
        const property_relation_build_result = await Promise.all(property.relation_set.map(async(e) => {
            return  await db.insertRelation("propertyToRelation", {
                in: property_insert_result[0].id,
                out: e.id
            })
        }))

        // reconnet inlink entities
        // 1. Retrieve relation record
        const relation_records = await Promise.all(property.relation_set.map(async(e) => {
            const relation_record = await db.query<{id: RecordId, in: RecordId, out: RecordId}[][]>(`SELECT id, in, out FROM ${this.config.relation_table_name} WHERE id = ${e.id}`)
            
            // Verify relation record existed
            if(relation_record[0].length!==1) {
                this.logger.error(JSON.stringify(relation_record[0]))
                throw new Error(`relation ${e.id} not exised`);
            }

            return relation_record[0][0]         
        }))

        // 2. reconnect entity
        await Promise.all(relation_records.map(async(e) => {
            switch (property.core_entity.id.id) {
                case e.in.id:
                    return db.insertRelation("superset",{
                        in: e.out,
                        out: property_insert_result[0].id,
                    })
                case e.out.id:
                    return db.insertRelation("superset",{
                        in: e.in,
                        out: property_insert_result[0].id,
                    })
                default:
                    this.logger.warning("None target entity identified in relationship:", e,property.core_entity)
                    break;
            }
        }))

    }

    async build_global_EPE_graph(concurrencyLimit = 100) {
        try {
            const db = await surrealDBClient.getDb();
            
            // Query all entities from the nodes table
            const entities = await db.query<{id: RecordId}[][]>(
                `SELECT id FROM ${this.config.entity_table_name}`
            );
            
            if (!entities || entities[0].length === 0) {
                this.logger.warning('No entities found in the database');
                return;
            }

            this.logger.info(`Found ${entities[0].length} entities to process with concurrency limit ${concurrencyLimit}`);

            // Create p-limit instance
            const limit = pLimit(concurrencyLimit);

            // Process entities concurrently
            const processingTasks = entities[0].map(row =>
                limit(async () => {
                    const entity = row;
                    try {
                        this.logger.debug(`Processing entity ${entity.id}`);
                        
                        // Step 1: Extract entity properties
                        const properties = await this.extract_entity_props(entity.id);
                        if (!properties || properties.length === 0) {
                            this.logger.debug(`No properties extracted for entity ${entity.id}`);
                            return;
                        }

                        // Step 2: Build local EPE graph for each property
                        await Promise.all(
                            properties.map(property =>
                                this.build_local_EPE_graph(property)
                            )
                        );

                        this.logger.debug(`Finished processing entity ${entity.id}`);
                    } catch (error) {
                        this.logger.error(`Error processing entity ${entity.id}:`, error);
                        // Continue with next entity even if one fails
                    }
                })
            );

            await Promise.all(processingTasks);

            this.logger.info('Finished building global EPE graph');
        } catch (error) {
            this.logger.error('Failed to build global EPE graph:', error);
            throw error;
        }
    }
}
