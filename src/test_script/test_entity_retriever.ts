import { surrealDBClient } from "@/database/surrealdbClient";
import KnowledgeBaseRetriever from "@/core/KnowledgeBaseRetriever";
import { KnowledgeGraphRetriever_Config } from "@/settings"; // Import config from settings

async function testEntityRetriever() {
    try {
        // Use the configuration from settings
        const config = KnowledgeGraphRetriever_Config;

        // Create and initialize the retriever
        const retriever = new KnowledgeBaseRetriever(config);

        // Define a test query
        const testQuery = "糖尿病的发病机制"; // Replace with a relevant test query

        console.log(`Testing entity_retriever with query: "${testQuery}"`);

        // Call the entity_retriever method
        const results = await retriever.entity_retriever(testQuery, 5); // Get top 5 results

        console.log("\nRetrieved Entities:");
        if (results.length > 0) {
            results.forEach((entity, index) => {
                console.log(`\n${index + 1}. Name: ${entity.name}`);
                console.log(`   Description: ${entity.description}`);
                console.log(`   Score: ${entity.score}`);
                console.log(`   ID: ${entity.id}`);
            });
        } else {
            console.log("No entities found.");
        }

    } catch (error) {
        console.error("An error occurred:", error);
    } finally {
        // Close the SurrealDB connection
        await surrealDBClient.close(); // Use .close()
    }
}

testEntityRetriever();