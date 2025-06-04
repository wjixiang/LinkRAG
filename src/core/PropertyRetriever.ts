import { surrealDBClient } from "@/database/surrealdbClient";
import { RetrievedProperty } from "@/type";
import { BaseRetriever } from "./BaseRetriever";
import { KnowledgeBaseRetrieverConfig } from "./KnowledgeBaseRetriever";
import { b } from "baml_client/async_client";

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
    async property_keyword_retriever(query: string, hit_entities_names: string[]) {
        const entity_property_pairs = await b.ExtractEP(query);
        this.logger.debug("extracted EPs:", entity_property_pairs);

        const db = await surrealDBClient.getDb();
        const hit_properties_raw = await Promise.all(entity_property_pairs.map(async (e) => {
            const hit_res = await db.query<RetrievedProperty[][]>(`
                SELECT id, core_entity.id ,core_entity.name, property_name, property_content, (string::similarity::jaro($keyword, property_name)) AS score 
                FROM ${this.config.property_table_name} 
                WHERE 
                    string::similarity::jaro($keyword, property_name) > 0.9
                    AND
                    core_entity.name INSIDE $entities
                FETCH core_entity
                    `, { 
                        keyword: e.property ,
                        entities: hit_entities_names
                    });
            return hit_res[0];
        }));

        // Flatten the array of arrays and merge properties with the same ID
        const flattened_properties = hit_properties_raw.flat();
        const mergedPropertiesMap = new Map<string, RetrievedProperty>();

        flattened_properties.forEach(property => {
            const propertyId = property.id.toString();
            if (mergedPropertiesMap.has(propertyId)) {
                const existingProperty = mergedPropertiesMap.get(propertyId)!;
                // Keep the property with the higher score
                if (property.score > existingProperty.score) {
                    mergedPropertiesMap.set(propertyId, property);
                }
            } else {
                mergedPropertiesMap.set(propertyId, property);
            }
        });

        const hit_properties = Array.from(mergedPropertiesMap.values());
        this.logger.debug(JSON.stringify(hit_properties, null, "\t"));
        return hit_properties;
    }
}