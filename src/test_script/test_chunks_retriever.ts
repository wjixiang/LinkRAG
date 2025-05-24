import { KnowledgeGraphRetriever_Config } from "@/settings";
import KnowledgeGraphRetriever from "../core/KnowledgeGraphRetriever";
import { surrealDBClient } from "@/database/surrealdbClient";

async function main() {
    // Mock configuration for testing
    const retriever = new KnowledgeGraphRetriever(KnowledgeGraphRetriever_Config);

    // Initialize the retriever
    await retriever.init();

    // Sample query and top_k
    const query = "急性肾小球肾炎的治疗"; // Sample query
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