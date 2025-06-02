import KnowledgeGraphWeaver from '../core/KnowledgeGraphWeaver';
import { RecordId } from 'surrealdb';
import { surrealDBClient } from '../database/surrealdbClient'; // Import surrealDBClient
import { KnowledgeGraphWeaver_config } from '@/settings';

async function testClassifyRelation() {
    // Initialize SurrealDB connection
    try {
        await surrealDBClient.connect(); // Connect to the database
        console.log('SurrealDB connected successfully.');
    } catch (error) {
        console.error('Failed to connect to SurrealDB:', error);
        return; // Exit if connection fails
    }


    const weaver = new KnowledgeGraphWeaver(KnowledgeGraphWeaver_config);

    // Wait for initialization to complete
    await (weaver as any).initializeComponents();

    const entityId = new RecordId('nodes', '04d4j27vfzjfw4fill8v'); // 04d4j27vfzjfw4fill8v bvtu2fugdthiug3p5wem

    try {
        await weaver.knowledgeGraphProcessor.classify_relation(entityId);
        console.log('classify_relation test completed');
    } catch (error) {
        console.error('Error during classify_relation test:', error);
    }
}

testClassifyRelation();