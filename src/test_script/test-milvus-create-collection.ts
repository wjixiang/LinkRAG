import MilvusVectorStorage from "../database/MilvusVectorStorage";
import { embeddingInstance } from "../type";

// Placeholder for a mock or actual embedding instance
const mockEmbeddingInstance: embeddingInstance = {
    Embeddings: { // This should be a mock of the Embeddings type
        embedDocuments: async (documents: string[]) => {
            console.log("Mock embedDocuments called");
            return documents.map(doc => [0.1, 0.2, 0.3]); // Return dummy embeddings
        },
        embedQuery: async (query: string) => {
            console.log("Mock embedQuery called");
            return [0.1, 0.2, 0.3]; // Return a dummy embedding
        },
        caller: { // Added mock caller property
            maxConcurrency: 1,
            maxRetries: 0,
            onFailedAttempt: () => {},
            queue: {},
            // Add other necessary mock properties of AsyncCaller if required by the type
        } as any, // Use 'as any' to temporarily bypass potential missing properties
        // Add other necessary mock methods/properties of Embeddings if required by the test
    },
    EmbeddingModal: "mock-modal", // Add a mock value for EmbeddingModal
};

const config = {
    StorageNameSpace: "test_collection_" + Date.now(), // Use a unique name for testing
    embedding_ins: mockEmbeddingInstance,
    cosine_better_than_threshold: 0.2,
};

async function testCreateCollection() {
    console.log("Creating MilvusVectorStorage instance...");
    const milvusStorage = new MilvusVectorStorage(config);
    console.log("MilvusVectorStorage instance created.");

    console.log(`Attempting to create collection: ${config.StorageNameSpace}`);
    try {
        await milvusStorage.create_collection();
        console.log(`Collection "${config.StorageNameSpace}" creation process initiated.`);
        console.log("Note: Actual collection creation in Milvus depends on the Milvus connection and implementation within create_collection.");
    } catch (error) {
        console.error("Error during collection creation:", error);
    }
}

testCreateCollection();