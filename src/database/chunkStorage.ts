import { Surreal } from 'surrealdb';
import Logger from '../lib/console/logger';

// Define the structure for a chunk document, combining document and vector properties
export interface ChunkDocument {
    id?: string; // Optional ID for SurrealDB records
    referenceIds: string[]; // Assuming this is an array of strings
    embedding: number[];
    content: string;
    [key: string]: any; // Allow other properties
}

// Define types based on the Python abstract class
export type EmbeddingFunc = (text: string) => Promise<number[] | null>;

interface BaseChunkStorage {
    embedding_func: EmbeddingFunc;
    cosine_better_than_threshold: number;
    meta_fields: Set<string>; // Although not explicitly required for ChunkDocument, keeping for potential future use or compatibility

    create(data: Omit<ChunkDocument, 'id'>): Promise<ChunkDocument[]>;
    read(id?: string): Promise<ChunkDocument[]>;
    update(id: string, data: Partial<ChunkDocument>): Promise<ChunkDocument[]>;
    delete(id: string): Promise<ChunkDocument[]>;
    query(query: string, top_k: number, ids?: string[] | null): Promise<ChunkDocument[]>;
    upsert(data: Record<string, Omit<ChunkDocument, 'id'>>): Promise<void>;
    delete_entity(entity_name: string): Promise<void>; // Assuming entity_name maps to chunk ID
    delete_entity_relation(entity_name: string): Promise<void>; // Placeholder, depends on relation model
    get_by_id(id: string): Promise<ChunkDocument | null>;
    get_by_ids(ids: string[]): Promise<ChunkDocument[]>;
    delete_by_ids(ids: string[]): Promise<void>; // Renamed to avoid conflict with delete(id)
}

export default class ChunkStorage implements BaseChunkStorage {
    private db: Surreal;
    embedding_func: EmbeddingFunc;
    cosine_better_than_threshold: number;
    meta_fields: Set<string>;
    private tableName: string;
    private logger: Logger;

    constructor(db: Surreal, tableName: string, embedding_func: EmbeddingFunc, cosine_better_than_threshold: number = 0.2, meta_fields: Set<string> = new Set()) {
        this.db = db;
        this.tableName = tableName;
        this.logger = new Logger('ChunkStorage');
        this.embedding_func = embedding_func;
        this.cosine_better_than_threshold = cosine_better_than_threshold;
        this.meta_fields = meta_fields;
    }

    /**
     * Create a new chunk document in the specified table.
     */
    async create(data: Omit<ChunkDocument, 'id'>): Promise<ChunkDocument[]> {
        try {
            const result = await this.db.create(this.tableName, data);
            return result as unknown as ChunkDocument[];
        } catch (error) {
            this.logger.error(`Error creating chunk in table ${this.tableName}:`, error);
            throw error;
        }
    }

    /**
     * Read chunk documents from the specified table.
     * If an id is provided, reads a single document. Otherwise, reads all documents.
     */
    async read(id?: string): Promise<ChunkDocument[]> {
        try {
            if (id) {
                const result = await this.db.select(`${this.tableName}:${id}`);
                return result as unknown as ChunkDocument[];
            } else {
                const result = await this.db.select(this.tableName);
                return result as unknown as ChunkDocument[];
            }
        } catch (error) {
            this.logger.error(`Error reading chunk(s) from table ${this.tableName}:`, error);
            throw error;
        }
    }

    /**
     * Update a chunk document with the given id in the specified table.
     */
    async update(id: string, data: Partial<ChunkDocument>): Promise<ChunkDocument[]> {
        try {
            const result = await this.db.merge(`${this.tableName}:${id}`, data);
            return result as unknown as ChunkDocument[];
        } catch (error) {
            this.logger.error(`Error updating chunk with id ${id} in table ${this.tableName}:`, error);
            throw error;
        }
    }

    /**
     * Delete a chunk document with the given id from the specified table.
     */
    async delete(id: string): Promise<ChunkDocument[]> {
        try {
            const result = await this.db.delete(`${this.tableName}:${id}`);
            return result as unknown as ChunkDocument[];
        } catch (error) {
            this.logger.error(`Error deleting chunk with id ${id} from table ${this.tableName}:`, error);
            throw error;
        }
    }

