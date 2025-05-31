import SourceManager from '../core/SourceManager';
import { RecordId } from 'surrealdb';
import { setTimeout } from 'timers/promises';
import { Library } from '../core/Library';

async function testSourceManager() {
    console.log('=== Starting SourceManager Tests ===');

    const sm = new SourceManager();

    // Test adding a source
    console.log('\n1. Testing addSource()');
    const testContent = 'This is test content for source manager';
    const source1 = await sm.addSource(testContent, {
        name: 'Test Source 1',
        type: 'txt',
        origin: '/path/to/test1.txt',
        description: 'Test description',
        tags: ['test', 'cli']
    });
    console.log('Added source:', source1);

    // Test getSource()
    console.log('\n2. Testing getSource()');
    const retrievedSource = await sm.getSource(source1.id!);
    console.log('Retrieved source:', retrievedSource);

    // Test getSourceContent()
    console.log('\n3. Testing getSourceContent()');
    const content = await sm.getSourceContent(source1.id!);
    console.log('Retrieved content:', content);
    console.log('Content matches:', content === testContent);

    // Test updateSource()
    console.log('\n4. Testing updateSource()');
    const updatedSource = await sm.updateSource(source1.id!, {
        description: 'Updated description',
        tags: ['updated']
    });
    console.log('Updated source:', updatedSource);

    // Test processed status
    console.log('\n4.1 Testing processed status');
    console.log('Initial processed status:', updatedSource.processed);
    const markedProcessed = await sm.updateSource(source1.id!, {
        processed: true
    });
    console.log('Marked as processed:', markedProcessed.processed);
    
    // Test search by processed status
    const processedSources = await sm.searchSources({ processed: true });
    console.log('Processed sources count:', processedSources.length);

    // Test listSources()
    console.log('\n5. Testing listSources()');
    const sources = await sm.listSources();
    console.log('All sources:', sources);

    // Test searchSources()
    console.log('\n6. Testing searchSources()');
    const searchResults = await sm.searchSources({ type: 'txt' });
    console.log('Search results (type=txt):', searchResults);

    // Add second source for listing tests
    console.log('\n7. Adding second source');
    const source2 = await sm.addSource('Second test content', {
        name: 'Test Source 2',
        type: 'pdf',
        origin: '/path/to/test2.pdf'
    });
    console.log('Added source:', source2);

    // Verify list shows both sources
    console.log('\n8. Verifying listSources() shows both');
    const allSources = await sm.listSources();
    console.log('All sources count:', allSources.length);

    // Test removeSource()
    console.log('\n9. Testing removeSource()');
    await sm.removeSource(source1.id!);
    console.log('Source removed');

    // Verify source was removed
    console.log('\n10. Verifying source was removed');
    const remainingSources = await sm.listSources();
    console.log('Remaining sources count:', remainingSources.length);

    // Clean up second source
    console.log('\n11. Cleaning up second source');
    await sm.removeSource(source2.id!);

    // Test configuration options
    console.log('\n12. Testing configuration options');
    const customLibrary = new Library();
    const customSM = new SourceManager({
        tableName: 'custom_sources',
        library: customLibrary,
        maxCacheSize: 50
    });
    
    const configTestSource = await customSM.addSource('Config test content', {
        name: 'Config Test Source',
        type: 'txt',
        origin: '/path/to/config_test.txt'
    });
    console.log('Added source with custom config:', configTestSource);
    
    // Verify custom table name
    const customSources = await customSM.listSources();
    console.log('Custom sources count:', customSources.length);
    
    // Clean up config test source
    await customSM.removeSource(configTestSource.id!);

    console.log('\n=== SourceManager Tests Complete ===');
}

// Run tests with delay to allow SurrealDB to process
(async () => {
    try {
        await testSourceManager();
        // Add delay before exit to ensure all async operations complete
        await setTimeout(1000);
        process.exit(0);
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
})();