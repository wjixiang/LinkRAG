import { ChatMessage } from "@/components/chat_components/MessageItem"
import { Agent } from "./Agent";
import winston from "winston";
import createLoggerWithPrefix from "../console/logger";

/**
 * Abstract base class for agent nodes that implements the AgentNode interface.
 * Provides a template pattern where execute() wraps work().
 */
export abstract class BaseNode implements AgentNode {
    abstract taskName: string;
    agent: Agent;
    protected logger!: winston.Logger;

    constructor(agent: Agent) {
        this.agent = agent;
        this.initialize()
    }

    initialize() {
        this.logger = createLoggerWithPrefix(this.taskName)
    }

    /**
     * The core work method to be implemented by child classes.
     * @param state - Current chat message state
     * @param query - User query
     * @returns Async generator of AgentStep
     */
    protected abstract work(state: ChatMessage[], query: string): AsyncGenerator<AgentStep, { nextTask?: string } | void>;

    /**
     * Optional method to determine next node based on execution results.
     * @param results - Results from current execution
     * @returns Next node to execute or null if no next node
     */
    protected proceed?(result: { nextTask: string; data?: any } ): AgentNode | null | Promise<AgentNode | null>;

    /**
     * Runtime of agent node.
     * Wraps the work() method with common execution logic.
     * @param state - Current chat message state
     * @param query - User query
     * @returns Async generator of AgentStep
     */
    async *execute(state: ChatMessage[], query: string): AsyncGenerator<AgentStep> {
        try {
            this.logger.info(`Starting execution for task: ${this.taskName}`);
            
            // Common pre-execution logic
            yield {
                type: "notice",
                task: this.taskName,
                content: this.taskName,
                status: "start"
            };

            const workGen = this.work(state, query);
            let returnValue: any = undefined;
            let next = await workGen.next();

            while (!next.done) {
                yield next.value;
                next = await workGen.next();
            }

            // Capture the final return value
            returnValue = next.value;
            this.logger.info(`work() completed with: ${returnValue}`);

            yield {
                type: "notice",
                task: this.taskName,
                content: this.taskName,
                status: "end"
            };

            if (!this.proceed) {
                console.log(`[${this.constructor.name}] No next node configured - ending execution`);
                return;
            }

            if (!returnValue || !returnValue.nextTask) {
                console.log(`[${this.constructor.name}] No return value or nextTask - ending execution`);
                return;
            }

            const nextNode = await this.proceed(returnValue);
            if (!nextNode) {
                console.log('[BaseNode] No next node returned from next() function');
                return;
            }

            console.log(`[BaseNode] Executing next node: ${nextNode.constructor.name}`);
            yield* nextNode.execute(state, query);

        } catch (error) {
            yield {
                type: "error",
                task: this.taskName,
                content: error instanceof Error ? error.message : String(error),
            };
        }
    }
}

export interface AgentNode {
    taskName: string;
    execute(state: ChatMessage[], query: string): AsyncGenerator<AgentStep>;
    
    // 新增流程控制相关方法
    getNextNodes?(): Promise<AgentNode[]>;
    getCondition?(data: any): Promise<boolean>;
    isParallel?(): boolean;
    getFallbackNode?(): Promise<AgentNode | null>;
}

export type MessageType = "stream" | "notice" | "error" | "push" | "step" | "result";

export interface AgentStep {
    type: MessageType;
    task: string;
    content: string;
    isFinal?: boolean;
    data?: any;
    status?: "start"|"end"|"error";
}