import Logger from '../lib/console/logger';
import { RecordId } from 'surrealdb';
import { surrealDBClient } from '../database/surrealdbClient';
import { embedding } from '../lib/embedding';
import { default as ChunkStorage } from '../database/chunkStorage';
import { PropertySummarizeResult, RelationRecord } from '@/type';
import KnowledgeGraphRetriever from './KnowledgeGraphRetriever';
import { b, Entity, Property, Relation, RelationReference } from 'baml_client';
import pLimit from 'p-limit';
import { KnowledgeGraphWeaverConfig } from './KnowledgeGraphWeaver'; // Assuming config is the same

/**
 * Processes knowledge graph related operations, including relation classification,
 * entity property extraction, and building entity-property-entity graphs.
 */
export class KnowledgeGraphProcessor {
    private logger: Logger;
    private config: KnowledgeGraphWeaverConfig;

    /**
     * Constructs a new KnowledgeGraphProcessor instance.
     * @param config - The configuration for the knowledge graph weaver.
     * @param logger - The logger instance to use for logging.
     */
    constructor(config: KnowledgeGraphWeaverConfig, logger: Logger) {
        this.config = config;
        this.logger = logger;
        this.logger.info('KnowledgeGraphProcessor initialized.');
    }

    /**
     * Classifies relations for a given entity.
     * @param entity_id - The ID of the entity for which to classify relations.
     * @returns A promise that resolves with the classified relation groups, or rejects with an error.
     */
    async classify_relation(entity_id: RecordId) {
        this.logger.info(`Starting relation classification for entity ID: ${entity_id}`);
        try {
            const db = await surrealDBClient.getDb();
            this.logger.debug('Database client obtained.');

            const chunkStorage = new ChunkStorage(
                db,
                this.config.chunkTableName,
                embedding,
                0.2 // cosine_better_than_threshold
            );
            this.logger.debug(`ChunkStorage initialized with table: ${this.config.chunkTableName}`);

            const retriever = new KnowledgeGraphRetriever({
                chunkStorage: chunkStorage,
                chunkTableName: this.config.chunkTableName
            });
            this.logger.debug('KnowledgeGraphRetriever initialized.');

            const relationRecords = await retriever.get_relations_of_entity(entity_id);
            this.logger.info(`Retrieved ${relationRecords.in_relations.length} in_relations and ${relationRecords.out_relations.length} out_relations for entity ${entity_id}`);

            const in_relations = await Promise.all(relationRecords.in_relations.map(e => {
                this.logger.debug(`Processing in_relation record: ${JSON.stringify(e)}`);
                return this.relationRecord_to_relation(e);
            }));
            this.logger.debug(`Processed ${in_relations.length} in_relations.`);

            const out_relations = await Promise.all(relationRecords.out_relations.map(e => { // Corrected from in_relations.map
                this.logger.debug(`Processing out_relation record: ${JSON.stringify(e)}`);
                return this.relationRecord_to_relation(e);
            }));
            this.logger.debug(`Processed ${out_relations.length} out_relations.`);


            const core_entity = await db.select<{
                name: string
                description: string
                type: string
                aliases: string[]
            }>(entity_id);
            if (!core_entity) {
                this.logger.warning(`Core entity with ID ${entity_id} not found during relation classification.`);
                return []; // Return empty array if core entity not found
            }
            this.logger.debug(`Core entity data retrieved: ${JSON.stringify(core_entity)}`);


            const relation_groups = await b.GroupRelations(core_entity, [...in_relations, ...out_relations]);
            this.logger.debug(`Relation groups generated: ${JSON.stringify(relation_groups)}`);
            this.logger.info(`Finished relation classification for entity ID: ${entity_id}`);
            return relation_groups;
        } catch (error) {
            this.logger.error(`Error classifying relations for entity ${entity_id}:`, error);
            throw error; // Re-throw the error after logging
        }
    }

