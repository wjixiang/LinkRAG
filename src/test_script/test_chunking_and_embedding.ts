import KnowledgeGraphWeaver, { KnowledgeGraphWeaverConfig } from '../core/KnowledgeGraphWeaver';
import { RecordId } from 'surrealdb';
import { surrealDBClient } from '../database/surrrealdbClient';
import Logger from '../lib/console/logger';

const logger = new Logger('TestChunkingAndEmbedding');

async function runTest() {
    try {
        // Initialize SurrealDB client
        logger.debug('Attempting to connect to SurrealDB...');
        await surrealDBClient.connect();
        logger.info('Connected to SurrealDB.');
        logger.debug('Successfully connected to SurrealDB.');

        // KnowledgeGraphWeaver configuration
        const config: KnowledgeGraphWeaverConfig = {
            chunkTableName: 'chunks_test', // Use a test table name
            embeddingConcurrencyLimit: 5,
            // Add other config if needed
        };

        // Instantiate KnowledgeGraphWeaver
        logger.debug('Instantiating KnowledgeGraphWeaver with config:', config);
        const weaver = new KnowledgeGraphWeaver(config);
        logger.info('KnowledgeGraphWeaver instantiated.');
        logger.debug('KnowledgeGraphWeaver successfully instantiated.');

        // Input RecordId
        const inputId: RecordId = new RecordId(  'reference_documents',  'qm2tqmu4wvpx2epwa2qe' )
        logger.info(`Using input ID: ${inputId}`);

        // Call the chunking_and_embedding method
        logger.info('Calling chunking_and_embedding...');
        logger.debug(`Calling chunking_and_embedding with inputId: ${inputId}`);
        await weaver.chunking_and_embedding(inputId);
        logger.info('chunking_and_embedding finished.');
        logger.debug('chunking_and_embedding call completed.');

    } catch (error) {
        logger.error('An error occurred during the test:', error);
    } finally {
        // Disconnect from SurrealDB
        logger.debug('Attempting to disconnect from SurrealDB...');
        await surrealDBClient.close();
        logger.info('Disconnected from SurrealDB.');
        logger.debug('Successfully disconnected from SurrealDB.');
    }
}

runTest();