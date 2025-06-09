
import { surrealDBClient } from "@/database/surrealdbClient";
import { ChatReq } from "@/hooks/ChatRuntime";
import { Reference } from "@/components/chat_components/DocumentDisplay";
import { AgentStep, Agent } from '../../../lib/agent/Agent';
import { EmbeddingFunc } from "@/database/chunkStorage";
import KnowledgeBase from "@/core/KnowledgeBase";
import { setting } from "@/settings";
import { language } from "@/type";


export class AgentService {
    private static instances = new Map<string, AgentService>();
    private agent: Agent;
    private knowledgeBase: KnowledgeBase

    private constructor(agent: Agent, kb: KnowledgeBase) {
        this.agent = agent;
        this.knowledgeBase = kb
    }

    public static async getInstance(sessionId: string): Promise<AgentService> {
        if (this.instances.has(sessionId)) {
            return this.instances.get(sessionId)!;
        }

        
        const kb = new KnowledgeBase(setting)
        const agent = new Agent({
            language: setting.kb_editor_setting.language
        });
        const service = new AgentService(agent, kb);
        this.instances.set(sessionId, service);
        return service;
    }

    public async *processRequest(request: ChatReq): AsyncGenerator<AgentStep> {
        const { messages } = request;
        const query = messages[messages.length - 1].content;
        yield* this.agent.start(query);
    }

    public async *transformAgentStream(stream: AsyncGenerator<AgentStep>) {
        let documents: Reference[] = [];
        

        for await (const step of stream) {
            // Forward all steps directly to maintain consistency
            yield step;

            // Track documents and quizzes for final message
            if (step.type === 'result' && step.task === 'Execute_RAG') {
                documents = step.data?.documents || documents;
            }

            // Send final message with all accumulated data
            if (step.type === 'result') {
                yield {
                    type: 'done',
                    content: step.content,
                    references: documents,
                };
            }
        }
    }
}