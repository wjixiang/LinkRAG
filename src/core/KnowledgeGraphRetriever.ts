import { RecordId, Surreal } from "surrealdb";
import ChunkStorage, { ChunkDocument, semanticSearchResult } from "../database/chunkStorage";
import ReferenceDocumentStorage from "../database/referenceDocumentStorage";
import winston from 'winston';
import createLoggerWithPrefix from "../lib/console/logger";
import { surrealDBClient } from "@/database/surrealdbClient";
import { EntityRecord, language, RelationRecord, RetrievedEntityRecord, RetrievedProperty } from "@/type";
import { embedding } from "@/lib/embedding";
import { b } from "baml_client/async_client";
import { KeywordExtractor } from "./KeywordExtractor";

// Types for hybrid retrieval
type QueryType = 'entity' | 'property' | 'chunk' | 'mixed';
export type RetrievalResult = { // Export RetrievalResult
    content: string;
    score: number;
    type: 'entity' | 'property' | 'chunk';
    source: string;
};

interface HybridRetrievalConfig {
    entityWeight: number;
    propertyWeight: number;
    chunkWeight: number;
    entityQueryPatterns: RegExp[];
    propertyQueryPatterns: RegExp[];
}

export interface KnowledgeGraphRetrieverConfig {
    chunkTableName: string;
    property_table_name: string;
    entity_table_name: string;
    semantic_search_threshold: number;
    language: language;
    hybridRetrieval?: HybridRetrievalConfig;
}

