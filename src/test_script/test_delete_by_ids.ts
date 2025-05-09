import { Surreal } from 'surrealdb';
import ChunkStorage, { ChunkDocument, EmbeddingFunc } from '../database/chunkStorage';
import Logger from '../lib/console/logger';

// Mock SurrealDB client
// We use 'any' for simplicity in this test script to avoid complex type mocking
const mockDb: any = {
    // Mock the query method to simulate deletion
    query: async (surrealQL: string) => {
        console.log(`Mock DB Query: ${surrealQL}`);
        // In a real test, you would manipulate a mock data structure here
        // For this simple script, we just log the query
        return [[{ status: 'OK' }]]; // Simulate a successful deletion response
    },
    // Add other necessary mock methods if needed for setup (e.g., create, select)
    create: async (thing: string, data: any) => {
        console.log(`Mock DB Create: Thing=${thing}, Data=${JSON.stringify(data)}`);
        // Simulate creating a record with a RecordId structure
        // The actual structure might be more complex, but this is enough for the test
        return [{ id: { tb: thing.split(':')[0], id: `mock_id_${Math.random().toString(36).substring(7)}` }, ...data }];
    },
    select: async (thing: string) => {
         console.log(`Mock DB Select: Thing=${thing}`);
         // Simulate selecting a record - return empty for deleted items
         return [];
    }
};

// Mock Embedding Function
const mockEmbeddingFunc: EmbeddingFunc = async (text: string) => {
    // Return a dummy embedding
    return [0.1, 0.2, 0.3];
};

const logger = new Logger('TestDeleteByIds');
const tableName = 'test_chunks';
const chunkStorage = new ChunkStorage(mockDb as Surreal, tableName, mockEmbeddingFunc);

async function runTest() {
    logger.info('Starting delete_by_ids test...');

    // 1. Create some dummy chunks
    const dummyChunks: Omit<ChunkDocument, 'id'>[] = [
        { referenceIds: ['ref1'], embedding: [0.1, 0.2, 0.3], content: 'Chunk 1 content' },
        { referenceIds: ['ref2'], embedding: [0.4, 0.5, 0.6], content: 'Chunk 2 content' },
        { referenceIds: ['ref3'], embedding: [0.7, 0.8, 0.9], content: 'Chunk 3 content' },
    ];

    logger.info('Creating dummy chunks...');
    // Using the mock create method to simulate adding data
    const createdChunks = [];
    for (const chunk of dummyChunks) {
        const result = await (mockDb as Surreal).create(tableName, chunk);
        createdChunks.push(result[0]);
    }
    logger.info(`Created ${createdChunks.length} dummy chunks.`);
    // Extract just the ID part, handling the RecordId type
    const createdIds = createdChunks.map(chunk => (chunk.id as any).id);

    logger.info(`Dummy chunk IDs created: ${createdIds.join(', ')}`);

    // 2. Select some IDs to delete
    const idsToDelete = [createdIds[0], createdIds[2]]; // Delete chunk 1 and chunk 3

    logger.info(`Attempting to delete chunks with IDs: ${idsToDelete.join(', ')}`);

    // 3. Call delete_by_ids
    await chunkStorage.delete_by_ids(idsToDelete);

    logger.info('delete_by_ids method called.');

    // 4. Verify deletion (using mock select)
    logger.info('Verifying deletion...');
    const remainingChunks = await chunkStorage.get_by_ids(createdIds); // Try to get all original IDs

    if (remainingChunks.length === createdChunks.length - idsToDelete.length) {
        logger.info('Verification successful: Correct number of chunks remaining.');
    } else {
        logger.error(`Verification failed: Expected ${createdChunks.length - idsToDelete.length} chunks, but found ${remainingChunks.length}.`);
    }

    logger.info('delete_by_ids test finished.');
}

// Run the test in a loop
const numberOfTests = 5; // You can change this number
async function runTestsInLoop() {
    for (let i = 0; i < numberOfTests; i++) {
        logger.info(`--- Running test iteration ${i + 1}/${numberOfTests} ---`);
        await runTest();
        logger.info(`--- Finished test iteration ${i + 1}/${numberOfTests} ---\n`);
    }
}

runTestsInLoop().catch(error => {
    logger.error('An error occurred during the test loop:', error);
});