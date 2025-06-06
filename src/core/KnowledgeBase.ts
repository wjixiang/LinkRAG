import KnowledgeBaseEditor, { KnowledgeBaseEditorConfig } from "./KnowledgeBaseEditor";
import KnowledgeBaseRetriever, { KnowledgeBaseRetrieverConfig } from "./KnowledgeBaseRetriever";

export interface Setting {
    kb_editor_setting: KnowledgeBaseEditorConfig;
    kb_retriever_setting: KnowledgeBaseRetrieverConfig
}

export default class KnowledgeBase {
    config: Setting
    editor: KnowledgeBaseEditor;
    retriever: KnowledgeBaseRetriever;

    constructor(config: Setting) {
        this.config = config
        this.editor = new KnowledgeBaseEditor(this.config.kb_editor_setting)
        this.retriever = new KnowledgeBaseRetriever(this.config.kb_retriever_setting)
    }
}