import KnowledgeGraphRetriever from '../core/KnowledgeGraphRetriever';
import { surrealDBClient } from '../database/surrealdbClient';
import createLoggerWithPrefix from '../lib/console/logger';
import { KnowledgeGraphRetriever_Config } from '@/settings';

const logger = createLoggerWithPrefix('test_property_keyword_retriever');

async function testPropertyKeywordRetriever() {
    try {
        // Initialize SurrealDB client
        await surrealDBClient.connect();
        logger.info('Connected to SurrealDB.');



        const retriever = new KnowledgeGraphRetriever(KnowledgeGraphRetriever_Config);
        logger.info('KnowledgeGraphRetriever initialized.');

        // Test query
        const query = "皮肌炎的症状";
        logger.info(`Testing property_keyword_retriever with query: "${query}"`);

        await retriever.property_keyword_retriever(query);

        logger.info('property_keyword_retriever test completed.');

    } catch (error) {
        logger.error('Error during test:', error);
    } finally {
        // Ensure to close the SurrealDB connection
        await surrealDBClient.close();
        logger.info('Disconnected from SurrealDB.');
        process.exit(0);
    }
}

testPropertyKeywordRetriever();