    /**
     * Converts a RelationRecord to a simplified Relation object.
     * @param relationRecord - The RelationRecord to convert.
     * @returns A promise that resolves with the simplified Relation object.
     */
    async relationRecord_to_relation(relationRecord: RelationRecord): Promise<{
        id: RecordId,
        source_entity: string,
        target_entity: string,
        relation: string
    }> {
        this.logger.debug(`Converting RelationRecord to Relation: ${JSON.stringify(relationRecord)}`);
        try {
            const source_entity_name = await this.get_entity_name_by_id(relationRecord.in);
            const target_entity_name = await this.get_entity_name_by_id(relationRecord.out);

            const relation = {
                id: relationRecord.id,
                source_entity: source_entity_name,
                target_entity: target_entity_name,
                relation: relationRecord.relation,
            };
            this.logger.debug(`Converted RelationRecord to Relation: ${JSON.stringify(relation)}`);
            return relation;
        } catch (error) {
            this.logger.error(`Error converting RelationRecord ${relationRecord.id} to Relation:`, error);
            throw error;
        }
    }

    /**
     * Retrieves the name of an entity by its ID.
     * @param id - The ID of the entity.
     * @returns A promise that resolves with the entity name.
     * @throws Error if the entity is not found.
     */
    async get_entity_name_by_id(id: RecordId): Promise<string> {
        this.logger.debug(`Fetching entity name for ID: ${id}`);
        try {
            const db = await surrealDBClient.getDb();
            const entity = await db.query<{ name: string }[][]>(`SELECT name FROM ${this.config.entity_table_name} WHERE id = ${id}`);

            if (!entity || entity.length === 0 || entity[0].length === 0 || !entity[0][0].name) {
                this.logger.warning(`Entity with ID ${id} not found or name is missing.`);
                throw new Error(`Entity with ID ${id} not found or name is missing.`);
            }

            const entityName = entity[0][0].name;
            this.logger.debug(`Entity name for ID ${id}: ${entityName}`);
            return entityName;
        } catch (error) {
            this.logger.error(`Error fetching entity name for ID ${id}:`, error);
            throw error;
        }
    }

