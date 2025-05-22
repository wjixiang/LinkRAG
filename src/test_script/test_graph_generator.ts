import { RecordId } from 'surrealdb';
import { surrealDBClient } from '../database/surrealdbClient';
import EntityStorage from '../database/EntityStorage';
import ChunkStorage from '../database/chunkStorage';
import { GraphGenerator } from '../core/GraphGenerator';
import Logger from '../lib/console/logger';

async function main() {
    // Initialize required components
    const db = await surrealDBClient.getDb();
    const entityStorage = new EntityStorage(db, 'entities_test');
    const chunkStorage = new ChunkStorage(db, 'chunk', async () => [], 0.2);
    const logger = new Logger('TestGraphGenerator');

    // GraphGenerator config
    const config = {
        relation_table_name: 'relation_test',
        reference_table_name: 'references_test'
    };

    // Create GraphGenerator instance
    const graphGenerator = new GraphGenerator(entityStorage, chunkStorage, config);

    // Test with a sample chunk ID
    try {
        const testChunkId = new RecordId('chunk', '0qq2ykjxo8y40b7mflql');
        logger.info(`Starting graph generation for chunk: ${testChunkId.toString()}`);
        
        await graphGenerator.generateGraph(testChunkId);
        
        logger.info('Graph generation completed successfully');
    } catch (error) {
        logger.error('Error during graph generation:', error);
    } finally {
        await db.close();
    }
}

main().catch(console.error);
