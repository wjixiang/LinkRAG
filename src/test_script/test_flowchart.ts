import Learner from '@/core/Learner';
import KnowledgeBaseRetriever from '@/core/KnowledgeBaseRetriever';
import KnowledgeBaseEditor from '@/core/KnowledgeBaseEditor';
import PropertyStorage from '@/core/PropertyStorage';
import EntityStorage from '@/database/EntityStorage';
import { surrealDBClient } from '@/database/surrealdbClient';
import { b } from 'baml_client/async_client';
import { KnowledgeGraphWeaver_config } from '@/settings';

async function main() {
  try {
    // Initialize database client
    await surrealDBClient.connect();
    
    // Clear test data with retry logic
    const db = await surrealDBClient.getDb();
    const maxRetries = 3;
    
    async function clearTable(table: string) {
      let retries = 0;
      while (retries < maxRetries) {
        try {
          await db.delete(table);
          return;
        } catch (error) {
          retries++;
          if (retries === maxRetries) throw error;
          await new Promise(resolve => setTimeout(resolve, 100 * retries));
        }
      }
    }

    // Clear tables sequentially to avoid conflicts
    await clearTable(KnowledgeGraphWeaver_config.entity_table_name);
    await clearTable(KnowledgeGraphWeaver_config.property_table_name);
    await clearTable(KnowledgeGraphWeaver_config.reference_table_name);

    // Create storage instances using settings
    const entityStorage = new EntityStorage(
      KnowledgeGraphWeaver_config.entity_table_name,
      KnowledgeGraphWeaver_config.reference_table_name
    );
    const propertyStorage = new PropertyStorage(
      KnowledgeGraphWeaver_config.property_table_name
    );
    
    // Create knowledge graph components
    const retriever = new KnowledgeBaseRetriever({
      chunkTableName: KnowledgeGraphWeaver_config.chunkTableName,
      property_table_name: KnowledgeGraphWeaver_config.property_table_name,
      entity_table_name: KnowledgeGraphWeaver_config.entity_table_name,
      semantic_search_threshold: KnowledgeGraphWeaver_config.semantic_search_threshold,
      language: 'en'
    });
    
    const weaver = new KnowledgeBaseEditor({
      ...KnowledgeGraphWeaver_config,
      embeddingConcurrencyLimit: 5 // Lower limit for testing
    });
    
    // Create Learner instance
    const learner = new Learner(retriever, weaver);

    console.log('=== Starting flowchart tests ===');

    // Test Case 1: New Entity and New Property
    console.log('\nTest Case 1: New Entity and New Property');
    try {
      const result1 = await learner.summarize_new_property('心肌梗死', '诊断标准');
      console.log('Result:', result1);
      console.log('✅ Test Case 1 passed');
    } catch (error) {
      console.error('❌ Test Case 1 failed:', error);
    }

    // Test Case 2: Existing Entity, New Property
    console.log('\nTest Case 2: Existing Entity, New Property');
    try {
      const result2 = await learner.summarize_new_property('心肌梗死', '治疗方案');
      console.log('Result:', result2);
      console.log('✅ Test Case 2 passed');
    } catch (error) {
      console.error('❌ Test Case 2 failed:', error);
    }

    // Test Case 3: Existing Entity, Existing Property
    console.log('\nTest Case 3: Existing Entity, Existing Property');
    try {
      const result3 = await learner.summarize_new_property('心肌梗死', '诊断标准');
      console.log('Result:', result3);
      console.log('✅ Test Case 3 passed');
    } catch (error) {
      console.error('❌ Test Case 3 failed:', error);
    }

    console.log('\n=== All tests completed ===');
  } catch (error) {
    console.error('❌ Initialization failed:', error);
  } finally {
    await surrealDBClient.close();
  }
}

main().catch(console.error);