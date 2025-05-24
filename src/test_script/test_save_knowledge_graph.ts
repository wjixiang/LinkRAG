import KnowledgeGraphWeaver, { KnowledgeGraphWeaverConfig } from '../core/KnowledgeGraphWeaver';
import winston from 'winston';
import createLoggerWithPrefix from '../lib/console/logger';
import { surrealDBClient } from '../database/surrealdbClient';
import { KnowledgeGraphWeaver_config } from '@/settings';

const logger = createLoggerWithPrefix('TestSaveKnowledgeGraph');

async function runTest() {
    logger.info('Starting test for save_to_reference_document_storage');

    try {
        await surrealDBClient.connect();
        logger.info('SurrealDB connected.');

  
        const weaver = new KnowledgeGraphWeaver(KnowledgeGraphWeaver_config);
        const filePath = '/Users/a123/Documents/GitHub/LinkRAG/textbook/pathology.txt'; // Use the absolute path

        const documentId = await weaver.save_to_reference_document_storage(filePath);

        if (documentId) {
            logger.info(`Successfully saved document with ID: ${documentId}`);
        } else {
            logger.error('Failed to save document.');
        }
    } catch (error) {
        logger.error('An error occurred during the test:', error);
    } finally {
        await surrealDBClient.close();
        logger.info('SurrealDB connection closed.');
    }

    logger.info('Test finished.');
}

runTest();