export default class KnowledgeGraphRetriever {
    private logger: winston.Logger;
    config: KnowledgeGraphRetrieverConfig;
    private chunkStorage!: ChunkStorage;
    private keywordExtractor: KeywordExtractor; // Add KeywordExtractor instance
    private relationCache: Map<string, {in_relations: RelationRecord[], out_relations: RelationRecord[]}>;
    private defaultHybridConfig: HybridRetrievalConfig = {
        entityWeight: 0.4,
        propertyWeight: 0.3,
        chunkWeight: 0.3,
        entityQueryPatterns: [
            /(what|who|where)\s(is|are)\s.+/i,
            /(define|definition of)\s.+/i,
            /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)*$/ // Matches proper nouns
        ],
        propertyQueryPatterns: [
            /(how|why)\s.+/i,
            /(describe|explain)\s.+/i,
            /(attribute|property|characteristic)\s(of|for)\s.+/i
        ]
    };

    constructor(config: KnowledgeGraphRetrieverConfig) {
        this.logger = createLoggerWithPrefix('KnowledgeGraphRetriever');
        this.config = {
            ...config,
            hybridRetrieval: {
                ...this.defaultHybridConfig,
                ...config.hybridRetrieval
            }
        };
        this.relationCache = new Map();
        this.keywordExtractor = new KeywordExtractor(); // Initialize KeywordExtractor
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
        // this.logger.debug("queryEmbedding length:", queryEmbedding?.length);
        this.logger.debug(`queryEmbedding type: ${typeof queryEmbedding}, length: ${queryEmbedding?.length}`);
        
        if (queryEmbedding === null) {
            this.logger.error("Failed to generate embedding for query. Cannot perform vector search.");
            return []; // Return empty array if embedding generation failed
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
            const db = await surrealDBClient.getDb()
            const result = await db.query<RetrievedProperty[][]>(surrealQL, { queryEmbedding: queryEmbedding });
            this.logger.debug("query raw result:", JSON.stringify(result, null, 2));
            if (result && Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
                 // Filter results based on cosine_better_than_threshold if score is available
                return result[0]
                    .filter((item: any) => item.score >= this.config.semantic_search_threshold)
            }
            return [];
        } catch (error) {
            this.logger.error("Error during chunk query:", error);
            throw error;
        }
    }

    async keyword_retriever(query: string) {
        const entity_property_pairs = await b.ExtractEP(query)
        this.logger.debug(`extracted EPs: ${JSON.stringify(entity_property_pairs)}`)
    }

    async entity_keyword_retriever(entities: string[]) {
        const db = await surrealDBClient.getDb()
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
                    string::similarity::jaro($keyword, name) > 0.8`, { keyword: e })
            return hit_res[0]
        }))

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
        this.logger.debug(`Matched entities: ${JSON.stringify(hit_properties, null, "\t")}`)

        return hit_properties
    }

    /**
     * Retrieve property documents based on keywords
     * @param query 
     */
    async property_keyword_retriever(query: string) {
        const entity_property_pairs = await b.ExtractEP(query)
        this.logger.debug("extracted EPs:", entity_property_pairs)

        const hit_entities = await this.entity_keyword_retriever(entity_property_pairs.map(e=>e.entity))

        const db = await surrealDBClient.getDb()
        const hit_properties_raw = await Promise.all(entity_property_pairs.map(async (e) => {
            const hit_res = await db.query<RetrievedProperty[][]>(`
                SELECT id, core_entity.id ,core_entity.name, property_name, property_content, (string::similarity::jaro($keyword, property_name)) AS score 
                FROM ${this.config.property_table_name} 
                WHERE 
                    string::similarity::jaro($keyword, property_name) > 0.6
                    AND
                    core_entity.name INSIDE $entities
                FETCH core_entity
                    `, { 
                        keyword: e.property ,
                        entities: hit_entities.map(e=>e.name)
                    })
            return hit_res[0]
        }))

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
        this.logger.debug(JSON.stringify(hit_properties, null, "\t"))

    }

    /**
     * 
     * @param query 
     * @param top_k 
     * @returns 
     */
    async entity_retriever(query: string, top_k: number): Promise<RetrievedEntityRecord[]> {
        
        // Keyword-based graph retrieval
        const keywords = this.keywordExtractor.extractKeywords(query);
        this.logger.debug(`keywords: ${keywords}`)
    
        const combinedResultsMap = new Map<string, RetrievedEntityRecord>();
        const keywordSearchResults: RetrievedEntityRecord[] = [];

        if (keywords.length > 0) {
            const db = await surrealDBClient.getDb();

            try {
                const keywordResult = await Promise.all(keywords.map(async(e)=>{
                    return (await db.query<RetrievedEntityRecord[][]>(`SELECT id, name, description, (string::similarity::jaro($keyword, name)) AS score FROM nodes WHERE string::similarity::jaro($keyword, name) > 0.9`, { keyword: e }))[0];
                }))
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
            this.logger.info(`Retrieve 0 entity according to keywords [${keywords}], start semantic retrieve`)
            const queryEmbedding = await embedding(query);
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
                        semanticSearchResults.push(...result[0].filter((item: any) => item.score >= this.config.semantic_search_threshold));
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

        return finalResults; // Return the final results
    }

    /**
     * 
     * @param query 
     * @param top_k 
     * @returns 
     */
    async get_relations_of_entity(entityId: RecordId): Promise<{
        in_relations: RelationRecord[],
        out_relations: RelationRecord[]
    }>{
        const cacheKey = entityId.toString();
        if (this.relationCache.has(cacheKey)) {
            return this.relationCache.get(cacheKey)!;
        }

        const db = await surrealDBClient.getDb();
        const in_relations = await db.query<RelationRecord[][]>(`SELECT * FROM relation WHERE in = ${entityId};`)
        const out_relations = await db.query<RelationRecord[][]>(`SELECT * FROM relation WHERE out = ${entityId};`)

        const result = {
            in_relations: in_relations[0],
            out_relations: out_relations[0]
        };
        this.relationCache.set(cacheKey, result);
        return result;
    }

    private classifyQuery(query: string): QueryType {
        const { entityQueryPatterns, propertyQueryPatterns } = this.config.hybridRetrieval || this.defaultHybridConfig;
        
        const isEntityQuery = entityQueryPatterns.some(pattern => pattern.test(query));
        const isPropertyQuery = propertyQueryPatterns.some(pattern => pattern.test(query));

        if (isEntityQuery && isPropertyQuery) return 'mixed';
        if (isEntityQuery) return 'entity';
        if (isPropertyQuery) return 'property';
        return 'chunk';
    }

    async hybridRetrieve(query: string, top_k: number, HyDE: boolean = false) {
        // const queryType = this.classifyQuery(query);
        const { entityWeight, propertyWeight, chunkWeight } = this.config.hybridRetrieval || this.defaultHybridConfig;
        let retrieve_query = query

        if(HyDE) {
            retrieve_query = (await b.HyDE_rewrite(query, this.config.language)).HyDE_answer
        }
        
        const [entities, properties, chunks] = await Promise.all([
            this.entity_retriever(retrieve_query, Math.ceil(top_k * entityWeight)),
            this.property_retriever(retrieve_query, Math.ceil(top_k * propertyWeight)),
            this.chunks_retriver(retrieve_query, Math.ceil(top_k * chunkWeight))
        ]);

        return {entities, properties, chunks}
    }
}
