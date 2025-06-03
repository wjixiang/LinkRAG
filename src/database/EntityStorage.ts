import { Entity, EntityWithRef } from 'baml_client';
import { RecordId } from 'surrealdb';
import { surrealDBClient } from './surrealdbClient';
import createLoggerWithPrefix from '@/lib/console/logger';
import { EntityRecord, EntityWithRefDoc } from '@/type';

type Any = any; // Using 'any' for simplicity, can be refined later

interface EntityInput {
    name: string;
    aliases?: string[];
    description?: string;
    type?: string;
}

interface EntityValidationResult {
    existing: EntityRecord[];
    nonExisting: EntityInput[];
}

interface BaseEntityStorage {
    createNode(data: Record<string, Any>): Promise<Record<string, Any>[]>;
    createEdge(fromNodeId: RecordId, edgeTable: string, toNodeId: RecordId, data?: Record<string, Any>): Promise<Record<string, Any>[]>;
    getConnectedNodes(fromNodeId: RecordId, edgeTable: string): Promise<Record<string, Any>[]>;
    getEdges(fromNodeId: RecordId, edgeTable: string): Promise<Record<string, Any>[]>;
    deleteNode(nodeId: RecordId): Promise<Array<Record<string, Any> & { id: RecordId }>>;
    deleteEdge(edgeId: RecordId): Promise<Array<Record<string, Any> & { id: RecordId }>>;
}

export default class EntityStorage implements BaseEntityStorage {
    
    private nodeTableName: string; // namespace for nodes
    private referenceTableName: string // namespace for references
    private logger =  createLoggerWithPrefix('EntityStorage');

    constructor( nodeTableName: string, referenceTableName: string ) {
        this.nodeTableName = nodeTableName;
        this.referenceTableName = referenceTableName
    }

    async createEntity(entityWithRefDoc: Omit<EntityWithRefDoc,"id">) {
        try {
            const db = await surrealDBClient.getDb()

            const {referenceDoc, ...entity} = entityWithRefDoc

            // Create new entity
            const result = await db.create(this.nodeTableName, {...entity});
            this.logger.debug(`New entity created: ${JSON.stringify(result[0].name)}`)

            // Create references for created entity
            entityWithRefDoc.referenceDoc.map(async(e)=>{
                const refInsertRes = await db.insertRelation(this.referenceTableName, {
                    in: result[0].id,
                    out: e
                })
                return refInsertRes
            })
            

            return result;
        } catch (error: any) {
            console.error(`Error creating node in table ${this.nodeTableName}:`, error);
            throw error;
        }
    }

    /**
     * Create a new node.
     */
    async createNode(data: Record<string, Any>): Promise<Array<Record<string, Any> & { id: RecordId }>> {
        try {
            const db = await surrealDBClient.getDb()
            const result = await db.create(this.nodeTableName, data);
            return result;
        } catch (error: any) {
            console.error(`Error creating node in table ${this.nodeTableName}:`, error);
            throw error;
        }
    }

    /**
     * Create an edge between two nodes.
     */
    async createEdge(fromNodeId: RecordId, edgeTable: string, toNodeId: RecordId, data: Record<string, Any> = {}): Promise<Record<string, Any>[]> {
        try {
            const db = await surrealDBClient.getDb()
            const result = await db.insertRelation(edgeTable,{
                in: fromNodeId,
                out: toNodeId,
                data: data
            })
            return result;
        } catch (error: any) {
            console.error(`Error creating edge from ${fromNodeId} to ${toNodeId} in table ${edgeTable}:`, error);
            throw error;
        }
    }

    /**
     * Get nodes connected from a specific node via a specific edge type.
     */
    async getConnectedNodes(fromNodeId: RecordId, edgeTable: string): Promise<Record<string, Any>[]> {
        try {
            const db = await surrealDBClient.getDb()
            // Perform a graph traversal to get the connected 'out' nodes
            const result = await db.query(`SELECT out FROM ${fromNodeId}->${edgeTable}`);
            // The result of a graph traversal is typically an array of records
            // We expect the connected nodes to be directly in the result array
            if (result && result.length > 0) {
                // Assuming the result is an array of connected node records
                return result as Array<Record<string, Any>>;
            }
            return [];
        } catch (error: any) {
            console.error(`Error getting connected nodes from ${fromNodeId} via ${edgeTable}:`, error);
            throw error;
        }
    }

     /**
     * Get edges originating from a specific node via a specific edge type.
     */
    async getEdges(fromNodeId: RecordId, edgeTable: string): Promise<Record<string, Any>[]> {
        try {
            const db = await surrealDBClient.getDb()
            // Select all edges originating from the node via the specified edge table
            const result = await db.query(`SELECT * FROM ${fromNodeId}->${edgeTable}`);
            // The result of a SELECT query is typically an array of records
            // We expect the edge records to be directly in the result array
             if (result && result.length > 0) {
                return result as Array<Record<string, Any>>;
            }
            return [];
        } catch (error: any) {
            console.error(`Error getting edges from ${fromNodeId} via ${edgeTable}:`, error);
            throw error;
        }
    }


