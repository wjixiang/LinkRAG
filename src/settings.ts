import { KnowledgeGraphWeaverConfig } from "./core/KnowledgeGraphWeaver";

export const KnowledgeGraphWeaver_config:KnowledgeGraphWeaverConfig = {
    chunkTableName: 'test_chunks',
    embeddingConcurrencyLimit: 10,
    relation_table_name: 'relation',
    reference_table_name: 'references',
    entity_table_name: "nodes",
    SemanticChunkingConfig: {
        similarityThreshold: 0.35,
        maxTokenSize: 300,
        
    }
};