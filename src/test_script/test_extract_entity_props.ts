import KnowledgeBaseEditor from '../core/KnowledgeBaseEditor';
import { RecordId } from 'surrealdb';
import { surrealDBClient } from '../database/surrealdbClient';
import { KnowledgeGraphWeaver_config } from '@/settings';

async function testExtractEntityProps() {
    // Initialize SurrealDB connection
    try {
        await surrealDBClient.connect();
        console.log('SurrealDB connected successfully.');
    } catch (error) {
        console.error('Failed to connect to SurrealDB:', error);
        return; // Exit if connection fails
    }

    const weaver = new KnowledgeBaseEditor(KnowledgeGraphWeaver_config);

    // Wait for initialization to complete
    // @ts-ignore - Accessing private method for testing
    await weaver.initializeComponents();

    // Replace with a valid entity ID from your database for testing
    const entityId = new RecordId('nodes', '8n4l3q4zhxe6je2zr4jm'); 

    try {
        console.log(`Testing extract_entity_props for entity ID: ${entityId}`);
        const summaries = await weaver.knowledgeGraphProcessor.extract_entity_props(entityId);
        
        if (summaries) {
            console.log('Extracted Entity Property Summaries:');
            summaries.forEach((summary, index) => {
                console.log(`Summary ${index + 1}:\n${summary.property_name}\n${summary.property_content}\n---`);
            });
        } else {
            console.log('No summaries extracted.');
        }
        
        console.log('extract_entity_props test completed');
    } catch (error) {
        console.error('Error during extract_entity_props test:', error);
    } finally {
        // Disconnect from SurrealDB
        await surrealDBClient.close();
        console.log('SurrealDB disconnected.');
    }
}

testExtractEntityProps();