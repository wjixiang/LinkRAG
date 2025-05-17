import { surrealDBClient } from '../database/surrealdbClient';
import KnowledgeGraphWeaver from '../core/KnowledgeGraphWeaver';
import { KnowledgeGraphWeaver_config } from '@/settings';

async function main() {
    try {
        await surrealDBClient.connect();

        const config = {
            chunkTableName: 'chunks_test',
            embeddingConcurrencyLimit: 5,
            relation_table_name: "relation",
            reference_table_name: "reference"
        };

        const kgWeaver = new KnowledgeGraphWeaver(KnowledgeGraphWeaver_config);
        // Wait for storage initialization
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log("Testing joint_graph function...");
        await kgWeaver.joint_graph();
        console.log("joint_graph test completed");
    } catch (error) {
        console.error("Error during joint_graph test:", error);
    } finally {
        await surrealDBClient.close();
    }
}

main();