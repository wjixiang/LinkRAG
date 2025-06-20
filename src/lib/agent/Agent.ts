import { ChatMessage } from "@/components/chat_components/MessageItem"
import pLimit from 'p-limit';
import KnowledgeBase from "@/core/KnowledgeBase";
import { language } from '../../type';
import { AgentNode, AgentStep } from "./BaseNode";
import winston from "winston";
import createLoggerWithPrefix from "../console/logger";

export interface AgentConfig {
    language: language;
    knowledgebase: KnowledgeBase;
    concurrency?: number; // 全局并发控制
}

/**
 * The main Agent class responsible for managing and executing various tasks.
 * It coordinates between different nodes to handle user queries related to medical knowledge.
 */
export abstract class Agent {
    
    abstract name: string;

    /**
     * The current chat message state.
     */
    state: ChatMessage[] = []
    config: AgentConfig
    protected get logger(): winston.Logger {
        return createLoggerWithPrefix(`Agent(${this.name})`)
    }

    /**
     * Global concurrency limiter
     */
    protected limiter!: ReturnType<typeof pLimit>; // 使用明确赋值断言

    /**
     * Retrieves knowledge graph data.
     */
    knowledgeBase: KnowledgeBase

    /**
     * Node registry for managing available nodes.
     */
    private nodeRegistry = new Map<string, AgentNode>();

    /**
     * @deprecated Use getNode() instead
     */
    get nodes(): AgentNode[] {
        console.warn('agent.nodes is deprecated - use agent.getNode() instead');
        return Array.from(this.nodeRegistry.values());
    }

    /**
     * Creates a new Agent instance.
     * @param config - Agent configuration
     */
    constructor(config: AgentConfig) {
        this.config = config;
        this.knowledgeBase = this.config.knowledgebase;
        this.limiter = pLimit(config.concurrency || 5); // 初始化全局并发限制器
    }

    /**
     * Registers a node with the agent.
     * @param node - The node to register.
     */
    registerNode(node: AgentNode) {
        if (this.nodeRegistry.has(node.taskName)) {
            console.warn(`Overwriting existing node for task: ${node.taskName}`);
        }
        this.nodeRegistry.set(node.taskName, node);
    }

    /**
     * Gets a node by task name.
     * @param taskName - Name of the task to get node for
     * @returns The node or undefined if not found
     */
    getNode(taskName: string): AgentNode | undefined {
        return this.nodeRegistry.get(taskName);
    }

    /**
     * Starts the agent's execution process for a given query.
     * @param query - The user query to process.
     * @returns An async generator yielding AgentStep objects representing the execution process.
     */
    public abstract start(query: string): AsyncGenerator<AgentStep>

    /**
     * Decorator that yields notifications before and after function execution
     * @param message - Notification message prefix
     */
    async *withNotifications(message: string, func: Function) {
       yield {
            type: 'notice',
            status: 'start',
            task: message,
            content: `${message} - Started`,
            timestamp: new Date().toISOString()
        } as AgentStep;
        
        try {
            const result = func()
            
            // Yield completion notification
            yield {
                type: 'notice',
                status: 'end',
                task: message,
                content: `${message} - Completed successfully`,
                timestamp: new Date().toISOString()
            } as AgentStep;

            return result
        } catch (error) {
            // Yield error notification
            yield {
                type: "error",
                task: message,
                content: `${message} - Failed`,
            } as AgentStep;
            throw error;
        }
    }
}
