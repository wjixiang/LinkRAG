import { ChatMessage } from "@/components/MessageItem"
import { Task } from "baml_client"
import { Surreal } from 'surrealdb'
import { ExecuteRAGNode } from "./ExecuteRAGNode"; // Import concrete node implementations
import { setting } from "@/settings";
import KnowledgeBase from "@/core/KnowledgeBase";
import TaskClassifyNode from "./TaskClassifyNode";
import { language } from '../../type';
import QueryAnalysisNode from "./QueryAnalysisNode";
import { AgentNode, AgentStep } from "./BaseNode";

/**
 * The main Agent class responsible for managing and executing various tasks.
 * It coordinates between different nodes to handle user queries related to medical knowledge.
 */
export class Agent {
    /**
     * The current chat message state.
     */
    state: ChatMessage[] = []
    config: {
        language: language;
    }

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
    constructor(config: { language: language }) {
        this.config = config;
        this.knowledgeBase = new KnowledgeBase(setting);
        this.registerCoreNodes();
    }

    /**
     * Registers core nodes that should always be available.
     */
    private registerCoreNodes() {
        this.registerNode(new TaskClassifyNode(this));
        this.registerNode(new ExecuteRAGNode(this));
        this.registerNode(new QueryAnalysisNode(this));
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
