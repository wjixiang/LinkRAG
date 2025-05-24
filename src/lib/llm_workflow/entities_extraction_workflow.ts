import { b, Entity } from '../../../baml_client';
import winston from 'winston';
import createLoggerWithPrefix from '../console/logger';

export default async function entities_extraction_workflow(content: string, entity_type: string[]): Promise<Entity[]> {
    const logger = createLoggerWithPrefix('entities_extraction_workflow');
    try {
        logger.info(`Starting entities extraction workflow for content: ${content}`);
        const result = await b.ExtractEntity(content,entity_type);
        // logger.debug(`Entities extraction result: ${result}`);
        return result;
    } catch (error) {
        logger.error(`Error during entities extraction workflow: ${error}`);
        throw error; // Rethrow the error for further handling
    }
}