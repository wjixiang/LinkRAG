import winston from 'winston';
import createLoggerWithPrefix from "../lib/console/logger";
import { EntityRecord, language, PropertyRecord } from "@/type";
import { HybridRetriever } from "./HybridRetriever";
import { RecordId } from "surrealdb";
import { RetrievalResult } from "./HybridRetriever"; // Import RetrievalResult from HybridRetriever
import { surrealDBClient } from '@/database/surrealdbClient';

export interface OutlineTree {
    root: PropertyRecord;
    leaf: OutlineTree[] | EntityRecord[] 
}

interface HybridRetrievalConfig {
    entityWeight: number;
    propertyWeight: number;
    chunkWeight: number;
    entityQueryPatterns: RegExp[];
    propertyQueryPatterns: RegExp[];
}

export interface KnowledgeBaseRetrieverConfig {
    chunkTableName: string;
    property_table_name: string;
    entity_table_name: string;
    semantic_search_threshold: number;
    language: language;
    hybridRetrieval?: HybridRetrievalConfig;
}

export default class KnowledgeBaseRetriever {
    private logger: winston.Logger;
    config: KnowledgeBaseRetrieverConfig;
    private hybridRetriever: HybridRetriever;
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

    constructor(config: KnowledgeBaseRetrieverConfig) {
        this.logger = createLoggerWithPrefix('KnowledgeBaseRetriever');
        this.config = {
            ...config,
            hybridRetrieval: {
                ...this.defaultHybridConfig,
                ...config.hybridRetrieval
            }
        };
        this.hybridRetriever = new HybridRetriever(this.config);
    }

    // Expose methods from specialized retrievers through the main class
    public async chunks_retriver(query: string, top_k: number) {
        return this.hybridRetriever.getChunkRetriever().retrieve(query, top_k);
    }

    public async property_retriever(query: string, top_k: number) {
        return this.hybridRetriever.getPropertyRetriever().retrieve(query, top_k);
    }

    public async entity_retriever(query: string, top_k: number) {
        return this.hybridRetriever.getEntityRetriever().retrieve(query, top_k);
    }

    public async get_relations_of_entity(entityId: RecordId) {
        return this.hybridRetriever.getEntityRetriever().get_relations_of_entity(entityId);
    }

    public async entity_keyword_retriever(entities: string[]) {
        return this.hybridRetriever.getEntityRetriever().entity_keyword_retriever(entities);
    }

    public async property_keyword_retriever(query: string, hit_entities_names: string[]) {
        return this.hybridRetriever.getPropertyRetriever().property_keyword_retriever(query, hit_entities_names);
    }

    async hybridRetrieve(query: string, top_k: number, HyDE: boolean = false) {
        return this.hybridRetriever.retrieve(query, top_k, HyDE);
    }

    /**
     * Generate EPA outline of input property
     * @param propertyId 
     */
    async outline_property(propertyId: RecordId) {
        const db = await surrealDBClient.getDb()
        const query = `SELECT core_entity.name AS entity_name ,prop_name, ->superset->nodes.name AS subentity_name FROM property WHERE id == $propertyId`
        const outline = (await db.query<{
            entity_name: string,
            subentity_name: string[],
            prop_name: string
        }[][]>(query, {propertyId: propertyId}))[0][0]

        this.logger.info(`Retrieved local EPA outline: \n ${JSON.stringify(outline,null,"  ")}`)
    }
}
