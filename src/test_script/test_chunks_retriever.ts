import { KnowledgeGraphRetriever_Config } from "@/settings";
import KnowledgeBaseRetriever from "../core/KnowledgeBaseRetriever";
import { surrealDBClient } from "@/database/surrealdbClient";

async function main() {
    // Mock configuration for testing
    const retriever = new KnowledgeBaseRetriever(KnowledgeGraphRetriever_Config);

    // Initialize the retriever
    

    // Sample query and top_k
    const query = "类风湿性关节炎的发病机制"; // Sample query
    const top_k = 5;

    console.log(`Testing chunks_retriver with query: "${query}" and top_k: ${top_k}`);

    try {
        console.log("Attempting to retrieve chunks...");
        const results = await retriever.chunks_retriver(query, top_k);
        console.log("Chunks Retriever Results:", JSON.stringify(results, null, 2));
    } catch (error) {
        console.error("Error during chunks_retriver test:", error);
    } finally {
        // Close the SurrealDB connection if it was opened
        await surrealDBClient.close();
    }
}

main();