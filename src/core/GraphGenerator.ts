import { RecordId } from 'surrealdb';
import { Entity, Relation, b } from 'baml_client';
import EntityStorage from '../database/EntityStorage';
import { surrealDBClient } from '../database/surrealdbClient';
import Logger from '../lib/console/logger';
import { EntityExtractor } from './EntityExtractor';
import { RelationExtractor } from './RelationExtractor';
import { default as ChunkStorage } from '../database/chunkStorage';

export interface GraphGeneratorConfig {
    relation_table_name: string;
    reference_table_name: string;
}

export class GraphGenerator {
    private logger: Logger;
    private entityStorage: EntityStorage;
    private chunkStorage: ChunkStorage;
    private entityExtractor: EntityExtractor;
    private relationExtractor: RelationExtractor;
    private config: GraphGeneratorConfig;

    constructor(entityStorage: EntityStorage, chunkStorage: ChunkStorage, config: GraphGeneratorConfig) {
        this.entityStorage = entityStorage;
        this.chunkStorage = chunkStorage;
        this.config = config;
        this.logger = new Logger('GraphGenerator');
        this.entityExtractor = new EntityExtractor(chunkStorage);
        this.relationExtractor = new RelationExtractor(chunkStorage);
    }

    /**
     * Checks if an entity with the same name exists and merges if it does, otherwise creates a new entity.
     * @param entity The entity to check and merge or create.
     * @returns The RecordId of the saved or merged entity.
     */
    private async checkAndMergeEntity(entity: Entity, chunkId: RecordId): Promise<RecordId> {
        this.logger.debug(`Checking and merging entity: ${JSON.stringify(entity)}`);
        // const existingEntities = await this.entityStorage.findEntityByName(entity.name);
        this.logger.info(`Entity with name "${entity.name}" not found. Creating new entity.`);
        const createdEntities = await this.entityStorage.createNode(entity);
        const referenceDb = await surrealDBClient.getDb();
        await referenceDb.insertRelation("reference", {
            in: createdEntities[0].id,
            out: chunkId,
        });
        if (createdEntities.length > 0) {
            this.logger.info(`Created new entity with ID: ${createdEntities[0].id}`);
            return createdEntities[0].id;
        } else {
            throw new Error(`Failed to create entity: ${entity.name}`);
        }

        // if (existingEntities.length > 0) {
        //     const existingEntity = existingEntities[0];
        //     this.logger.info(`Entity with name "${entity.name}" already exists. Merging properties into ID: ${existingEntity.id}`);
        //     // Merge properties from the new entity into the existing one

        //     const mergedDefinition = b.MergeEntities({
        //         name: existingEntity.name,
        //         description: existingEntity.description,
        //         type: existingEntity.type
        //     },entity)

        //     this.logger.info("merged definition:",mergedDefinition)
        //     await this.entityStorage.updateNode(existingEntity.id, {...entity, description: mergedDefinition});
        //     this.logger.debug(`Merged properties for entity ID: ${existingEntity.id}`);
        //     return existingEntity.id;
        // } else {
        //     this.logger.info(`Entity with name "${entity.name}" not found. Creating new entity.`);
        //     const createdEntities = await this.entityStorage.createNode(entity);
        //     const referenceDb = await surrealDBClient.getDb();
        //     await referenceDb.insertRelation("reference", {
        //                 in: createdEntities[0].id,
        //                 out: chunkId,
        //             });
        //     if (createdEntities.length > 0) {
        //         this.logger.info(`Created new entity with ID: ${createdEntities[0].id}`);
        //         return createdEntities[0].id;
        //     } else {
        //         throw new Error(`Failed to create entity: ${entity.name}`);
        //     }
        // }
    }