    /**
     * Extracts properties for a given entity based on its relations.
     * @param id - The ID of the entity for which to extract properties.
     * @returns A promise that resolves with an array of PropertySummarizeResult or void if no properties are extracted.
     */
    async extract_entity_props(id: RecordId): Promise<PropertySummarizeResult[] | void> {
        this.logger.info(`Starting entity property extraction for entity ID: ${id}`);
        try {
            const db = await surrealDBClient.getDb();
            this.logger.debug('Database client obtained.');

            // Get core entity data
            const core_entity = await db.select<{
                name: string;
                description: string;
                type: string;
                aliases: string[];
            }>(id);

            if (!core_entity) {
                this.logger.error(`Entity ${id} not found for property extraction.`);
                return;
            }
            this.logger.debug(`Core entity data retrieved: ${JSON.stringify(core_entity)}`);

            // Get relation groups
            const relation_groups = await this.classify_relation(id);
            if (!relation_groups || relation_groups.length === 0) {
                this.logger.warning(`No relation groups found for entity ${id} during property extraction.`);
                return;
            }
            this.logger.debug(`Retrieved ${relation_groups.length} relation groups.`);

            // Get all relation records first
            const chunkStorage = new ChunkStorage(
                db,
                this.config.chunkTableName,
                embedding,
                0.2
            );
            const retriever = new KnowledgeGraphRetriever({
                chunkStorage,
                chunkTableName: this.config.chunkTableName
            });
            this.logger.debug('KnowledgeGraphRetriever initialized for property extraction.');

            const relationRecords = await retriever.get_relations_of_entity(id);
            this.logger.debug(`Retrieved relation records for entity ${id}.`);

            // Process all relation records to Relation format
            const all_relations = [
                ...await Promise.all(relationRecords.in_relations.map(e =>
                    this.relationRecord_to_relation(e))
                ),
                ...await Promise.all(relationRecords.out_relations.map(e =>
                    this.relationRecord_to_relation(e))
                )
            ];
            this.logger.debug(`Processed ${all_relations.length} total relations.`);

            const summaries: PropertySummarizeResult[] = [];

            for (const group of relation_groups) {
                this.logger.debug(`Processing relation group: ${group.group_name}`);
                // Get relations for this group using indices
                const group_relations = group.relation_index.map(idx => {
                    if (idx >= 0 && idx < all_relations.length) {
                        return all_relations[idx];
                    } else {
                        this.logger.warning(`Invalid relation index ${idx} in group ${group.group_name} for entity ${id}. Index out of bounds.`);
                        return null;
                    }
                }).filter(relation => relation !== null) as { id: RecordId, source_entity: string, target_entity: string, relation: string }[]; // Cast after filtering nulls

                if (group_relations.length === 0) {
                    this.logger.info(`No valid relations found for group ${group.group_name} of entity ${id}. Skipping group.`);
                    continue; // Skip to next group
                }
                this.logger.debug(`Found ${group_relations.length} valid relations for group ${group.group_name}.`);


                const relationReferences = await Promise.all(group_relations.map(async (e) => {
                    this.logger.debug(`Retrieving relation references for relation ID: ${e.id}`);
                    const documents = await this.retrieve_relation_references(e.id);
                    this.logger.debug(`Retrieved ${documents.length} documents for relation ID: ${e.id}`);
                    return {
                        relation: {
                            source_entity: e.source_entity,
                            target_entity: e.target_entity,
                            relation: e.relation
                        },
                        doucment: documents // Typo 'doucment' should be 'document' - keeping for now to match original
                    };
                }));
                this.logger.debug(`Generated relation references for group ${group.group_name}.`);


                const summary = await b.SummarizeRelations(
                    relationReferences,
                    group.group_name,
                    {
                        name: core_entity.name,
                        description: core_entity.description,
                        type: core_entity.type,
                        aliases: core_entity.aliases || [] // Include aliases, default to empty array if null/undefined
                    },
                    "中文" // Assuming "中文" is the desired language
                );
                this.logger.debug(`Summary generated for group ${group.group_name}: ${summary}`);


                summaries.push({
                    core_entity: core_entity,
                    relation_set: group_relations,
                    property_name: group.group_name,
                    property_content: summary
                });
                this.logger.debug(`Added summary for group ${group.group_name} to results.`);
            }

            this.logger.info(`Finished entity property extraction for entity ID: ${id}. Extracted ${summaries.length} properties.`);
            return summaries;
        } catch (error) {
            this.logger.error(`Failed to extract entity properties for ${id}:`, error);
            throw error;
        }
    }

    /**
     * Retrieves document references for a given relation ID.
     * @param relationId - The ID of the relation.
     * @returns A promise that resolves with an array of document content strings.
     */
    async retrieve_relation_references(relationId: RecordId): Promise<string[]> {
        this.logger.debug(`Retrieving relation references for relation ID: ${relationId}`);
        try {
            const db = await surrealDBClient.getDb();
            const reference_chunks_of_relation = await db.query<{ id: RecordId, in: RecordId, out: RecordId }[][]>(`SELECT * FROM ${this.config.reference_table_name} WHERE in = ${relationId}`);
            this.logger.debug(`Reference chunks query result for relation ${relationId}: ${JSON.stringify(reference_chunks_of_relation[0])}`);

            if (!reference_chunks_of_relation || reference_chunks_of_relation.length === 0 || reference_chunks_of_relation[0].length === 0) {
                this.logger.info(`No reference chunks found for relation ID: ${relationId}.`);
                return [];
            }

            const retrieved_docs = await Promise.all(reference_chunks_of_relation[0].map(async (e) => { // Iterate over the inner array
                if (!e?.out) {
                    this.logger.warning(`Missing 'out' reference in relation ${relationId} for chunk reference: ${JSON.stringify(e)}`);
                    return '';
                }
                try {
                    const doc = await db.query<{ content: string }[][]>(`SELECT content FROM ${this.config.chunkTableName} WHERE id = ${e.out}`); // Use chunkTableName from config
                    return doc[0]?.[0]?.content || '';
                } catch (chunkError) {
                    this.logger.error(`Error retrieving chunk content for ID ${e.out} linked to relation ${relationId}:`, chunkError);
                    return '';
                }
            }));

            const filtered_docs = retrieved_docs.filter(content => content !== '');
            this.logger.debug(`Retrieved and filtered ${filtered_docs.length} documents for relation ID: ${relationId}`);
            return filtered_docs;
        } catch (error) {
            this.logger.error(`Failed to retrieve relation references for ${relationId}:`, error);
            return []; // Return empty array on error
        }
    }

