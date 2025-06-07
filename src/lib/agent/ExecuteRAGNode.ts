import { AgentNode, AgentStep } from "./Agent"; // Import from quizAgent.ts

import KnowledgeBase from "@/core/KnowledgeBase";

import { ChatMessage } from '../../components/MessageItem';
import { semanticSearchResult } from '../../database/chunkStorage';
import { b } from "baml_client/async_client";
import { setting } from "@/settings";
import { RetrievedDocument } from "baml_client/types";

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

            const hydeResult = b.stream.HyDE_rewrite(query, "zh");
            let retrievalQuery = ""
            for await (const chunk of hydeResult) {
                yield {
                    type: 'stream',
                    content: chunk.HyDE_answer.startsWith(retrievalQuery) ? chunk.HyDE_answer.substring(retrievalQuery.length) : "",
                    task: this.taskName
                }
                retrievalQuery = chunk.HyDE_answer 
            }
            yield {
                type: 'stream',
                content: 'HyDE execution completed',
                isFinal: true,
                task: this.taskName,
            }


            const kb = new KnowledgeBase(setting)
            let documents: semanticSearchResult[] = await kb.retriever.chunks_retriver(retrievalQuery, 10);
            
    
            // Map retrieved documents to the BAML RetrievedDocument type
            const bamlDocuments: RetrievedDocument[] = documents.map((doc: semanticSearchResult) => ({
                content: doc.document.content, // Assuming the retrieved document has a 'text' property for content
                metadata: JSON.stringify(doc.score) // Assuming the retrieved document has a 'metadata' property
            }));
            
            yield {
                type: "push",
                content: `I have retrieved ${documents.length} documents.`
            }
                
            const stream = b.stream.GenerateAnswer(query, bamlDocuments, "zh");

    
            
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