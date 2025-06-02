import { KnowledgeGraphRetriever_Config } from "@/settings";
import KnowledgeGraphRetriever from "../core/KnowledgeGraphRetriever";
import { surrealDBClient } from "@/database/surrealdbClient";
// import { setEmbeddingProvider } from "@/lib/embedding";

async function main() {
    // Mock configuration for testing
    const retriever = new KnowledgeGraphRetriever(KnowledgeGraphRetriever_Config);

    // Sample query and top_k
    //2003N73A 在类风湿关节炎发病中起主要作用的细胞是\nA. A.CD3⁺细胞\nB. B.CD4⁺细胞\nC. C.CD8⁺细胞\nD. D.B淋巴细胞\nE. E.巨噬细胞
    const query = "系统性红斑狼疮的辅助检查表现"; // Changed to a simpler query
    const top_k = 5;

    console.log(`Testing property_retriever with query: "${query}" and top_k: ${top_k}`);
    
    // Explicitly set the embedding provider to 'onnx' for testing
    // setEmbeddingProvider('onnx');
    // console.log("Set embedding provider to 'onnx'");
    
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