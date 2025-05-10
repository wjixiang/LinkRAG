import Logger from '../lib/console/logger';
import { surrealDBClient } from '../database/surrrealdbClient';
import { gte_Qwen2_7B_instruct_Embedding } from '../lib/embedding';
import ChunkStorage, { ChunkDocument, EmbeddingFunc } from '../database/chunkStorage';

const logger = new Logger('TestChunkStorage');

async function testChunkStorage() {
    try {
        // Initialize SurrealDB connection using the client
        await surrealDBClient.connect();
        const db = surrealDBClient.getDb();

        const testTableName = 'chunks_test';
        const chunkStorage = new ChunkStorage(db, testTableName, gte_Qwen2_7B_instruct_Embedding, 0.1); // Use actual embedding function

        // Define test data
        const testChunksContent = {
            'chunk1': {
                referenceIds: ['doc1'],
                content: 'This is the first test chunk about apples.',
                extra_info: 'info1'
            },
            'chunk2': {
                referenceIds: ['doc1', 'doc2'],
                content: 'This is the second test chunk mentioning bananas.',
                extra_info: 'info2'
            },
            'chunk3': {
                referenceIds: ['doc3'],
                content: 'A third chunk discussing fruits like apples and oranges.',
                extra_info: 'info3'
            },
        };

        // Generate embeddings for test chunks
        const testChunks: Record<string, Omit<ChunkDocument, 'id'>> = {};
        for (const [id, data] of Object.entries(testChunksContent)) {
            const embedding = await gte_Qwen2_7B_instruct_Embedding(data.content);
            if (embedding === null) {
                logger.error(`Failed to generate embedding for chunk ${id}. Skipping upsert.`);
                // Depending on requirements, you might want to throw an error or handle this differently
                continue;
            }
            testChunks[id] = {
                ...data,
                embedding: embedding,
            };
        }


        if (Object.keys(testChunks).length === 0) {
            logger.error('No chunks to upsert because embedding generation failed.');
            return; // Exit if no chunks could be embedded
        }

        logger.info(`Upserting ${Object.keys(testChunks).length} test chunks...`);
        await chunkStorage.upsert(testChunks);
        logger.info('Upsert complete.');

        // Test query functionality
        const queryText = 'Tell me about fruits';
        const topK = 2;
        logger.info(`Querying for "${queryText}" with top_k=${topK}...`);
        const queryResults = await chunkStorage.query(queryText, topK);
        logger.info('Query results:', JSON.stringify(queryResults, null, 2));

        // Assertions for the first query
        if (queryResults.length > 0) {
            logger.info('Query for "Tell me about fruits" returned results. Test successful.');
            // Add more specific assertions here if needed, e.g., checking for expected chunk IDs
            const returnedIds = queryResults.map(chunk => chunk.id);
            logger.info('Returned chunk IDs:', returnedIds);
            if (returnedIds.includes('chunk1') || returnedIds.includes('chunk3')) {
                logger.info('Query results include expected fruit chunks.');
            } else {
                logger.info('Query results might not include expected fruit chunks.');
            }
        } else {
            logger.info('Query for "Tell me about fruits" returned no results. Test might have issues.');
        }

        // Add more query test cases
        const queryText2 = 'bananas';
        const topK2 = 1;
        logger.info(`Querying for "${queryText2}" with top_k=${topK2}...`);
        const queryResults2 = await chunkStorage.query(queryText2, topK2);
        logger.info('Query results for "bananas":', JSON.stringify(queryResults2, null, 2));

        if (queryResults2.length > 0 && queryResults2[0].id === 'chunk2') {
            logger.info('Query for "bananas" returned expected chunk2. Test successful.');
        } else {
            logger.info('Query for "bananas" did not return expected chunk2. Test might have issues.');
        }

        const queryText3 = 'oranges';
        const topK3 = 1;
        logger.info(`Querying for "${queryText3}" with top_k=${topK3}...`);
        const queryResults3 = await chunkStorage.query(queryText3, topK3);
        logger.info('Query results for "oranges":', JSON.stringify(queryResults3, null, 2));

        if (queryResults3.length > 0 && queryResults3[0].id === 'chunk3') {
            logger.info('Query for "oranges" returned expected chunk3. Test successful.');
        } else {
            logger.info('Query for "oranges" did not return expected chunk3. Test might have issues.');
        }

        // Test get_by_id
        const chunk1 = await chunkStorage.get_by_id('chunk1');
        logger.info('Get chunk1 by id:', JSON.stringify(chunk1?.content, null, 2));
        if (chunk1 && chunk1.content === testChunks.chunk1.content) {
            logger.info('get_by_id test successful.');
        } else {
            logger.info('get_by_id test failed.');
        }

        // Test get_by_ids
        const chunksByIds = await chunkStorage.get_by_ids(['chunk1', 'chunk3']);
        logger.info('Get chunks by ids [chunk1, chunk3]:', JSON.stringify(chunksByIds, null, 2));
         if (chunksByIds.length === 2) {
            logger.info('get_by_ids test successful.');
        } else {
            logger.info('get_by_ids test failed.');
        }


        // Test delete_by_ids
        logger.info('Deleting chunks chunk1 and chunk2...');
        await chunkStorage.delete_by_ids(['chunk1', 'chunk2']);
        logger.info('Delete complete.');

        // Verify deletion
        const remainingChunks = await chunkStorage.read();
        logger.info('Remaining chunks after deletion:', JSON.stringify(remainingChunks, null, 2));
        if (remainingChunks.length === 1 && remainingChunks[0].id?.includes('chunk3')) {
             logger.info('delete_by_ids test successful.');
        } else {
             logger.info('delete_by_ids test failed.');
        }


    } catch (error) {
        logger.error('An error occurred during the test:', error);
    } finally {
        // Close the connection
        await surrealDBClient.close();
        logger.info('Database connection closed.');
    }
}

testChunkStorage();