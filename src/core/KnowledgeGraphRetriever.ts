import ChunkStorage, { ChunkDocument } from "../database/chunkStorage";
import ReferenceDocumentStorage from "../database/referenceDocumentStorage";
import Logger from "../lib/console/logger";

export interface KnowledgeGraphRetrieverConfig {
    chunkTableName: string;
    chunkStorage: ChunkStorage;
    
}

export default class KnowledgeGraphRetriever {
    private logger: Logger;
    private referenceDocumentStorage: ReferenceDocumentStorage;
    private chunkStorage: ChunkStorage;

    constructor(config: KnowledgeGraphRetrieverConfig) {
        this.logger = new Logger('KnowledgeGraphRetriever');
        this.referenceDocumentStorage = new ReferenceDocumentStorage();
        this.chunkStorage = config.chunkStorage
    }

    async chunks_retriver(query: string, top_k: number): Promise<ChunkDocument[]> {
        // Use the query method from ChunkStorage which handles embedding and vector search
        const retrievedChunks = await this.chunkStorage.query(query, top_k);

        return retrievedChunks;
    }


}