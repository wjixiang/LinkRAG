import { surrealDBClient } from '../database/surrealdbClient';
import KnowledgeGraphWeaver from '../core/KnowledgeGraphWeaver';
import { RecordId } from 'surrealdb';
import pLimit from 'p-limit';

async function main() {
    try {
        await surrealDBClient.connect(); // Ensure DB connection is open FIRST

        // Basic configuration for KnowledgeGraphWeaver
        const config = {
            chunkTableName: 'chunks_test', // Assuming this is the correct chunk table name
            embeddingConcurrencyLimit: 20, // Reasonable concurrency limit
            relation_table_name: "relation"
        };

        const kgWeaver = new KnowledgeGraphWeaver(config);
        // Wait for storage initialization
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Query for RecordIds matching the criteria
        interface QueryResult {
            id: RecordId;
        }
        
        const db = await surrealDBClient.getDb();
        const result = await db.query<QueryResult[][]>(
            `SELECT id FROM chunks_test WHERE referenceIds CONTAINS "qm2tqmu4wvpx2epwa2qe"`
        );
        
        if (!result || result.length === 0) {
            console.log('No matching chunks found');
            return;
        }

        const recordIds = (result[0]).map((r: QueryResult) => r.id);
        console.log(`Found ${(recordIds).length} chunks to process`);

        // Process RecordIds concurrently with p-limit
        const limit = pLimit(config.embeddingConcurrencyLimit);
        await Promise.all(recordIds.map(recordId =>
            limit(async () => {
                try {
                    console.log(`Starting knowledge graph generation for chunk ID: ${recordId}`);
                    await kgWeaver.generate_kg(recordId);
                    console.log(`Knowledge graph generation completed for chunk ID: ${recordId}`);
                } catch (error) {
                    console.error(`Error processing chunk ${recordId}:`, error);
                }
            })
        ));
    } catch (error) {
        console.error(`Error during knowledge graph generation:`, error);
    } finally {
        await surrealDBClient.close(); // Close DB connection
    }
}

main();