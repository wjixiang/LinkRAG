import KnowledgeGraphWeaver, { KnowledgeGraphWeaverConfig } from '../core/KnowledgeGraphWeaver';
import Logger from '../lib/console/logger';
import { surrealDBClient } from '../database/surrrealdbClient';

const logger = new Logger('TestSaveKnowledgeGraph');

async function runTest() {
    logger.info('Starting test for save_to_reference_document_storage');

    try {
        await surrealDBClient.connect();
        logger.info('SurrealDB connected.');

        const config: KnowledgeGraphWeaverConfig = {
            chunkTableName: 'test_chunks', // Placeholder table name for testing
            embeddingConcurrencyLimit: 5, // Placeholder concurrency limit
        };

        const weaver = new KnowledgeGraphWeaver(config);
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