import ChunkStorage from "../database/chunkStorage";
import ReferenceDocumentStorage from "../database/referenceDocumentStorage";
import Logger from "../lib/console/logger";

export interface KnowledgeGraphRetrieverConfig {
    chunkTableName: string;
    chunkStorage: ChunkStorage;
    // Add other configuration options as needed, e.g., chunking options
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

    
}