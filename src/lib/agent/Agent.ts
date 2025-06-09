import { ChatMessage } from "@/components/chat_components/MessageItem"
import { setting } from "@/settings";
import KnowledgeBase from "@/core/KnowledgeBase";
import { language } from '../../type';
import { AgentNode, AgentStep } from "./BaseNode";

export interface AgentConfig {
    language: language
}

/**
 * The main Agent class responsible for managing and executing various tasks.
 * It coordinates between different nodes to handle user queries related to medical knowledge.
 */
export abstract class Agent {
    /**
     * The current chat message state.
     */
    state: ChatMessage[] = []
    config: AgentConfig

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
        this.knowledgeBase = new KnowledgeBase(setting);
        this.registerCoreNodes();
    }

    /**
     * Registers core nodes that should always be available.
     */
    protected registerCoreNodes() {}

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
    public async *start(query: string): AsyncGenerator<AgentStep> {
    }
}
