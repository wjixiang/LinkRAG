import { surrealDBClient } from "@/database/surrealdbClient";
import { RetrievedEntityRecord, RelationRecord } from "@/type";
import { BaseRetriever } from "./BaseRetriever";
import { KnowledgeBaseRetrieverConfig } from "./KnowledgeBaseRetriever";
import { RecordId } from "surrealdb";

export class EntityRetriever extends BaseRetriever {
    private relationCache: Map<string, {in_relations: RelationRecord[], out_relations: RelationRecord[]}>;

    constructor(config: KnowledgeBaseRetrieverConfig) {
        super(config, 'EntityRetriever');
        this.relationCache = new Map();
    }

    async retrieve(query: string, top_k: number): Promise<RetrievedEntityRecord[]> {
        const queryEmbedding = await this.getQueryEmbedding(query);
        const semanticSearchResults: RetrievedEntityRecord[] = [];

        if (queryEmbedding !== null) {
            let semanticSurrealQL = `
                SELECT  id, name, description , vector::similarity::cosine(embedding, $queryEmbedding) AS score
                FROM ${this.config.entity_table_name}
                WHERE embedding != NONE
                ORDER BY score DESC
                LIMIT ${top_k};
            `;

            try {
                const db = await surrealDBClient.getDb();
                const result = await db.query<RetrievedEntityRecord[][]>(semanticSurrealQL, { queryEmbedding: queryEmbedding });
                this.logger.info(`Semantic retrieve ${result[0].length} entities`);
                if (result && Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
                    semanticSearchResults.push(...this.filterResultsByScore(result[0]));
                }
            } catch (error) {
                this.logger.error("Error during semantic search:", error);
            }
        } else {
            this.logger.error("Failed to generate embedding for query. Cannot perform semantic search.");
        }

        return semanticSearchResults;
    }

    /**
     * Retreive entities based on keyword matching of name field
     * @param entities 
     * @returns 
     */
    async entity_keyword_retriever(entities: string[]) {
        const db = await surrealDBClient.getDb();
        const hit_entities_raw = await Promise.all(entities.map(async (e) => {
            const hit_res = await db.query<RetrievedEntityRecord[][]>(`
                SELECT 
                    id, 
                    name, 
                    aliases,
                    description, 
                    type, 
                    (string::similarity::jaro($keyword, name)) AS score 
                FROM 
                    ${this.config.entity_table_name} 
                WHERE 
                    string::similarity::jaro($keyword, name) > 0.9`, { keyword: e });
            return hit_res[0];
        }));

        // Flatten the array of arrays and merge entities with the same ID
        const flattened_entities = hit_entities_raw.flat();
        const mergedPropertiesMap = new Map<string, RetrievedEntityRecord>();

        flattened_entities.forEach(entity => {
            const entityId = entity.id.toString();
            if (mergedPropertiesMap.has(entityId)) {
                const existingProperty = mergedPropertiesMap.get(entityId)!;
                // Keep the property with the higher score
                if (entity.score > existingProperty.score) {
                    mergedPropertiesMap.set(entityId, entity);
                }
            } else {
                mergedPropertiesMap.set(entityId, entity);
            }
        });

        const hit_entities = Array.from(mergedPropertiesMap.values());
        this.logger.debug(`Matched entities: ${JSON.stringify(hit_entities, null, "\t")}`);

        // If haven't matched any entity based on name, then proceed with aliases matching
        if(hit_entities.length===0){
            this.logger.info(`Proceed aliases matching`)
            const aliases_hit_entities = await this.entity_keyword_aliases_retriever(entities)
            hit_entities.push(...aliases_hit_entities)
        }

        return hit_entities;
    }


    async entity_keyword_aliases_retriever(entities: string[]) {
        const db = await surrealDBClient.getDb();
        const hit_entities_raw = await Promise.all(entities.map(async (e) => {
            const hit_res = await db.query<RetrievedEntityRecord[][]>(`
                SELECT 
                    id, 
                    name, 
                    aliases,
                    description, 
                    type,
                    aliases.map(|$v| string::similarity::jaro($v, "${e}") ).sort().pop() AS score
                FROM 
                    nodes
                WHERE 
                    aliases.filter(|$v| string::similarity::jaro($v, "${e}") > 0.9)
                    `, { keyword: e });
            return hit_res[0];
        }));

        // Flatten the array of arrays and merge entities with the same ID
        const flattened_entities = hit_entities_raw.flat();
        const mergedEntitiesMap = new Map<string, RetrievedEntityRecord>();

        flattened_entities.forEach(entity => {
            const entityId = entity.id.toString();
            if (mergedEntitiesMap.has(entityId)) {
                const existingProperty = mergedEntitiesMap.get(entityId)!;
                // Keep the property with the higher score
                if (entity.score > existingProperty.score) {
                    mergedEntitiesMap.set(entityId, entity);
                }
            } else {
                mergedEntitiesMap.set(entityId, entity);
            }
        });

        const hit_entities = Array.from(mergedEntitiesMap.values());
        this.logger.debug(`Matched entities: ${JSON.stringify(hit_entities, null, "\t")}`);

        return hit_entities;

    }

    async get_relations_of_entity(entityId: RecordId): Promise<{
        in_relations: RelationRecord[],
        out_relations: RelationRecord[]
    }>{
        const cacheKey = entityId.toString();
        if (this.relationCache.has(cacheKey)) {
            return this.relationCache.get(cacheKey)!;
        }

        const db = await surrealDBClient.getDb();
        const in_relations = await db.query<RelationRecord[][]>(`SELECT * FROM relation WHERE in = ${entityId};`);
        const out_relations = await db.query<RelationRecord[][]>(`SELECT * FROM relation WHERE out = ${entityId};`);

        const result = {
            in_relations: in_relations[0],
            out_relations: out_relations[0]
        };
        this.relationCache.set(cacheKey, result);
        return result;
    }
}