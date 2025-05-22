import { ONNXEmbedder } from '../lib/embedding/ONNXEmbedder';

async function testEmbedder() {
    const embedder = new ONNXEmbedder();
    await embedder.init();
    
    // Test single text
    const singleText = "This is a test sentence";
    const singleEmbedding = await embedder.embed(singleText) as Float32Array;
    console.log('Single embedding:', singleEmbedding);
    console.log('Single embedding dimensions:', singleEmbedding.length);

    // Test multiple texts
    const multipleTexts = [
        "First sentence",
        "Second longer sentence for testing",
        "Third one"
    ];
    const multipleEmbeddings = await embedder.embed(multipleTexts) as Float32Array[];
    console.log('Multiple embeddings count:', multipleEmbeddings.length);
    console.log('First embedding dimensions:', multipleEmbeddings[0].length);

    // Verify dimensions
    const expectedDims = await embedder.getEmbeddingDimensions();
    console.log('Expected dimensions:', expectedDims);
}

testEmbedder().catch(console.error);