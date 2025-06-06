import { KnowledgeBaseRetrieverConfig } from "./core/KnowledgeBaseRetriever";
import { KnowledgeBaseEditorConfig } from "./core/KnowledgeBaseEditor";
import { Setting } from "./core/KnowledgeBase";


export const KnowledgeGraphWeaver_config:KnowledgeBaseEditorConfig = {
    chunkTableName: 'test_chunks',
    embeddingConcurrencyLimit: 10,
    relation_table_name: 'relation',
    reference_table_name: 'references',
    entity_table_name: "nodes",
    SemanticChunkingConfig: {
        similarityThreshold: 0.35,
        maxTokenSize: 800,
    },
    property_table_name: "property", // Added property_table_name
    semantic_search_threshold: 0.33 // Added semantic_search_threshold
    ,
    language: "zh"
};


export const KnowledgeGraphRetriever_Config: KnowledgeBaseRetrieverConfig = {
    chunkTableName: KnowledgeGraphWeaver_config.chunkTableName,
    property_table_name: "property",
    entity_table_name: KnowledgeGraphWeaver_config.entity_table_name,
    semantic_search_threshold: 0.33,
    language: "zh"
};

export const setting: Setting = {
    kb_editor_setting: KnowledgeGraphWeaver_config,
    kb_retriever_setting: KnowledgeGraphRetriever_Config
}