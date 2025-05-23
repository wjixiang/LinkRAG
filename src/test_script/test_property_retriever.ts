import { KnowledgeGraphRetriever_Config } from "@/settings";
import KnowledgeGraphRetriever from "../core/KnowledgeGraphRetriever";
import { KnowledgeGraphRetrieverConfig } from "../core/KnowledgeGraphRetriever";
import { surrealDBClient } from "@/database/surrealdbClient";

async function main() {
    // Mock configuration for testing
    const retriever = new KnowledgeGraphRetriever(KnowledgeGraphRetriever_Config);

    // Initialize the retriever
    await retriever.init();

    // Sample query and top_k
    const query = "高血压的病理变化包括细小动脉玻璃样变"; // Changed to a simpler query
    const top_k = 5;

    console.log(`Testing property_retriever with query: "${query}" and top_k: ${top_k}`);

    try {
        console.log("Attempting to retrieve properties...");
        const results = await retriever.property_retriever(query, top_k);
        console.log("Property Retriever Results:", JSON.stringify(results, null, 2));
    } catch (error) {
        console.error("Error during property_retriever test:", error);
    } finally {
        // Close the SurrealDB connection if it was opened
        await surrealDBClient.close();
    }
}

main();