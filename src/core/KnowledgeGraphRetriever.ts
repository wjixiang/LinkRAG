import { RecordId } from "surrealdb";
import ChunkStorage, { ChunkDocument, semanticSearchResult } from "../database/chunkStorage";
import ReferenceDocumentStorage from "../database/referenceDocumentStorage";
import Logger from "../lib/console/logger";
import { surrealDBClient } from "@/database/surrealdbClient";
import { RelationRecord } from "@/type";

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

    async chunks_retriver(query: string, top_k: number): Promise<semanticSearchResult[]> {
        // Use the query method from ChunkStorage which handles embedding and vector search
        const retrievedChunks = await this.chunkStorage.query(query, top_k);
        this.logger.info(`Retrieved ${retrievedChunks.length} chunks`)
        return retrievedChunks;
    }

    async get_keyword_from_query(query: string) {

    }

    async get_relations_of_entity(entityId: RecordId): Promise<{
        in_relations: RelationRecord[],
        out_relations: RelationRecord[]
    }>{
        const db = await surrealDBClient.getDb();
        const in_relations = await db.query<RelationRecord[][]>(`SELECT * FROM relation WHERE in = ${entityId};`)
        const out_relations = await db.query<RelationRecord[][]>(`SELECT * FROM relation WHERE out = ${entityId};`)

        return {
            in_relations: in_relations[0],
            out_relations: out_relations[0]
        }
    }


}