    /**
     * Builds a local Entity-Property-Entity (EPE) graph for a given property.
     * @param property - The property summary result to build the graph from.
     * @returns A promise that resolves when the local graph is built.
     */
    async build_local_EPE_graph(property: PropertySummarizeResult) {
        this.logger.info(`Starting local EPE graph build for property: ${property.property_name} of entity ${property.core_entity.id}`);
        try {
            const db = await surrealDBClient.getDb();
            this.logger.debug('Database client obtained.');

            // save property
            const embedding_vector = await embedding(property.property_content)
            if(!embedding_vector){
                this.logger.error(`Embed property ${property.property_name} error`)
            }

            const property_insert_result = await db.insert("property", {
                core_entity: property.core_entity.id,
                property_name: property.property_name,
                property_content: property.property_content,
                embedding_vector: embedding_vector
            });
            if (!property_insert_result || property_insert_result.length === 0) {
                this.logger.error(`Failed to insert property record for ${property.property_name} of entity ${property.core_entity.id}.`);
                throw new Error(`Failed to insert property record for ${property.property_name}`);
            }
            const propertyId = property_insert_result[0].id;
            this.logger.debug(`Property record inserted with ID: ${propertyId}`);


            // build entity-->property relationship
            const entity_property_build_result = await db.insertRelation("subset", {
                in: property.core_entity.id,
                out: propertyId
            });
            this.logger.debug(`Entity-Property relationship built: ${JSON.stringify(entity_property_build_result)}`);


            // build property-->relation reference relationship
            const property_relation_build_result = await Promise.all(property.relation_set.map(async (e) => {
                try {
                    const result = await db.insertRelation("propertyToRelation", {
                        in: propertyId,
                        out: e.id
                    });
                    this.logger.debug(`Property-Relation reference relationship built for relation ${e.id}: ${JSON.stringify(result)}`);
                    return result;
                } catch (relationError) {
                    this.logger.error(`Error building property-relation relationship for relation ${e.id}:`, relationError);
                    return null; // Continue with other relations
                }
            }));
            this.logger.debug(`Finished building property-relation reference relationships.`);


            // reconnect inlink entities
            // 1. Retrieve relation record
            const relation_records = await Promise.all(property.relation_set.map(async (e) => {
                try {
                    const relation_record = await db.query<{ id: RecordId, in: RecordId, out: RecordId }[][]>(`SELECT id, in, out FROM ${this.config.relation_table_name} WHERE id = ${e.id}`);

                    // Verify relation record existed
                    if (!relation_record || relation_record.length === 0 || relation_record[0].length !== 1) {
                        this.logger.error(`Relation record ${e.id} not found or unexpected result: ${JSON.stringify(relation_record)}`);
                        throw new Error(`Relation ${e.id} not existed or unexpected result`);
                    }

                    return relation_record[0][0];
                } catch (retrieveError) {
                    this.logger.error(`Error retrieving relation record ${e.id}:`, retrieveError);
                    throw retrieveError; // Re-throw to fail the Promise.all
                }
            }));
            this.logger.debug(`Retrieved relation records for reconnecting entities.`);


            // 2. reconnect entity
            await Promise.all(relation_records.map(async (e) => {
                try {
                    let result = null;
                    switch (property.core_entity.id.id) {
                        case e.in.id:
                            result = await db.insertRelation("superset", {
                                in: propertyId,
                                out: e.out,
                            });
                            this.logger.debug(`Superset relationship built for in-link entity ${e.out.id}: ${JSON.stringify(result)}`);
                            break;
                        case e.out.id:
                            result = await db.insertRelation("superset", {
                                in: propertyId,
                                out: e.in,
                            });
                            this.logger.debug(`Superset relationship built for out-link entity ${e.in.id}: ${JSON.stringify(result)}`);
                            break;
                        default:
                            this.logger.warning(`None target entity identified in relationship for property ${propertyId}:`, e, property.core_entity);
                            break;
                    }
                    return result;
                } catch (reconnectError) {
                    this.logger.error(`Error reconnecting entity for relation ${e.id}:`, reconnectError);
                    return null; // Continue with other entities
                }
            }));
            this.logger.info(`Finished local EPE graph build for property: ${property.property_name} of entity ${property.core_entity.id}`);

        } catch (error) {
            this.logger.error(`Failed to build local EPE graph for property ${property?.property_name} of entity ${property?.core_entity?.id}:`, error);
            throw error;
        }
    }

