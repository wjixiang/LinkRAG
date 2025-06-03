import { surrealDBClient } from "@/database/surrealdbClient";
import { semanticSearchResult, ChunkDocument } from "../database/chunkStorage";
import { BaseRetriever } from "./BaseRetriever";
import { KnowledgeGraphRetrieverConfig } from "./KnowledgeGraphRetriever";

export class ChunkRetriever extends BaseRetriever {
    constructor(config: KnowledgeGraphRetrieverConfig) {
        super(config, 'ChunkRetriever');
    }

    async retrieve(query: string, top_k: number): Promise<semanticSearchResult[]> {
        const queryEmbedding = await this.getQueryEmbedding(query);

        if (queryEmbedding === null) {
            return [];
        }

        let surrealQL = `
            SELECT id, referenceIds, content, vector::similarity::cosine(embedding, ${JSON.stringify(queryEmbedding)}) AS score
            FROM ${this.config.chunkTableName}
        `;

        surrealQL += `
            ORDER BY score DESC
            LIMIT ${top_k};
        `;

        const db = await surrealDBClient.getDb();

        try {
            const result = await db.query<[][]>(surrealQL);
            this.logger.info(`Retrieved ${result[0].length} chunks`);
            if (result && Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
                const filteredResults = this.filterResultsByScore(
                    (result[0] as (ChunkDocument & { score: number })[])
                );
                return filteredResults.map(item => ({
                    document: {
                        id: item.id,
                        referenceIds: item.referenceIds,
                        content: item.content,
                        ...Object.fromEntries(Object.entries(item).filter(([key]) => !['id', 'referenceIds', 'content', 'embedding', 'score'].includes(key)))
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
}