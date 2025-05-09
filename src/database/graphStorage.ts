import { Surreal } from 'surrealdb';

type Any = any; // Using 'any' for simplicity, can be refined later

interface BaseGraphStorage {
    createNode(data: Record<string, Any>): Promise<Record<string, Any>[]>;
    createEdge(fromNodeId: string, edgeTable: string, toNodeId: string, data?: Record<string, Any>): Promise<Record<string, Any>[]>;
    getConnectedNodes(fromNodeId: string, edgeTable: string): Promise<Record<string, Any>[]>;
    getEdges(fromNodeId: string, edgeTable: string): Promise<Record<string, Any>[]>;
    deleteNode(nodeId: string): Promise<Record<string, Any>[]>;
    deleteEdge(edgeId: string): Promise<Record<string, Any>[]>;
}

export default class GraphStorage implements BaseGraphStorage {
    private db: Surreal;
    private nodeTableName: string; // Table for nodes

    constructor(db: Surreal, nodeTableName: string = 'nodes') {
        this.db = db;
        this.nodeTableName = nodeTableName;
    }

    /**
     * Create a new node.
     */
    async createNode(data: Record<string, Any>): Promise<Record<string, Any>[]> {
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
    async createEdge(fromNodeId: string, edgeTable: string, toNodeId: string, data: Record<string, Any> = {}): Promise<Record<string, Any>[]> {
        try {
            const result = await this.db.create(`${fromNodeId}->${edgeTable}->${toNodeId}`, data);
            return result;
        } catch (error: any) {
            console.error(`Error creating edge from ${fromNodeId} to ${toNodeId} in table ${edgeTable}:`, error);
            throw error;
        }
    }

    /**
     * Get nodes connected from a specific node via a specific edge type.
     */
    async getConnectedNodes(fromNodeId: string, edgeTable: string): Promise<Record<string, Any>[]> {
        try {
            const result = await this.db.query(`SELECT out FROM ${fromNodeId}->${edgeTable}`);
             if (result && result.length > 0) {
                // The result structure for graph traversals might be an array of results for each statement.
                // Assuming the first result is the one we want and it contains an array of connected nodes in 'out'.
                const connectedEdges = (result[0] as { result: Array<{ out: string }> }).result;
                // Extract the 'out' IDs and fetch the actual nodes
                const connectedNodeIds = connectedEdges.map(edge => edge.out);
                 if (connectedNodeIds.length > 0) {
                     // Fetch the actual node records using a SELECT query with WHERE IN
                     const nodesResult = await this.db.query(`SELECT * FROM ${this.nodeTableName} WHERE id IN [${connectedNodeIds.map(id => `'${id}'`).join(', ')}];`);
                      if (nodesResult && nodesResult.length > 0) {
                         return (nodesResult[0] as { result: Array<Record<string, Any>> }).result;
                     }
                 }
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
    async getEdges(fromNodeId: string, edgeTable: string): Promise<Record<string, Any>[]> {
        try {
            const result = await this.db.query(`SELECT * FROM ${fromNodeId}->${edgeTable}`);
             if (result && result.length > 0) {
                // Assuming the first result is the one we want and it contains an array of edge records.
                return (result[0] as { result: Array<Record<string, Any>> }).result;
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
    async deleteNode(nodeId: string): Promise<Record<string, Any>[]> {
        try {
            const result = await this.db.delete(nodeId);
            return result;
        } catch (error: any) {
            console.error(`Error deleting node with id ${nodeId}:`, error);
            throw error;
        }
    }

    /**
     * Delete an edge by its ID.
     */
    async deleteEdge(edgeId: string): Promise<Record<string, Any>[]> {
        try {
            const result = await this.db.delete(edgeId);
            return result;
        } catch (error: any) {
            console.error(`Error deleting edge with id ${edgeId}:`, error);
            throw error;
        }
    }
}