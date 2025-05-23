import { RecordId } from 'surrealdb';
import { Entity, Relation, RelationExtractResult, b } from 'baml_client';
import EntityStorage from '../database/EntityStorage';
import { surrealDBClient } from '../database/surrealdbClient';
import winston from 'winston';
import createLoggerWithPrefix from '../lib/console/logger';
import { EntityExtractor } from './EntityExtractor';
import { RelationExtractor } from './RelationExtractor';
import { default as ChunkStorage } from '../database/chunkStorage';
import { embedding } from '../lib/embedding';

export interface GraphGeneratorConfig {
    relation_table_name: string;
    reference_table_name: string;
}

export class GraphGenerator {
    private logger: winston.Logger;
    private entityStorage: EntityStorage;
    private chunkStorage: ChunkStorage;
    private entityExtractor: EntityExtractor;
    private relationExtractor: RelationExtractor;
    private config: GraphGeneratorConfig;

    constructor(entityStorage: EntityStorage, chunkStorage: ChunkStorage, config: GraphGeneratorConfig) {
        this.entityStorage = entityStorage;
        this.chunkStorage = chunkStorage;
        this.config = config;
        this.logger = createLoggerWithPrefix('GraphGenerator');
        this.entityExtractor = new EntityExtractor(chunkStorage);
        this.relationExtractor = new RelationExtractor(chunkStorage);
    }

