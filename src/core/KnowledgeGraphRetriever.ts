import { RecordId, Surreal } from "surrealdb";
import ChunkStorage, { ChunkDocument, semanticSearchResult } from "../database/chunkStorage";
import ReferenceDocumentStorage from "../database/referenceDocumentStorage";
import winston from 'winston';
import createLoggerWithPrefix from "../lib/console/logger";
import { surrealDBClient } from "@/database/surrealdbClient";
import { RelationRecord } from "@/type";
import { embedding } from "@/lib/embedding"; // Assuming this is the correct embedding function

export interface KnowledgeGraphRetrieverConfig {
    chunkTableName: string;
    property_table_name: string;
    entity_table_name: string;
    semantic_search_threshold: number;
}

export default class KnowledgeGraphRetriever {
    private logger: winston.Logger;
    config: KnowledgeGraphRetrieverConfig
    private chunkStorage!: ChunkStorage; // Use definite assignment assertion as it will be initialized in init()

    constructor(config: KnowledgeGraphRetrieverConfig) {
        this.logger = createLoggerWithPrefix('KnowledgeGraphRetriever');
        this.config = config;
        // ChunkStorage will be instantiated in the init method
    }

    async init(): Promise<void> {
        const db = await surrealDBClient.getDb();
        // Instantiate ChunkStorage internally with required arguments
        this.chunkStorage = new ChunkStorage(
            db, // Provide the Surreal instance
            this.config.chunkTableName,
            embedding, // Provide the embedding function
            this.config.semantic_search_threshold // Provide the semantic search threshold
        );
    }

    async chunks_retriver(query: string, top_k: number): Promise<semanticSearchResult[]> {
        // Ensure chunkStorage is initialized (though init should be called after constructor)
        if (!this.chunkStorage) {
            throw new Error("KnowledgeGraphRetriever not initialized. Call init() first.");
        }
        // Use the query method from ChunkStorage which handles embedding and vector search
        const retrievedChunks = await this.chunkStorage.query(query, top_k);
        this.logger.info(`Retrieved ${retrievedChunks.length} chunks`)
        return retrievedChunks;
    }

    async property_retriever(query: string, top_k: number ) {
        const queryEmbedding = await embedding(query);
        this.logger.debug("queryEmbedding",queryEmbedding)

        if (queryEmbedding === null) {
            this.logger.error("Failed to generate embedding for query. Cannot perform vector search.");
            return []; // Return empty array if embedding generation failed
        }

        let surrealQL = `
            SELECT  id, core_entity, property_content, property_name , vector::similarity::cosine(embedding_vector, ${JSON.stringify(queryEmbedding)}) AS score
            FROM ${this.config.property_table_name}
        `;

        // TODO: semantic search with partition
        // const conditions: string[] = [];
        // if (ids && ids.length > 0) {
        //     conditions.push(`id IN [${ids.map(id => `'${this.tableName}:${id}'`).join(', ')}]`);
        // }

        // if (conditions.length > 0) {
        //     surrealQL += ` WHERE ${conditions.join(' AND ')}`;
        // }

        surrealQL += `
            ORDER BY score DESC
            LIMIT ${top_k};
        `;

        try {
            const db = await surrealDBClient.getDb()
            const result = await db.query(surrealQL);
            this.logger.info("query raw result:", JSON.stringify(result, null, 2));
            if (result && Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
                 // Filter results based on cosine_better_than_threshold if score is available
                return (result[0] as (ChunkDocument & { score: number })[])
                    .filter((item: any) => item.score >= this.config.semantic_search_threshold)
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

    async entity_retriever(query: string, top_k: number) {
        const queryEmbedding = await embedding(query);
        this.logger.debug("queryEmbedding",queryEmbedding)

        if (queryEmbedding === null) {
            this.logger.error("Failed to generate embedding for query. Cannot perform vector search.");
            return []; // Return empty array if embedding generation failed
        }

        let surrealQL = `
            SELECT  id, name, description , vector::similarity::cosine(embedding, ${JSON.stringify(queryEmbedding)}) AS score
            FROM ${this.config.entity_table_name}
        `;

        // TODO: semantic search with partition
        // const conditions: string[] = [];
        // if (ids && ids.length > 0) {
        //     conditions.push(`id IN [${ids.map(id => `'${this.tableName}:${id}'`).join(', ')}]`);
        // }

        // if (conditions.length > 0) {
        //     surrealQL += ` WHERE ${conditions.join(' AND ')}`;
        // }

        surrealQL += `
            ORDER BY score DESC
            LIMIT ${top_k};
        `;

        try {
            const db = await surrealDBClient.getDb()
            const result = await db.query(surrealQL);
            this.logger.info("query raw result:", JSON.stringify(result, null, 2));
            if (result && Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
                 // Filter results based on cosine_better_than_threshold if score is available
                return (result[0] as (ChunkDocument & { score: number })[])
                    .filter((item: any) => item.score >= this.config.semantic_search_threshold)
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

    async get_keyword_from_query(query: string) {

    }

    async get_relations_of_entity(entityId: RecordId): Promise<{
        in_relations: RelationRecord[],
        out_relations: RelationRecord[]
    }>{
        const db = await surrealDBClient.getDb();
        const in_relations = await db.query<RelationRecord[][]>(`SELECT * FROM relation WHERE in = ${entityId};`)
        const out_relations = await db.query<RelationRecord[][]>(`SELECT * FROM relation WHERE out = ${entityId};`)

        return {
            in_relations: in_relations[0],
            out_relations: out_relations[0]
        }
    }


}