import './lib/baml_collector'; // Import the BAML collector to activate logging

export { default as KnowledgeBaseRetriever } from './core/KnowledgeBaseRetriever';
export type { KnowledgeBaseRetrieverConfig } from './core/KnowledgeBaseRetriever';

export { default as KnowledgeBaseEditor } from './core/KnowledgeBaseEditor';
export type { KnowledgeGraphWeaverConfig } from './core/KnowledgeBaseEditor';

// Re-export commonly used types
export type { ChunkDocument } from './database/chunkStorage';
// export type { RecordId } from './type';