    /**
     * Query the chunk storage and retrieve top_k results based on vector similarity.
     */
    async query(query: string, top_k: number, ids: string[] | null = null): Promise<ChunkDocument[]> {
        const queryEmbedding = await this.embedding_func(query);

        if (queryEmbedding === null) {
            this.logger.error("Failed to generate embedding for query. Cannot perform vector search.");
            return []; // Return empty array if embedding generation failed
        }

        let surrealQL = `
            SELECT *, vector::similarity::cosine(embedding, ${JSON.stringify(queryEmbedding)}) AS score
            FROM ${this.tableName}
        `;

        const conditions: string[] = [];
        if (ids && ids.length > 0) {
            conditions.push(`id IN [${ids.map(id => `'${this.tableName}:${id}'`).join(', ')}]`);
        }

        if (conditions.length > 0) {
            surrealQL += ` WHERE ${conditions.join(' AND ')}`;
        }

        surrealQL += `
            ORDER BY score DESC
            LIMIT ${top_k};
        `;

        try {
            const result = await this.db.query(surrealQL);
            this.logger.info("query raw result:", JSON.stringify(result, null, 2));
            if (result && Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
                 // Filter results based on cosine_better_than_threshold if score is available
                return (result[0] as (ChunkDocument & { score: number })[]).filter((item: any) => item.score >= this.cosine_better_than_threshold);
            }
            return [];
        } catch (error) {
            this.logger.error("Error during chunk query:", error);
            throw error;
        }
    }

    /**
     * Insert or update chunks in the storage.
     * Uses the `create` method which handles both insert and update based on ID.
     */
    async upsert(data: Record<string, Omit<ChunkDocument, 'id'>>): Promise<void> {
        const recordsToInsert = Object.entries(data).map(([id, recordData]) => ({
            id: `${this.tableName}`, // SurrealDB record ID format
            ...recordData,
        }));

        try {
            for (const record of recordsToInsert) {
                const { id, ...dataWithoutId } = record;
                this.logger.info(`Attempting to create/update record with id: ${id}`, dataWithoutId);
                await this.db.create(id, dataWithoutId);
            }
        } catch (error) {
            this.logger.error("Error during chunk upsert:", error);
            throw error;
        }
    }

    /**
     * Delete a single entity by its name.
     * Assuming entity_name maps to the chunk record ID.
     */
    async delete_entity(entity_name: string): Promise<void> {
        try {
            await this.db.delete(`${this.tableName}:${entity_name}`);
        } catch (error) {
            this.logger.error("Error deleting entity:", error);
            throw error;
        }
    }

    /**
     * Delete relations for a given entity.
     * This method's implementation depends on how relations are modeled in SurrealDB for chunks.
     * Assuming relations are stored in a separate table or linked via fields.
     * This is a placeholder implementation assuming relations are linked by entity_name in the chunk table itself.
     * A more robust implementation would require knowing the relation structure.
     */
    async delete_entity_relation(entity_name: string): Promise<void> {
         this.logger.warning(`delete_entity_relation not fully implemented for SurrealDB. Entity: ${entity_name}`);
         // Placeholder implementation - depends on your relation model
    }

    /**
     * Get chunk data by its ID.
     */
    async get_by_id(id: string): Promise<ChunkDocument | null> {
        try {
            const result = await this.db.select(`${this.tableName}:${id}`);
            this.logger.info(`Result from select for id ${id}:`, JSON.stringify(result, null, 2));
            if (result) { // select for a specific id should return a single object or null
                return result as unknown as ChunkDocument;
            }
            return null;
        } catch (error) {
            this.logger.error("Error getting chunk by id:", error);
            throw error;
        }
    }

    /**
     * Get multiple chunk data by their IDs.
     */
    async get_by_ids(ids: string[]): Promise<ChunkDocument[]> {
        if (ids.length === 0) {
            return [];
        }
        const surrealQL = `SELECT * FROM ${this.tableName} WHERE id IN [${ids.map(id => `'${this.tableName}:${id}'`).join(', ')}];`;
        try {
            const result = await this.db.query(surrealQL);
            this.logger.info("get_by_ids raw result:", JSON.stringify(result, null, 2));
            if (result && Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
                return result[0] as ChunkDocument[];
            }
            return [];
        } catch (error) {
            this.logger.error("Error getting chunks by ids:", error);
            throw error;
        }
    }

    /**
     * Delete chunks with specified IDs.
     */
    async delete_by_ids(ids: string[]): Promise<void> {
         if (ids.length === 0) {
            return;
        }
        const recordIdsToDelete = ids.map(id => `${this.tableName}:${id}`);
        try {
            const surrealQL = `DELETE ${this.tableName} WHERE id IN [${recordIdsToDelete.map(id => `'${id}'`).join(', ')}];`;
            const result = await this.db.query(surrealQL);
            this.logger.info("delete_by_ids raw result:", JSON.stringify(result, null, 2));
        } catch (error) {
            this.logger.error("Error deleting chunks:", error);
            throw error;
        }
    }
}