import { KnowledgeGraphRetriever_Config } from "@/settings";
import KnowledgeBaseRetriever, { RetrievalResult } from "../core/KnowledgeBaseRetriever"; // Import RetrievalResult
import { surrealDBClient } from "@/database/surrealdbClient";

async function main() {
    // Initialize retriever with config
    const retriever = new KnowledgeBaseRetriever(KnowledgeGraphRetriever_Config); 

    // Test queries
    const queries = [
        "类风湿性关节炎的发病机制",
        "什么是系统性红斑狼疮",
    ];
    const top_k = 5;

    for (const query of queries) {
        console.log(`\nTesting hybridRetrieve with query: "${query}" and top_k: ${top_k}`);
        
        try {
            const results = await retriever.hybridRetrieve(query, top_k);
            console.log("Hybrid Retrieval Results:", JSON.stringify(results, null, 2));
            
            // Print formatted results
            console.log("\nFormatted Results:", results);
            // results.forEach((result: RetrievalResult, index: number) => { // Explicitly type parameters
            //     console.log(`\n[${index + 1}] Type: ${result.type}, Score: ${result.score.toFixed(4)}`);
            //     console.log(result.content);
            //     console.log(`Source: ${result.source}`);
            // });
        } catch (error) {
            console.error(`Error during hybridRetrieve for query "${query}":`, error);
        }
    }

    // Close the SurrealDB connection
    await surrealDBClient.close();
}

main().catch(console.error);