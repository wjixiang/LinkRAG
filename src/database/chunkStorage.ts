import { RecordId, Surreal } from 'surrealdb';
import Logger from '../lib/console/logger';
import winston from 'winston';
import createLoggerWithPrefix from '../lib/console/logger';
import { surrealDBClient } from './surrealdbClient';

// Define the structure for a chunk document, combining document and vector properties
export interface ChunkDocument {
    id: RecordId; // Optional ID for SurrealDB records
    referenceIds: RecordId[]; // Assuming this is an array of strings
    embedding: number[];
    content: string;
    [key: string]: any; // Allow other properties
}

// Define types based on the Python abstract class

export type EmbeddingFunc = (text: string | string[]) => Promise<number[] | number[][] | null>;

interface BaseChunkStorage {
    embedding_func: EmbeddingFunc;
    cosine_better_than_threshold: number;
    meta_fields: Set<string>; // Although not explicitly required for ChunkDocument, keeping for potential future use or compatibility

    create(data: Omit<ChunkDocument, 'id'>): Promise<ChunkDocument[]>;
    read(id?: string): Promise<ChunkDocument[]>;
    update(id: string, data: Partial<ChunkDocument>): Promise<ChunkDocument[]>;
    delete(id: string): Promise<ChunkDocument[]>;
    query(query: string, top_k: number, ids?: string[] | null): Promise<{
        document: Omit<ChunkDocument, 'embedding'>,
        score: number;
    }[]>;
    upsert(data: Record<string, Omit<ChunkDocument, 'id'>>): Promise<void>;
    get_by_id(id: RecordId): Promise<Omit<ChunkDocument, 'embedding'> | null>;
    get_by_ids(ids: RecordId[]): Promise<Omit<ChunkDocument, 'embedding'>[]>;
    delete_by_ids(ids: string[]): Promise<void>; // Renamed to avoid conflict with delete(id)
}

/**
 * test script: src/test_script/test_chunk_storage.ts
 */
export default class ChunkStorage implements BaseChunkStorage {
    embedding_func: EmbeddingFunc;
    cosine_better_than_threshold: number;
    meta_fields: Set<string>;
    private tableName: string;
    private logger: winston.Logger;

    constructor(tableName: string, embedding_func: EmbeddingFunc, cosine_better_than_threshold: number = 0.2, meta_fields: Set<string> = new Set()) {
        
        this.tableName = tableName;
        this.logger = createLoggerWithPrefix('ChunkStorage');
        this.embedding_func = embedding_func;
        this.cosine_better_than_threshold = cosine_better_than_threshold;
        this.meta_fields = meta_fields;
    }

    /**
     * Create a new chunk document in the specified table.
     */
    async create(data: Omit<ChunkDocument, 'id'>): Promise<ChunkDocument[]> {
        try {
            const db = await surrealDBClient.getDb()
            const result = await db.create(this.tableName, data);
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
            const db = await surrealDBClient.getDb();
            if (id) {
                const result = await db.select(`${this.tableName}:${id}`);
                return result as unknown as ChunkDocument[];
            } else {
                const result = await db.select(this.tableName);
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
            const db = await surrealDBClient.getDb();
            const result = await db.merge(`${this.tableName}:${id}`, data);
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
            const db = await surrealDBClient.getDb();
            const result = await db.delete(`${this.tableName}:${id}`);
            return result as unknown as ChunkDocument[];
        } catch (error) {
            this.logger.error(`Error deleting chunk with id ${id} from table ${this.tableName}:`, error);
            throw error;
        }
    }

    /**
     * Query the chunk storage and retrieve top_k results based on vector similarity.
     */
    async query(query: string, top_k: number, ids: string[] | null = null): Promise<semanticSearchResult[]> {
        const queryEmbedding = await this.embedding_func(query);

        if (queryEmbedding === null) {
            this.logger.error("Failed to generate embedding for query. Cannot perform vector search.");
            return []; // Return empty array if embedding generation failed
        }

        let surrealQL = `
            SELECT id, referenceIds, content, vector::similarity::cosine(embedding, ${JSON.stringify(queryEmbedding)}) AS score
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
            const db = await surrealDBClient.getDb();
            const result = await db.query(surrealQL);
            this.logger.info("query raw result:", JSON.stringify(result, null, 2));
            if (result && Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
                 // Filter results based on cosine_better_than_threshold if score is available
                return (result[0] as (ChunkDocument & { score: number })[])
                    .filter((item: any) => item.score >= this.cosine_better_than_threshold)
                    .map(item => ({
                        document: {
                            id: item.id,
                            referenceIds: item.referenceIds,
                            content: item.content,
                            ...Object.fromEntries(Object.entries(item).filter(([key]) => !['id', 'referenceIds', 'content', 'embedding', 'score'].includes(key))) // Include other properties
                        },
                        score: item.score
                    }));
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
            const db = await surrealDBClient.getDb();
            for (const record of recordsToInsert) {
                const { id, ...dataWithoutId } = record;
                await db.create(id, dataWithoutId);
            }

            this.logger.info(`Create/Update ${recordsToInsert.length} records`);
        } catch (error) {
            this.logger.error("Error during chunk upsert:", error);
            throw error;
        }
    }


    /**
     * Get chunk data by its ID.
     */
    async get_by_id(id: RecordId): Promise<Omit<ChunkDocument, 'embedding'> | null> {
        try {
            const db = await surrealDBClient.getDb();
            const result = await db.select(id);
            // this.logger.info(`Result from select for id ${id}:`, JSON.stringify(result, null, 2));
            if (result) { // select for a specific id should return a single object or null
                const chunk = result as unknown as ChunkDocument;
                // Omit the embedding field
                const { embedding, ...chunkWithoutEmbedding } = chunk;
                return chunkWithoutEmbedding;
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
    async get_by_ids(ids: RecordId[]): Promise<Omit<ChunkDocument, 'embedding'>[]> {
        if (ids.length === 0) {
            return [];
        }
        const surrealQL = `SELECT * FROM ${this.tableName} WHERE id IN [${ids.map(id => `'${this.tableName}:${id.id}'`).join(', ')}];`;
        try {
            const db = await surrealDBClient.getDb();
            const result = await db.query(surrealQL);
            // this.logger.info("get_by_ids raw result:", JSON.stringify(result, null, 2));
            if (result && Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
                // Omit the embedding field from each chunk
                return (result[0] as ChunkDocument[]).map(chunk => {
                    const { embedding, ...chunkWithoutEmbedding } = chunk;
                    return chunkWithoutEmbedding;
                });
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
            const db = await surrealDBClient.getDb();
            const surrealQL = `DELETE ${this.tableName} WHERE id IN [${recordIdsToDelete.map(id => `'${id}'`).join(', ')}];`;
            const result = await db.query(surrealQL);
            // this.logger.info("delete_by_ids raw result:", JSON.stringify(result, null, 2));
        } catch (error) {
            this.logger.error("Error deleting chunks:", error);
            throw error;
        }
    }
}

export interface semanticSearchResult {
    document: Omit<ChunkDocument, 'embedding'>,
    score: number;
}