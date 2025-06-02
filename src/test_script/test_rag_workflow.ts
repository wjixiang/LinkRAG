import baseline_rag_workflow from '../lib/llm_workflow/baseline_rag_workflow';
import KnowledgeGraphRetriever from '../core/KnowledgeGraphRetriever';
import ChunkStorage from '../database/chunkStorage';
import { surrealDBClient } from '../database/surrealdbClient'; // Use named import for the exported instance
import { embedding } from '../lib/embedding';
import { KnowledgeGraphRetriever_Config } from '@/settings';


async function runTest() {
    // Connect to SurrealDB
    try {
        await surrealDBClient.connect();
    } catch (error) {
        console.error("Failed to connect to SurrealDB:", error);
        return; // Exit if connection fails
    }

    // Instantiate ChunkStorage
    const chunkTableName = 'chunks_test'; // Replace with your actual chunk table name
    const chunkStorage = new ChunkStorage(
        chunkTableName,
        embedding,
        0.2 // cosine_better_than_threshold
    );

    // Instantiate KnowledgeGraphRetriever

    const knowledgeGraphRetriever = new KnowledgeGraphRetriever(KnowledgeGraphRetriever_Config);

    const testQuery = "乙型脑炎的病理变化有哪些？"; // Replace with a relevant test query in Chinese
    const testTopK = 5;

    console.log(`Running RAG workflow for query: "${testQuery}"`);

    try {
        const answer = await baseline_rag_workflow(knowledgeGraphRetriever, testQuery, testTopK);
        console.log("Generated Answer:");
        console.log(answer);
    } catch (error) {
        console.error("Error running RAG workflow:", error);
    } finally {
        // Close database connection
        await surrealDBClient.close();
    }
}

runTest();