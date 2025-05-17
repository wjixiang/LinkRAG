import { RecordId } from 'surrealdb';
import { Entity, b } from 'baml_client';
import EntityStorage from '../database/EntityStorage';
import { surrealDBClient } from '../database/surrealdbClient';
import Logger from '../lib/console/logger';
import pLimit from 'p-limit';

interface EntityRecord extends Entity {
    id: RecordId
}

export interface GraphMergerConfig {
    relation_table_name: string;
}

export class GraphMerger {
    private logger: Logger;
    private entityStorage: EntityStorage;
    private config: GraphMergerConfig;

    constructor(entityStorage: EntityStorage, config: GraphMergerConfig) {
        this.entityStorage = entityStorage;
        this.config = config;
        this.logger = new Logger('GraphMerger');
    }

    async jointGraph() {
        const db = await surrealDBClient.getDb();
        const duplicated_entities_groups = await db.query<{ count: number, name: string }[][]>(`SELECT * FROM (SELECT name, count() AS count FROM nodes GROUP BY name) WHERE count > 1;`);
        this.logger.info(`Get ${duplicated_entities_groups[0].length} groups of duplicated entities`);

        // Process each entity name with concurrency control
        const limit = pLimit(5); // Limit to 5 concurrent merges
        const mergePromises = duplicated_entities_groups[0].map(({ name }) => {
            return limit(async () => {
                try {
                    await this.mergeEntities(name);
                    this.logger.debug(`Successfully processed entity: ${name}`);
                } catch (error) {
                    this.logger.error(`Failed to merge entities for name ${name}:`, error);
                }
            });
        });

        await Promise.all(mergePromises);
        this.logger.info(`Finished processing all duplicated entities`);
    }

    /**
     *
     * @param entity_name shared name of duplicated entities
     */
    async mergeEntities(entity_name: string) {
        const db = await surrealDBClient.getDb();
        const duplicated_entities = await db.query<EntityRecord[][]>(`SELECT * FROM nodes WHERE name = "${entity_name}";`);

        if (duplicated_entities[0].length < 2) {
            this.logger.info(`No duplicates found for entity: ${entity_name}`);
            return;
        }

        // Use first entity as base for merging
        let mergedEntity = duplicated_entities[0][0];

        // Merge all other entities into the base one
        for (let i = 1; i < duplicated_entities[0].length; i++) {
            const currentEntity = duplicated_entities[0][i];
            this.logger.debug(`Merging entity ${currentEntity.id} into ${mergedEntity.id}`);

            // Merge properties using BAML
            const mergedDefinition = await b.MergeEntities(mergedEntity, currentEntity);

            // Update the merged entity with new properties
            mergedEntity = {
                ...mergedEntity,
                description: mergedDefinition,
                // type: currentEntity.type || mergedEntity.type
            };

            // Update the merged entity in storage
            await this.entityStorage.updateNode(mergedEntity.id, mergedEntity);

            // Get all relations involving the current entity
            const incomingRelations = await db.query<{ id: RecordId, in: RecordId, out: RecordId, relation: string }[][]>(
                `SELECT * FROM ${this.config.relation_table_name} WHERE in = ${currentEntity.id};`
            );
            const outgoingRelations = await db.query<{ id: RecordId, in: RecordId, out: RecordId, relation: string }[][]>(
                `SELECT * FROM ${this.config.relation_table_name} WHERE out = ${currentEntity.id};`
            );

            // Delete all existing relations first
            await db.query(
                `DELETE FROM ${this.config.relation_table_name} WHERE in = ${currentEntity.id} OR out = ${currentEntity.id};`
            );

            // Create new relations pointing to merged entity
            for (const rel of incomingRelations[0] || []) {
                await db.insertRelation(this.config.relation_table_name, {
                    in: mergedEntity.id,
                    out: rel.out,
                    relation: rel.relation
                });
            }
            for (const rel of outgoingRelations[0] || []) {
                await db.insertRelation(this.config.relation_table_name, {
                    in: rel.in,
                    out: mergedEntity.id,
                    relation: rel.relation
                });
            }

            this.logger.debug(`Recreated ${incomingRelations[0]?.length || 0} incoming and ${outgoingRelations[0]?.length || 0} outgoing relations for entity ${currentEntity.id}`);

            // Only delete after all relations are recreated
            await this.entityStorage.deleteNode(currentEntity.id);
        }

        this.logger.info(`Successfully merged ${duplicated_entities[0].length} entities for name: ${entity_name}`);
    }
}