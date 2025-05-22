import { RecordId } from 'surrealdb';
import { Entity, Relation } from 'baml_client';
import { default as ChunkStorage } from '../database/chunkStorage';
import relations_extract_workflow from '@/lib/llm_workflow/relations_extract_workflow';
import Logger from '../lib/console/logger';

export class RelationExtractor {
    private logger: Logger;
    private chunkStorage: ChunkStorage;

    constructor(chunkStorage: ChunkStorage) {
        this.chunkStorage = chunkStorage;
        this.logger = new Logger('RelationExtractor');
    }

    async extractRelations(chunkId: RecordId, entities: Entity[]): Promise<Relation[]> {
        const chunk_tobe_extracted = await this.chunkStorage.get_by_id(chunkId);
        if (!chunk_tobe_extracted) {
            this.logger.error(`Chunk with ID ${chunkId} not found for relation extraction.`);
            return [];
        }
        this.logger.debug(`Starting relation extraction for ID: ${chunkId} with entities: ${JSON.stringify(entities.map(e=>e.name))}`);
        const relations = await relations_extract_workflow(chunk_tobe_extracted.content, entities, 'zh');
        this.logger.debug(`Finished relation extraction. Extracted relations: ${JSON.stringify(relations)}`);
        return relations;
    }
}