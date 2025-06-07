import { AgentNode, AgentStep } from "./Agent"; // Import from quizAgent.ts

import KnowledgeBase from "@/core/KnowledgeBase";

import baseline_rag_workflow from "../llm_workflow/baseline_rag_workflow";
import { ChatMessage } from '../../components/MessageItem';
import { semanticSearchResult } from '../../database/chunkStorage';

interface BamlDocument { // Define interface for document structure
    content: string;
    metadata: any; // Or a more specific type if known
}

/**
 * 1. retrieve documents about query
 * 2. summarize correspondant docs
 * 4. judging whether to re-fetch document
 */
export class ExecuteRAGNode implements AgentNode {
    taskName = "Execute_RAG";
    private retriever: KnowledgeBase;

    constructor(retriever: KnowledgeBase) {
        this.retriever = retriever;
    }

    async *execute(state: ChatMessage[], query: string): AsyncGenerator<AgentStep> {
        try {
            // const documents: semanticSearchResult[] = await this.retriever.retriever.chunks_retriver(query, 10);

            // yield {
            //     type: "notice",
            //     content: "找到文档"
            // }

            // delete
            const {stream, bamlDocuments} = await baseline_rag_workflow(query, 10, true, "zh");
            let preChunk = ''
            for await (const chunk of stream) {
                yield {
                    type: 'stream',
                    content: chunk.startsWith(preChunk) ? chunk.substring(preChunk.length) : chunk,
                    task: this.taskName
                }
                preChunk = chunk
            }
            yield {
                type: 'stream',
                content: 'RAG execution completed',
                isFinal: true,
                task: this.taskName,
                data: { documents: (bamlDocuments as BamlDocument[]).map(e=>{ // Cast to BamlDocument[] and use typed parameter
                    return {
                        content: e.content,
                        score: e.metadata
                    }
                }) }
            }
        } catch (error) {
            console.error("Error in ExecuteRAGNode:", error);
            yield {
                type: 'error',
                content: error instanceof Error ? error.message : 'Unknown error',
                task: this.taskName
            }
        }
    }
}