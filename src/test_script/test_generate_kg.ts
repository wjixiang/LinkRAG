import { surrealDBClient } from '../database/surrealdbClient';
import KnowledgeGraphWeaver from '../core/KnowledgeGraphWeaver';
import { RecordId } from 'surrealdb';

async function main() {
    const chunkId: RecordId = new RecordId('chunks_test', '004h1shptt01sc52o0kk'); // Provided chunk ID

    try {
        await surrealDBClient.connect(); // Ensure DB connection is open FIRST

        // Basic configuration for KnowledgeGraphWeaver
        const config = {
            chunkTableName: 'chunks_test', // Assuming this is the correct chunk table name
            embeddingConcurrencyLimit: 5, // Reasonable concurrency limit
        };

        const kgWeaver = new KnowledgeGraphWeaver(config);

        console.log(`Starting knowledge graph generation for chunk ID: ${chunkId}`);
        await kgWeaver.generate_kg(chunkId);
        console.log(`Knowledge graph generation completed for chunk ID: ${chunkId}`);
    } catch (error) {
        console.error(`Error during knowledge graph generation:`, error);
    } finally {
        await surrealDBClient.close(); // Close DB connection
    }
}

main();