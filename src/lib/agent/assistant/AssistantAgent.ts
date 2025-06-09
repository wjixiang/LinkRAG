import { Agent, AgentConfig } from "../Agent";
import { ChatMessage } from "@/components/chat_components/MessageItem"
import { Task } from "baml_client"
import { Surreal } from 'surrealdb'
import { ExecuteRAGNode } from "../ExecuteRAGNode"; // Import concrete node implementations
import { setting } from "@/settings";
import KnowledgeBase from "@/core/KnowledgeBase";
import TaskClassifyNode from "../TaskClassifyNode";
import { language } from '../../../type';
import QueryAnalysisNode from "../QueryAnalysisNode";
import { AgentNode, AgentStep } from "../BaseNode";

  

export interface AssistantAgentConfig extends AgentConfig {

}

export default class AssistantAgent extends Agent {
    config: AssistantAgentConfig
    constructor(config: AssistantAgentConfig){
        super(config);
        this.config = config
    }

    registerCoreNodes() {
        this.registerNode(new TaskClassifyNode(this));
        this.registerNode(new ExecuteRAGNode(this));
        this.registerNode(new QueryAnalysisNode(this));
    }

    async *start(query: string): AsyncGenerator<AgentStep> {
        this.state.push({
            sender: "user",
            messageType: "content",
            content: query,
            id: Math.random().toString(),
            timestamp: new Date(),
            isVisible: true,
            isLatest: true,
        });

        try {

            // Initial task classification
            const pipeline = new QueryAnalysisNode(this).execute(this.state, query)
            for await (const step of pipeline) {
                yield step; 
            }

        } catch (error) {
            console.error("Failed to plan next step:", error)
            yield {
            type: 'error',
            task: "Agent", // Add task property
            content: error instanceof Error ? error.message : 'Unknown error'
            }   
        }
    }
}