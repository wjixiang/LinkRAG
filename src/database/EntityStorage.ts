import { d, Surreal } from 'surrealdb';
import { RecordId } from 'surrealdb';

type Any = any; // Using 'any' for simplicity, can be refined later

interface BaseEntityStorage {
    createNode(data: Record<string, Any>): Promise<Record<string, Any>[]>;
    createEdge(fromNodeId: RecordId, edgeTable: string, toNodeId: RecordId, data?: Record<string, Any>): Promise<Record<string, Any>[]>;
    getConnectedNodes(fromNodeId: RecordId, edgeTable: string): Promise<Record<string, Any>[]>;
    getEdges(fromNodeId: RecordId, edgeTable: string): Promise<Record<string, Any>[]>;
    deleteNode(nodeId: RecordId): Promise<Array<Record<string, Any> & { id: RecordId }>>;
    deleteEdge(edgeId: RecordId): Promise<Array<Record<string, Any> & { id: RecordId }>>;
}

export default class EntityStorage implements BaseEntityStorage {
    private db: Surreal;
    private nodeTableName: string; // namespace for nodes

    constructor(db: Surreal, nodeTableName: string = 'nodes') {
        this.db = db;
        this.nodeTableName = nodeTableName;
    }

    /**
     * Create a new node.
     */
    async createNode(data: Record<string, Any>): Promise<Array<Record<string, Any> & { id: RecordId }>> {
        try {
            const result = await this.db.create(this.nodeTableName, data);
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
            const result = await this.db.insertRelation(edgeTable,{
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
            // Perform a graph traversal to get the connected 'out' nodes
            const result = await this.db.query(`SELECT out FROM ${fromNodeId}->${edgeTable}`);
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
            // Select all edges originating from the node via the specified edge table
            const result = await this.db.query(`SELECT * FROM ${fromNodeId}->${edgeTable}`);
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
            const result = await this.db.delete(nodeId);
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
            const result = await this.db.delete(edgeId);
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
            // Use the MERGE statement to merge data into the existing record
            const result = await this.db.merge(nodeId, data);
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
    async findEntityByName(name: string): Promise<Array<Record<string, Any> & { id: RecordId }>> {
        try {
            const result = await this.db.query(`SELECT * FROM ${this.nodeTableName} WHERE name = "${name}"`);
            // The result of db.query is an array of results, one for each statement.
            // For a single SELECT statement, the actual data is in result[0].result
            if (result && result.length > 0) {
                const queryResult = result[0] as { status: string; result: Array<Record<string, Any> & { id: RecordId }> };
                if (queryResult.status === 'OK' && Array.isArray(queryResult.result)) {
                    return queryResult.result;
                }
            }
            return [];
        } catch (error: any) {
            console.error(`Error finding entity with name "${name}" in table ${this.nodeTableName}:`, error);
            throw error;
        }
    }
}