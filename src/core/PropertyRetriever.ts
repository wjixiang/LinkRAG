import { surrealDBClient } from "@/database/surrealdbClient";
import { RetrievedProperty } from "@/type";
import { BaseRetriever } from "./BaseRetriever";
import { KnowledgeBaseRetrieverConfig } from "./KnowledgeBaseRetriever";
import { RecordId } from "surrealdb";

export class PropertyRetriever extends BaseRetriever {
    constructor(config: KnowledgeBaseRetrieverConfig) {
        super(config, 'PropertyRetriever');
    }

    async retrieve(query: string, top_k: number): Promise<RetrievedProperty[]> {
        const queryEmbedding = await this.getQueryEmbedding(query);

        if (queryEmbedding === null) {
            return [];
        }

        let surrealQL = `
            SELECT  id, core_entity, property_content, property_name , vector::similarity::cosine(embedding_vector, <array<number>> $queryEmbedding) AS score
            FROM ${this.config.property_table_name}
            WHERE embedding_vector != NONE
        `;

        surrealQL += `
            ORDER BY score DESC
            LIMIT ${top_k};
        `;

        try {
            const db = await surrealDBClient.getDb();
            const result = await db.query<RetrievedProperty[][]>(surrealQL, { queryEmbedding: queryEmbedding });
            this.logger.debug("query raw result:", JSON.stringify(result, null, 2));
            if (result && Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
                return this.filterResultsByScore(result[0]);
            }
            return [];
        } catch (error) {
            this.logger.error("Error during property query:", error);
            throw error;
        }
    }

    /**
     * Retrieve property documents based on keywords
     * @param query 
     */
    async property_keyword_retriever(property_name: string, hit_entity_recordId: RecordId) {
        

        if (!property_name) {
            return [];
        }

        const db = await surrealDBClient.getDb();
        
        const hit_res = await db.query<RetrievedProperty[][]>(`
            SELECT
                id AS id,
                core_entity.id AS core_entity_id,
                core_entity.name AS core_entity_name,
                prop_name AS prop_name,
                content AS content,
                (string::similarity::jaro("${property_name}", prop_name)) AS score
            FROM ${this.config.property_table_name}
            WHERE
                string::similarity::jaro("${property_name}", prop_name) > 0.9
                AND
                core_entity == $core_entity_id
            FETCH core_entity
                `, {
                    core_entity_id: hit_entity_recordId,
                    property_name: property_name
                });
        
            
        return hit_res[0];
    }
}