    /**
     * Builds the global Entity-Property-Entity (EPE) graph by processing all entities.
     * @param concurrencyLimit - The maximum number of concurrent entity processing tasks.
     * @returns A promise that resolves when the global graph is built.
     */
    async build_global_EPE_graph(concurrencyLimit = 100) {
        this.logger.info(`Starting global EPE graph build with concurrency limit: ${concurrencyLimit}`);
        try {
            const db = await surrealDBClient.getDb();
            this.logger.debug('Database client obtained.');

            // Query all entities from the nodes table
            const entities_result = await db.query<{ id: RecordId }[][]>(
                `SELECT id FROM ${this.config.entity_table_name}`
            );

            if (!entities_result || entities_result.length === 0 || entities_result[0].length === 0) {
                this.logger.warning(`No entities found in the database table: ${this.config.entity_table_name}. Skipping global graph build.`);
                return;
            }

            const entities = entities_result[0];
            this.logger.info(`Found ${entities.length} entities to process.`);

            // Create p-limit instance
            const limit = pLimit(concurrencyLimit);
            this.logger.debug(`p-limit initialized with concurrency limit: ${concurrencyLimit}`);

            // Process entities concurrently
            const processingTasks = entities.map(row =>
                limit(async () => {
                    const entity = row;
                    this.logger.debug(`Processing entity ${entity.id}`);
                    try {
                        // Step 1: Extract entity properties
                        const properties = await this.extract_entity_props(entity.id);
                        if (!properties || properties.length === 0) {
                            this.logger.debug(`No properties extracted for entity ${entity.id}. Skipping local graph build.`);
                            return;
                        }
                        this.logger.debug(`Extracted ${properties.length} properties for entity ${entity.id}.`);

                        // Step 2: Build local EPE graph for each property
                        await Promise.all(
                            properties.map(property => {
                                this.logger.debug(`Building local EPE graph for property ${property.property_name} of entity ${entity.id}`);
                                return this.build_local_EPE_graph(property);
                            })
                        );

                        this.logger.debug(`Finished processing entity ${entity.id}`);
                    } catch (error) {
                        this.logger.error(`Error processing entity ${entity.id}:`, error);
                        // Continue with next entity even if one fails
                    }
                })
            );

            await Promise.all(processingTasks);

            this.logger.info('Finished building global EPE graph.');
        } catch (error) {
            this.logger.error('Failed to build global EPE graph:', error);
            throw error;
        }
    }
}