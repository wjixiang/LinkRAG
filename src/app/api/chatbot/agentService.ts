
import { surrealDBClient } from "@/database/surrealdbClient";
import { ChatReq } from "@/hooks/ChatRuntime";
import { Reference } from "@/components/DocumentDisplay";
import { AgentStep, Agent } from '../../../lib/agent/Agent';
import { EmbeddingFunc } from "@/database/chunkStorage";
import KnowledgeBase from "@/core/KnowledgeBase";
import { setting } from "@/settings";


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

        await surrealDBClient.connect();
        const db = await surrealDBClient.getDb();
        
     
        const kb = new KnowledgeBase(setting)
        const agent = new Agent(db);
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
        let quizzes: any[] = [];

        for await (const step of stream) {
            // Forward all steps directly to maintain consistency
            yield step;

            // Track documents and quizzes for final message
            if (step.type === 'result' && step.task === 'Execute_RAG') {
                documents = step.data?.documents || documents;
            }
            if (step.type === 'result' && step.task === 'Fetch_Quizzes') {
                quizzes = step.data?.quizzes || quizzes;
            }

            // Send final message with all accumulated data
            if (step.type === 'result') {
                yield {
                    type: 'done',
                    content: step.content,
                    references: documents,
                    quizzes: quizzes.length ? quizzes : undefined
                };
            }
        }
    }
}