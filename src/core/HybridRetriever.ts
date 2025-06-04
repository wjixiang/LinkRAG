import { KnowledgeBaseRetrieverConfig } from "./KnowledgeBaseRetriever";
import { EntityRetriever } from "./EntityRetriever";
import { PropertyRetriever } from "./PropertyRetriever";
import { ChunkRetriever } from "./ChunkRetriever";
import { b } from "baml_client/async_client";
import winston from 'winston';
import createLoggerWithPrefix from "../lib/console/logger";
type QueryType = 'entity' | 'property' | 'chunk' | 'mixed';

export type RetrievalResult = {
    content: string;
    score: number;
    type: 'entity' | 'property' | 'chunk';
    source: string;
};

export class HybridRetriever {
    private entityRetriever: EntityRetriever;
    private propertyRetriever: PropertyRetriever;
    private chunkRetriever: ChunkRetriever;
    private config: KnowledgeBaseRetrieverConfig;
    private logger: winston.Logger;

    constructor(config: KnowledgeBaseRetrieverConfig) {
        this.config = config;
        this.entityRetriever = new EntityRetriever(config);
        this.propertyRetriever = new PropertyRetriever(config);
        this.chunkRetriever = new ChunkRetriever(config);
        this.logger = createLoggerWithPrefix('HybridRetriever');
    }

    private classifyQuery(query: string): QueryType {
        const { entityQueryPatterns, propertyQueryPatterns } = this.config.hybridRetrieval!;
        
        const isEntityQuery = entityQueryPatterns.some(pattern => pattern.test(query));
        const isPropertyQuery = propertyQueryPatterns.some(pattern => pattern.test(query));

        if (isEntityQuery && isPropertyQuery) return 'mixed';
        if (isEntityQuery) return 'entity';
        if (isPropertyQuery) return 'property';
        return 'chunk';
    }

    async retrieve(query: string, top_k: number, HyDE: boolean = false): Promise<{
        entities: RetrievalResult[],
        properties: RetrievalResult[],
        chunks: RetrievalResult[]
    }> {
        const { entityWeight, propertyWeight, chunkWeight } = this.config.hybridRetrieval!;
        let retrieve_query = query;

        if (HyDE) {
            retrieve_query = (await b.HyDE_rewrite(query, this.config.language)).HyDE_answer;
        }
        
        const [entities, properties, chunks] = await Promise.all([
            this.entityRetriever.retrieve(retrieve_query, Math.ceil(top_k * entityWeight)),
            this.propertyRetriever.retrieve(retrieve_query, Math.ceil(top_k * propertyWeight)),
            this.chunkRetriever.retrieve(retrieve_query, Math.ceil(top_k * chunkWeight))
        ]);

        // Map results to RetrievalResult format
        const mappedEntities: RetrievalResult[] = entities.map(e => ({
            content: e.description || e.name, // Assuming entities have name or description
            score: e.score,
            type: 'entity',
            source: e.id.toString()
        }));

        const mappedProperties: RetrievalResult[] = properties.map(p => ({
            content: p.property_content,
            score: p.score,
            type: 'property',
            source: p.id.toString()
        }));

        const mappedChunks: RetrievalResult[] = chunks.map(c => ({
            content: c.document.content,
            score: c.score,
            type: 'chunk',
            source: c.document.id.toString()
        }));

        return {
            entities: mappedEntities,
            properties: mappedProperties,
            chunks: mappedChunks
        };
    }

    // Expose specific retriever methods if needed by KnowledgeBaseRetriever
    public getEntityRetriever(): EntityRetriever {
        return this.entityRetriever;
    }

    public getPropertyRetriever(): PropertyRetriever {
        return this.propertyRetriever;
    }

    public getChunkRetriever(): ChunkRetriever {
        return this.chunkRetriever;
    }
}