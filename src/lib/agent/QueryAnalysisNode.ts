import { ChatMessage } from '@/components/chat_components/MessageItem';
import { Agent } from './Agent';
import { AgentNode, AgentStep, BaseNode } from './BaseNode';
import { b } from 'baml_client/async_client';
import { _handleStream, generateShortHash } from '../utils';


export default class QueryAnalysisNode extends BaseNode {
    taskName = "Analysis query";
    id: string;
    
    constructor(agent: Agent) {
        super(agent);
        this.id = generateShortHash(new Date().toTimeString());
    }
    
    protected async *work(state: ChatMessage[], query: string): AsyncGenerator<AgentStep, { nextTask?: string }> {
        try {
            const history = state.map(e=>`${e.sender}\n${e.content}\n`).join("\n")
            const eps = b.stream.ExtractEP(history+"user:\n"+query, this.agent.config.language);
            const result = yield* _handleStream(eps, (i) => (i.reasoning ?? ""));
            
            // Always return next task to ensure consistent flow
            return {
                nextTask: "Plan next step",
                ...result
            };
        } finally {
            // Ensure we always return a value
            return {
                nextTask: "Plan next step"
            };
        }
    }

    protected proceed(result: { nextTask?: string; data?: any } | AgentStep[]) {
        console.log('QueryAnalysisNode next() received:', result)
        
        let nextTask: string | undefined
        if (Array.isArray(result)) {
            console.warn('Unexpected AgentStep array in QueryAnalysisNode.next()')
        } else {
            nextTask = result.nextTask
            if (!nextTask) {
                console.warn('No nextTask provided in result:', result)
            }
        }
        
        if (!nextTask) {
            // Default fallback node
            nextTask = "Plan next step"
        }

        console.log(`Proceeding to next node:`, nextTask)
        return this.agent.getNode(nextTask) ?? null
    }
}