    /**
     * Generates the knowledge graph for a given chunk.
     * @param chunkId The RecordId of the chunk to generate the knowledge graph from.
     */
    async generateGraph(chunkId: RecordId): Promise<void> {
        this.logger.info(`Starting knowledge graph generation for chunk ID: ${chunkId}`);
        try {
            // 1. Extract entities
            const entities = await this.entityExtractor.extractEntities(chunkId);
            this.logger.info(`Extracted ${entities.length} entities.`);

            // 2. Process entities (check existence and merge/create)
            const entityIdMap = new Map<string, RecordId>();
            for (const entity of entities) {
                const entityId = await this.checkAndMergeEntity(entity, chunkId);
                entityIdMap.set(entity.name, entityId);
            }
            this.logger.info(`Processed ${entityIdMap.size} unique entities.`);

            // 3. Extract relations
            const relations = await this.relationExtractor.extractRelations(chunkId, entities);
            this.logger.info(`Extracted ${relations.length} relations.`);

            // 4. Ensure all entities referenced in relations exist and save relations
            const processedRelationNames = new Set<string>(); // To avoid processing the same relation multiple times

            for (const relation of relations) {
                 // Generate a unique key for the relation to check if it's already processed
                const relationKey = `${relation.source_entity}-${relation.relation}-${relation.target_entity}`;
                if (processedRelationNames.has(relationKey)) {
                    continue; // Skip if already processed
                }

                // Check if source entity exists, create if not
                if (!entityIdMap.has(relation.source_entity)) {
                    this.logger.info(`Source entity "${relation.source_entity}" not found. Creating new entity.`);
                    // Create a basic entity with just the name
                    const newEntity: Entity = { name: relation.source_entity, description: '', type: 'Unknown' }; // Provide default values
                    const createdEntities = await this.entityStorage.createNode(newEntity);
                    // create entity--reference-->chunk
                    const db = await surrealDBClient.getDb();
                    await db.insertRelation(this.config.reference_table_name, {
                        in: createdEntities[0].id,
                        out: chunkId,
                        // data: { description: relation.relationship_description } // Include relation properties
                    });

                    if (createdEntities.length > 0) {
                        this.logger.info(`Created new source entity with ID: ${createdEntities[0].id}`);
                        entityIdMap.set(relation.source_entity, createdEntities[0].id);
                    } else {
                        this.logger.error(`Failed to create source entity: ${relation.source_entity}. Skipping relation.`);
                        continue; // Skip relation if source entity creation fails
                    }
                }

                // Check if target entity exists, create if not
                if (!entityIdMap.has(relation.target_entity)) {
                    this.logger.info(`Target entity "${relation.target_entity}" not found. Creating new entity.`);
                     // Create a basic entity with just the name
                    const newEntity: Entity = { name: relation.target_entity, description: '', type: 'Unknown' }; // Provide default values
                    const createdEntities = await this.entityStorage.createNode(newEntity);
                    if (createdEntities.length > 0) {
                        this.logger.info(`Created new target entity with ID: ${createdEntities[0].id}`);
                        entityIdMap.set(relation.target_entity, createdEntities[0].id);
                    } else {
                        this.logger.error(`Failed to create target entity: ${relation.target_entity}. Skipping relation.`);
                        continue; // Skip relation if target entity creation fails
                    }
                }

                // Now that both entities are guaranteed to exist in entityIdMap, save the relation
                const fromEntityId = entityIdMap.get(relation.source_entity)!; // Use non-null assertion as we've ensured existence
                const toEntityId = entityIdMap.get(relation.target_entity)!; // Use non-null assertion as we've ensured existence

                this.logger.debug(`Creating relation: ${relation.source_entity} -> ${relation.relation} -> ${relation.target_entity}`);
                const relationDb = await surrealDBClient.getDb();
                const createdRelation = await relationDb.insertRelation(this.config.relation_table_name, {
                    in: fromEntityId,
                    out: toEntityId,
                    relation: relation.relation,
                    // data: { description: relation.relationship_description } // Include relation properties
                });
                this.logger.debug(`Created relation successfully.`);

                // create relation--reference-->chunk
                const db = await surrealDBClient.getDb();
                await db.insertRelation("reference", {
                    in: createdRelation[0].id,
                    out: chunkId,
                    // data: { description: relation.relationship_description } // Include relation properties
                });

                processedRelationNames.add(relationKey); // Mark as processed
            }

            this.logger.info(`Finished processing relations. Total unique entities processed: ${entityIdMap.size}`);

            this.logger.info(`Knowledge graph generation completed for chunk ID: ${chunkId}`);

        } catch (error) {
            this.logger.error(`Error during knowledge graph generation for chunk ID ${chunkId}:`, error);
            throw error; // Re-throw the error to be caught by the caller
        }
    }
}