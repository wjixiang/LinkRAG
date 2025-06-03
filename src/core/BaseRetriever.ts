import winston from 'winston';
import createLoggerWithPrefix from "../lib/console/logger";
import { embedding } from "@/lib/embedding";
import { KnowledgeGraphRetrieverConfig } from "./KnowledgeGraphRetriever";

export abstract class BaseRetriever {
    protected logger: winston.Logger;
    protected config: KnowledgeGraphRetrieverConfig;

    constructor(config: KnowledgeGraphRetrieverConfig, loggerName: string) {
        this.config = config;
        this.logger = createLoggerWithPrefix(loggerName);
    }

    protected async getQueryEmbedding(query: string): Promise<number[] | null> {
        const queryEmbedding = await embedding(query);
        if (queryEmbedding === null) {
            this.logger.error("Failed to generate embedding for query. Cannot perform vector search.");
            return null;
        }
        return queryEmbedding as number[];
    }

    protected filterResultsByScore<T extends { score: number }>(results: T[]): T[] {
        return results.filter(item => item.score >= this.config.semantic_search_threshold);
    }

    public abstract retrieve(query: string, top_k: number): Promise<any[]>;
}