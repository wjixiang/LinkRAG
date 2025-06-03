import { RecordId } from 'surrealdb';
import { Entity, Property, b } from 'baml_client';
import { default as ChunkStorage } from '../database/chunkStorage';
import { entity_type } from '@/promp';
import winston from 'winston';
import createLoggerWithPrefix from '../lib/console/logger';

export class EntityExtractor {
    private logger: winston.Logger;
    private chunkStorage: ChunkStorage;

    constructor(chunkStorage: ChunkStorage) {
        this.chunkStorage = chunkStorage;
        this.logger = createLoggerWithPrefix('EntityExtractor');
    }

    async extract_entities_from_content(content: string) {
        try {
            const result = await b.ExtractEntity(content, entity_type);
            this.logger.info(`Extracted ${result.length} entities`)
            return result
        } catch (error) {
            this.logger.error(`Error during entities extraction: ${error}`);
            throw error;
        }
    }

    async extract_entities_from_property(core_entity:Entity, property: Property) {
        try {
            const result = await b.ExtractEntityFromProperty(core_entity.name,property.prop_name, property.content, entity_type);
            this.logger.info(`Extracted ${result.length} entities`)
            return result
        } catch (error) {
            this.logger.error(`Error during entities extraction: ${error}`);
            throw error;
        }
    }

    async extract_entities_from_chunk(chunkId: RecordId): Promise<Entity[]> {
        const chunk_tobe_extracted = await this.chunkStorage.get_by_id(chunkId);
        if (chunk_tobe_extracted) {
            try {
                this.logger.info(`Starting entities extraction for chunk: ${chunkId}`);
                const result = await b.ExtractEntity(chunk_tobe_extracted.content, entity_type);
                return result;
            } catch (error) {
                this.logger.error(`Error during entities extraction: ${error}`);
                throw error;
            }
        } else {
            this.logger.error(`Chunk with ID ${chunkId} not found for entity extraction.`);
            throw new Error(`Chunk with ID ${chunkId} not found for entity extraction.`);
        }
    }
}