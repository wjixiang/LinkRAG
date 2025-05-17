import { RecordId } from 'surrealdb';
import { Entity } from 'baml_client';
import { default as ChunkStorage } from '../database/chunkStorage';
import entities_extraction_workflow from '@/lib/llm_workflow/entities_extraction_workflow';
import { entity_type } from '@/promp';
import Logger from '../lib/console/logger';

export class EntityExtractor {
    private logger: Logger;
    private chunkStorage: ChunkStorage;

    constructor(chunkStorage: ChunkStorage) {
        this.chunkStorage = chunkStorage;
        this.logger = new Logger('EntityExtractor');
    }

    async extractEntities(chunkId: RecordId): Promise<Entity[]> {
        const chunk_tobe_extracted = await this.chunkStorage.get_by_id(chunkId);
        if (chunk_tobe_extracted) {
            const extractedEntities = await entities_extraction_workflow(chunk_tobe_extracted.content, entity_type);
            return extractedEntities;
        } else {
            this.logger.error(`Chunk with ID ${chunkId} not found for entity extraction.`);
            throw new Error(`Chunk with ID ${chunkId} not found for entity extraction.`);
        }
    }
}