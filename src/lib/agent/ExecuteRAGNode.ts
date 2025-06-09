import { Agent } from "./Agent";
import { BaseNode, AgentStep } from "./BaseNode";
import { ChatMessage } from '../../components/chat_components/MessageItem';
import { semanticSearchResult } from '../../database/chunkStorage';
import { b } from "baml_client/async_client";
import { RetrievedDocument } from "baml_client/types";
import { _handleStream } from "../utils";

interface BamlDocument { // Define interface for document structure
    content: string;
    metadata: any; // Or a more specific type if known
}

/**
 * 1. retrieve documents about query
 * 2. summarize correspondant docs
 * 4. judging whether to re-fetch document
 */
export class ExecuteRAGNode extends BaseNode {
    taskName = "Execute_RAG";

    constructor(agent: Agent) {
        super(agent);
    }


    protected async *work(state: ChatMessage[], query: string): AsyncGenerator<AgentStep> {
        // const documents: semanticSearchResult[] = await this.retriever.retriever.chunks_retriver(query, 10);

        const hydeResult = b.stream.HyDE_rewrite(query, this.agent.config.language);
        
        yield* _handleStream(hydeResult, (chunk) => {
            return chunk.HyDE_answer
        })

        let retrievalQuery = await hydeResult.getFinalResponse()
        let documents: semanticSearchResult[] = await this.agent.knowledgeBase.retriever.chunks_retriver(retrievalQuery.HyDE_answer, 10);
        
        // Map retrieved documents to the BAML RetrievedDocument type
        const bamlDocuments: RetrievedDocument[] = documents.map((doc: semanticSearchResult) => ({
            content: doc.document.content,
            metadata: JSON.stringify(doc.score)
        }));
        
        yield {
            type: "push",
            content: `I have retrieved ${documents.length} documents.`,
            task: this.taskName
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
            data: { documents: (bamlDocuments as BamlDocument[]).map(e=>{
                return {
                    content: e.content,
                    score: e.metadata
                }
            }) }
        }
    }
}