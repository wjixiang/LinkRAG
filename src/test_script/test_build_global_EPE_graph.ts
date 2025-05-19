import { KnowledgeGraphWeaver_config } from '@/settings';
import KnowledgeGraphWeaver from '../core/KnowledgeGraphWeaver';
import { surrealDBClient } from '../database/surrealdbClient';
import Logger from '../lib/console/logger';

const logger = new Logger('test_build_global_EPE_graph');

async function main() {
    try {
        // Get database connection
        await surrealDBClient.connect()
        await surrealDBClient.getDb();

        // Create weaver with test config
        const weaver = new KnowledgeGraphWeaver(KnowledgeGraphWeaver_config);

        logger.info('Starting to build global EPE graph...');
        
        // Execute the function we want to test
        await weaver.build_global_EPE_graph();

        logger.info('Successfully built global EPE graph');
    } catch (error) {
        logger.error('Test failed:', error);
    } finally {
        // Close database connection
        await surrealDBClient.close();
        process.exit(0);
    }
}

main();