    /**
     * Generates the knowledge graph for a given chunk.
     * This function will generate local entity-to-entity graph, without merging behaviour.
     * @param chunkId The RecordId of the chunk to generate the knowledge graph from.
     */
    async generateGraph(chunkId: RecordId): Promise<void> {
        this.logger.info(`Starting knowledge graph generation for chunk ID: ${chunkId}`);
        try {
            // 1. Extract entities
            const entities = await this.entityExtractor.extractEntities(chunkId);
            this.logger.info(`Extracted ${entities.length} entities.`);

            // 2. Extract relations
            const relationResults: RelationExtractResult[] = await this.relationExtractor.extractRelations(chunkId, entities);
            this.logger.info(`Extracted ${relationResults.length} relations.`);

            // Convert RelationExtractResult to Relation using entity indices
            const relations: Relation[] = relationResults.map(result => {
                const sourceIndex = Number(result.source_entity) - 1; // Convert to 0-based index
                const targetIndex = Number(result.target_entity) - 1;

                if (isNaN(sourceIndex)) {
                    this.logger.error(`Invalid source entity index (not a number): ${result.source_entity}`);
                    return null;
                }
                if (isNaN(targetIndex)) {
                    this.logger.error(`Invalid target entity index (not a number): ${result.target_entity}`);
                    return null;
                }
                if (sourceIndex < 0 || sourceIndex >= entities.length) {
                    this.logger.error(`Invalid source entity index (out of range): ${result.source_entity}`);
                    return null;
                }
                if (targetIndex < 0 || targetIndex >= entities.length) {
                    this.logger.error(`Invalid target entity index (out of range): ${result.target_entity}`);
                    return null;
                }

                return {
                    source_entity: entities[sourceIndex].name,
                    target_entity: entities[targetIndex].name,
                    relation: result.relation,
                };
            }).filter(rel => rel !== null) as Relation[]; // Filter out any null relations

            this.logger.info(`Converted ${relations.length} relations to entity names.`);

            // 3. Process extracted entities
            const allEntities = new Map<string, Entity>();

            // Store extracted entities
            for (const entity of entities) {
                allEntities.set(entity.name, entity);
            }

            // 4. Verify relation entities exist in extracted entities (including aliases)
            try {
                // const chunk = await this.chunkStorage.get_by_id(chunkId);
                // const chunkText = chunk?.content || '';

                // for (const relation of relations) {
                //     // Verify source entity
                //     if (!this.entityExists(relation.source_entity, allEntities)) {
                //         const matchResult = await b.VerifyEntities(
                //             relation.source_entity,
                //             Array.from(allEntities.values()),
                //             chunkText
                //         );

                //         if (matchResult.is_match && matchResult.matched_entity_name) {
                //             // Rename relation to use matched entity
                //             relation.source_entity = matchResult.matched_entity_name;
                //         } else {
                //             // Extract missing entity from context using specialized prompt
                //             const result = await b.ExtractMissingEntities(
                //                 relation.source_entity,
                //                 Array.from(allEntities.values()),
                //                 chunkText
                //             );
                //             if (result.extracted_entities.length > 0) {
                //                 allEntities.set(result.extracted_entities[0].name, result.extracted_entities[0]);
                //                 this.logger.debug(`Extracted missing source entity: ${JSON.stringify(result)}`);
                //             } else {
                //                 this.logger.error(`Could not resolve source entity: ${relation.source_entity}`);
                //                 continue;
                //             }
                //         }
                //     }

                //     // Verify target entity
                //     if (!this.entityExists(relation.target_entity, allEntities)) {
                //         const matchResult = await b.VerifyEntities(
                //             relation.target_entity,
                //             Array.from(allEntities.values()),
                //             chunkText
                //         );

                //         if (matchResult.is_match && matchResult.matched_entity_name) {
                //             // Rename relation to use matched entity
                //             relation.target_entity = matchResult.matched_entity_name;
                //         } else {
                //             // Extract missing entity from context using specialized prompt
                //             const result = await b.ExtractMissingEntities(
                //                 relation.target_entity,
                //                 Array.from(allEntities.values()),
                //                 chunkText
                //             );
                //             if (result.extracted_entities.length > 0) {
                //                 allEntities.set(result.extracted_entities[0].name, result.extracted_entities[0]);
                //                 this.logger.debug(`Extracted missing target entity: ${JSON.stringify(result)}`);
                //             } else {
                //                 this.logger.error(`Could not resolve target entity: ${relation.target_entity}`);
                //                 continue;
                //             }
                //         }
                //     }
                // }
            } catch (err) {
                this.logger.error('Error during entity verification:', err);
            }


            // 5. Store all entities
            this.logger.debug(`Entities in allEntities before storage: ${JSON.stringify(Array.from(allEntities.keys()))}`);
            const entityIdMap = new Map<string, RecordId>();
            const db = await surrealDBClient.getDb();
            for (const [name, entity] of allEntities) {
                this.logger.debug(`Processing entity: ${name}`);
                try {
                    // Combine name and description for embedding
                    const textToEmbed = `${entity.name} ${entity.description || ''}`;
                    // Generate embedding
                    const entityEmbedding = await embedding(textToEmbed);

                    // Store entity with embedding
                    const createdEntities = await this.entityStorage.createNode({
                        ...entity,
                        embedding: entityEmbedding
                    });

                    if (createdEntities.length > 0) {
                        this.logger.debug(`Created entity ${name} with ID: ${createdEntities[0].id}`);
                        entityIdMap.set(name, createdEntities[0].id);
                        // Create entity--reference-->chunk
                        await db.insertRelation(this.config.reference_table_name, {
                            in: createdEntities[0].id,
                            out: chunkId
                        });
                    } else {
                        this.logger.error(`Failed to create database record for entity: ${name}`);
                    }
                } catch (err) {
                    this.logger.error(`Error creating entity ${name}:`, err);
                }
            }

            // Log the entityIdMap after processing
            this.logger.debug(`Entity ID Map contents after processing: ${JSON.stringify([...entityIdMap.entries()])}`);

            // 6. Store all relations
            const processedRelationNames = new Set<string>();
            for (const relation of relations) {
                const relationKey = `${relation.source_entity}-${relation.relation}-${relation.target_entity}`;
                if (processedRelationNames.has(relationKey)) {
                    continue;
                }

                const fromEntityId = entityIdMap.get(relation.source_entity);
                const toEntityId = entityIdMap.get(relation.target_entity);

                if (!fromEntityId) {
                    this.logger.error(`Missing source entity ID for relation: ${relation.source_entity} -> ${relation.relation} -> ${relation.target_entity}`);
                    continue;
                }
                if (!toEntityId) {
                     this.logger.error(`Missing target entity ID for relation: ${relation.source_entity} -> ${relation.relation} -> ${relation.target_entity}`);
                     continue;
                }

                this.logger.debug(`Creating relation: ${relation.source_entity} -> ${relation.relation} -> ${relation.target_entity}`);
                try {
                    const createdRelation = await db.insertRelation(this.config.relation_table_name, {
                        in: fromEntityId,
                        out: toEntityId,
                        relation: relation.relation
                    });

                    if (!createdRelation?.[0]?.id) {
                        throw new Error('Failed to create relation');
                    }

                    // Create relation--reference-->chunk
                    await db.insertRelation(this.config.reference_table_name, {
                        in: createdRelation[0].id,
                        out: chunkId
                    });
                } catch (error) {
                    this.logger.error(`Failed to create relation: ${relation.source_entity} -> ${relation.relation} -> ${relation.target_entity}`, error);
                    continue;
                }

                processedRelationNames.add(relationKey);
            }

            this.logger.info(`Finished processing relations. Total unique entities processed: ${entityIdMap.size}`);

            this.logger.info(`Knowledge graph generation completed for chunk ID: ${chunkId}`);

        } catch (error) {
            this.logger.error(`Error during knowledge graph generation for chunk ID ${chunkId}:`, error);
            throw error; // Re-throw the error to be caught by the caller
        }
    }

    /**
     * Checks if an entity name exists in the map, considering both name and aliases.
     * @param entityName The name to check.
     * @param allEntities The map of entities.
     * @returns True if the entity exists, false otherwise.
     */
    private entityExists(entityName: string, allEntities: Map<string, Entity>): boolean {
        for (const entity of allEntities.values()) {
            if (entity.name === entityName || (entity.aliases && entity.aliases.includes(entityName))) {
                return true;
            }
        }
        return false;
    }
}