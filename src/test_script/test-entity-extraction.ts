import { EntityExtractor } from '../core/EntityExtractor';
import ChunkStorage from '../database/chunkStorage';
import { RecordId } from 'surrealdb';
import { surrealDBClient } from '../database/surrealdbClient';
import { embedding } from '../lib/embedding';

async function main() {
    try {
        // Initialize SurrealDB client
        const db = await surrealDBClient.getDb();
        
        // Initialize ChunkStorage with required dependencies
        const chunkStorage = new ChunkStorage(
            db,
            'chunk', // table name
            embedding, // embedding function
            0.2, // cosine threshold
            new Set() // meta fields
        );
        
        const entityExtractor = new EntityExtractor(chunkStorage);

        // Create a proper RecordId object
        const testChunkId = new RecordId("chunk","0qq2ykjxo8y40b7mflql");
        
        console.log('Testing entity extraction with chunk ID:', testChunkId);
        const entities = await entityExtractor.extractEntities(testChunkId);
        console.log('Successfully extracted entities:', entities);
    } catch (error) {
        console.error('Error in entity extraction test:', error);
        process.exit(1);
    } finally {
        await surrealDBClient.close();
        process.exit(0);
    }
}

main();