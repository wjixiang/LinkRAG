import { surrealDBClient } from "@/database/surrealdbClient";
import { RetrievedEntityRecord, RelationRecord } from "@/type";
import { BaseRetriever } from "./BaseRetriever";
import { KnowledgeGraphRetrieverConfig } from "./KnowledgeGraphRetriever";
import { KeywordExtractor } from "./KeywordExtractor";
import { RecordId } from "surrealdb";

export class EntityRetriever extends BaseRetriever {
    private keywordExtractor: KeywordExtractor;
    private relationCache: Map<string, {in_relations: RelationRecord[], out_relations: RelationRecord[]}>;

    constructor(config: KnowledgeGraphRetrieverConfig) {
        super(config, 'EntityRetriever');
        this.keywordExtractor = new KeywordExtractor();
        this.relationCache = new Map();
    }

    async retrieve(query: string, top_k: number): Promise<RetrievedEntityRecord[]> {
        // Keyword-based graph retrieval
        const keywords = this.keywordExtractor.extractKeywords(query);
        this.logger.debug(`keywords: ${keywords}`);
    
        const combinedResultsMap = new Map<string, RetrievedEntityRecord>();
        const keywordSearchResults: RetrievedEntityRecord[] = [];

        if (keywords.length > 0) {
            const db = await surrealDBClient.getDb();

            try {
                const keywordResult = await Promise.all(keywords.map(async(e)=>{
                    return (await db.query<RetrievedEntityRecord[][]>(`SELECT id, name, description, (string::similarity::jaro($keyword, name)) AS score FROM nodes WHERE string::similarity::jaro($keyword, name) > 0.9`, { keyword: e }))[0];
                }));
                this.logger.info(`Keyword search raw result: ${JSON.stringify(keywordResult, null, 2)}`);
                if (keywordResult && Array.isArray(keywordResult)) {
                    keywordResult.forEach(resultArray => {
                        if (Array.isArray(resultArray) && resultArray.length > 0) {
                            keywordSearchResults.push(...resultArray);
                        }
                    });
                }
            } catch (error) {
                this.logger.error("Error during keyword search:", error);
            }
        }

        // Only perform semantic search if keyword search returned no results
        if (keywordSearchResults.length === 0) {
            this.logger.info(`Retrieve 0 entity according to keywords [${keywords}], start semantic retrieve`);
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
                    // Continue with keyword search even if semantic search fails
                }
            } else {
                this.logger.error("Failed to generate embedding for query. Cannot perform semantic search.");
            }

            // Combine semantic results if keyword search was empty
            semanticSearchResults.forEach(item => {
                combinedResultsMap.set(item.id.toString(), item);
            });
        }

        // Add keyword search results, prioritizing keyword matches (higher score)
        keywordSearchResults.forEach(item => {
            // If the entity is already in the map from semantic search, update the score if the keyword score is higher
            if (combinedResultsMap.has(item.id.toString())) {
                const existingItem = combinedResultsMap.get(item.id.toString())!;
                // Only update if the new score is higher (keyword score 1.0 is higher than semantic score <= 1.0)
                if (item.score > existingItem.score) {
                     combinedResultsMap.set(item.id.toString(), item);
                }
            } else {
                combinedResultsMap.set(item.id.toString(), item);
            }
        });

        // Convert map values back to an array and sort by score
        const finalResults = Array.from(combinedResultsMap.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, top_k);

        return finalResults;
    }

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

        const hit_properties = Array.from(mergedPropertiesMap.values());
        this.logger.debug(`Matched entities: ${JSON.stringify(hit_properties, null, "\t")}`);

        return hit_properties;
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