    /**
     * Delete a node by its ID.
     * Deleting a node in SurrealDB also deletes its incoming and outgoing edges.
     */
    async deleteNode(nodeId: RecordId): Promise<Array<Record<string, Any> & { id: RecordId }>> {
        try {
            const db = await surrealDBClient.getDb()
            const result = await db.delete(nodeId);
            // Use a double assertion to bypass potential incorrect type definitions
            return result as unknown as Array<Record<string, Any> & { id: RecordId }>;
        } catch (error: any) {
            console.error(`Error deleting node with id ${nodeId}:`, error);
            throw error;
        }
    }

    /**
     * Delete an edge by its ID.
     */
    async deleteEdge(edgeId: RecordId): Promise<Array<Record<string, Any> & { id: RecordId }>> {
        try {
            const db = await surrealDBClient.getDb()
            const result = await db.delete(edgeId);
            // Use a double assertion to bypass potential incorrect type definitions
            return result as unknown as Array<Record<string, Any> & { id: RecordId }>;
        } catch (error: any) {
            console.error(`Error deleting edge with id ${edgeId}:`, error);
            throw error;
        }
    }
 
     /**
      * Update a node by its ID, merging new data.
      */
    async updateNode(nodeId: RecordId, data: Record<string, Any>): Promise<Array<Record<string, Any> & { id: RecordId }>> {
        try {
            const db = await surrealDBClient.getDb()
            // Use the MERGE statement to merge data into the existing record
            const result = await db.merge(nodeId, data);
            // Use a double assertion to bypass potential incorrect type definitions
            return result as unknown as Array<Record<string, Any> & { id: RecordId }>;
        } catch (error: any) {
            console.error(`Error updating node with id ${nodeId} in table ${this.nodeTableName}:`, error);
            throw error;
        }
    }

     /**
      * Find an entity by its name.
      */
    async findEntityByName(name: string): Promise<EntityRecord[]> {
        try {
            const db = await surrealDBClient.getDb()
            const query = `SELECT id, name, type, aliases FROM ${this.nodeTableName} WHERE name == "${name}"`;
            const result = await db.query<EntityRecord[][]>(query);
            // The result of db.query is an array of results, one for each statement.
            // For a single SELECT statement, the actual data is in result[0].result
            
            return result[0];
        } catch (error: any) {
            console.error(`Error finding entity with name "${name}" in table ${this.nodeTableName}:`, error);
            throw error;
        }
    }

    /**
     * Validates whether the given entities already exist in the database.
     * Checks for existence by either:
     * - Exact name match
     * - Any alias overlap (if aliases are provided)
     *
     * @param entities - Array of entities to validate
     * @returns Promise resolving to {@link EntityValidationResult} containing:
     *          - `existing`: Array of entities that already exist in the database
     *          - `nonExisting`: Array of entities that don't exist in the database
     * @throws {Error} If there's any database query error
     *
     * @example
     * ```typescript
     * const result = await storage.validate_entities_existance(entities);
     * if (result.existing.length > 0) {
     *   console.log('Existing entities:', result.existing);
     * }
     * ```
     */
    async validate_entities_existance(entities: EntityInput[]): Promise<EntityValidationResult> {
        try {
            const db = await surrealDBClient.getDb()
            const result: EntityValidationResult = {
                existing: [],
                nonExisting: []
            }

            for (const entity of entities) {
                let exists = false
                
                // Check by name
                const byName = await this.findEntityByName(entity.name)
                if (byName.length > 0) {
                    result.existing.push(byName[0] as EntityRecord)
                    exists = true
                    continue
                }

                // Check by aliases if they exist
                if (entity.aliases && entity.aliases.length > 0) {
                    // Build OR condition for all aliases
                    const aliasConditions = entity.aliases
                        .map(alias => `aliases CONTAINS "${alias}"`)
                        .join(' OR ') + `OR aliases CONTAINS "${entity.name}"`

                    const query = `SELECT * FROM ${this.nodeTableName} WHERE ${aliasConditions}`
                    const queryResult = await db.query(query)

                    if (queryResult && queryResult.length > 0) {
                        const dbResult = queryResult[0] as { status: string; result: EntityRecord[] }
                        if (dbResult.status === 'OK' && dbResult.result.length > 0) {
                            result.existing.push(dbResult.result[0])
                            exists = true
                        }
                    }
                }

                if (!exists) {
                    result.nonExisting.push({
                        name: entity.name,
                        aliases: entity.aliases,
                        description: entity.description,
                        type: entity.type
                    })
                }
            }

            return result
        } catch (error: any) {
            this.logger.error(`Error validating entities existence:`, error)
            throw error
        }
    }
}