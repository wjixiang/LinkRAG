# KnowledgeGraphWeaver Reference

## Overview
The `KnowledgeGraphWeaver` class orchestrates the construction of knowledge graphs from documents through a multi-step pipeline:

1. Document ingestion and storage
2. Semantic chunking and embedding
3. Knowledge graph generation
4. Graph merging and global graph construction

## Configuration (`KnowledgeGraphWeaverConfig`)

```typescript
interface KnowledgeGraphWeaverConfig {
    chunkTableName: string;          // Database table name for chunks
    embeddingConcurrencyLimit: number; // Max parallel embedding operations
    entity_table_name: string;       // Database table for entities
    relation_table_name: string;     // Database table for relations  
    reference_table_name: string;    // Database table for references
    SemanticChunkingConfig: SemanticChunkingConfig; // Chunking parameters
    property_table_name: string;     // Database table for properties
    semantic_search_threshold: number; // Similarity threshold for semantic search
}
```

## Core Methods

### `constructor(config: KnowledgeGraphWeaverConfig)`
Initializes all components with the provided configuration.

### `weave(file_path: string)`
Main entry point that executes the full pipeline:
1. Saves document to reference storage
2. Performs chunking and embedding
3. Generates knowledge graphs
4. Merges graphs and builds global EPE graph

```typescript
await weaver.weave('/path/to/document.pdf');
```

### `generateKgsForReference(referenceId: RecordId, ConcurrencyLimit=50)`
Generates knowledge graphs for all chunks belonging to a reference document.

Parameters:
- `referenceId`: The document's record ID
- `ConcurrencyLimit`: Max parallel graph generation operations (default: 50)

### `chunking_and_embedding(id: RecordId)`
Processes a document by:
1. Retrieving content from source manager
2. Chunking and embedding the content
3. Storing chunks in database

### `chunking_and_embedding_batch(id: RecordId)`
Batch version of chunking and embedding that:
1. Uses semantic chunking
2. Combines adjacent chunks
3. Initiates Alibaba batch embedding job
4. Returns batch job ID for tracking

### `build_global_EPE_graph(concurrencyLimit = 100)`
Builds the global Entity-Property-Entity graph by:
1. Processing all entities
2. Identifying relationships
3. Merging local graphs into global structure

## Helper Methods

### `save_to_reference_document_storage(file_path: string)`
Saves a document to the reference storage system.

### `chunking_and_embedding_from_path(file_path: string)`
Alternative processing that:
1. Reads file directly
2. Uses temporary ID
3. Processes without permanent storage

## Error Handling
All methods log errors via Winston logger and propagate exceptions. Common error scenarios:
- Document not found
- Chunking failures
- Database connection issues
- Batch job initiation failures

## Dependencies
- SurrealDB for storage
- ONNXEmbedder/Alibaba for embeddings
- Semantic chunking for text processing
- Various core processors (Document, Chunk, Graph)

## Example Usage

```typescript
const config = {
    chunkTableName: 'document_chunks',
    embeddingConcurrencyLimit: 10,
    entity_table_name: 'entities',
    relation_table_name: 'relations',
    reference_table_name: 'references',
    SemanticChunkingConfig: { /*...*/ },
    property_table_name: 'properties',
    semantic_search_threshold: 0.8
};

const weaver = new KnowledgeGraphWeaver(config);
await weaver.weave('medical_textbook.pdf');