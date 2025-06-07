import { ChatMessage } from "@/components/MessageItem"
import { Task } from "baml_client"
import { Surreal } from 'surrealdb'
import { ExecuteRAGNode } from "./ExecuteRAGNode"; // Import concrete node implementations
import { b } from 'baml_client/async_client';
import { setting } from "@/settings";
import KnowledgeBase from "@/core/KnowledgeBase";

/**
 * Represents the initial tasks that the Agent can execute.
 * Each task has a name, description, and example user queries.
 */
const inital_tasks: Task[] = [
    {
        task_name: "Execute_RAG",
        task_description: "This task will execute RAG searching function and get relivant documents. This is helpful to anwser various question about medical knowledge.",
        task_example_user_query: ["高血压的治疗","流脑的病理变化"]
    }
]

export type MessageType = 'step'  | 'result' | 'error' | 'notice' | 'stream';

/**
 * Represents a step in the agent's execution process.
 */
export type AgentStep = {
    type: MessageType;
    content: string;
    task?: string;
    data?: any;
    isFinal?: boolean;
};

/**
 * Interface for nodes that the Agent can execute.
 */
export interface AgentNode {
    /**
     * The name of the task this node handles.
     */
    taskName: string;

    /**
     * Executes this node with the given state and query.
     * @param state - The current chat message state.
     * @param query - The user query.
     * @returns An async generator yielding AgentStep objects.
     */
    execute(state: ChatMessage[], query: string): AsyncGenerator<AgentStep>;
}

/**
 * The main Agent class responsible for managing and executing various tasks.
 * It coordinates between different nodes to handle user queries related to medical knowledge.
 */
export class Agent {
    /**
     * The current chat message state.
     */
    state: ChatMessage[] = []


    /**
     * Retrieves knowledge graph data.
     */
    knowledgeBase: KnowledgeBase

    /**
     * Array of registered nodes that can execute specific tasks.
     */
    private nodes: AgentNode[] = [];

    /**
     * Creates a new Agent instance.
     * @param db - The SurrealDB instance to use for database operations.
     * @param kgretriever - The KnowledgeGraphRetriever to use for knowledge graph queries.
     */
    constructor(db: Surreal) {
        
        this.knowledgeBase = new KnowledgeBase(setting)
        // Register nodes
        this.registerNode(new ExecuteRAGNode(this.knowledgeBase));
    }

    /**
     * Registers a node with the agent.
     * @param node - The node to register.
     */
    registerNode(node: AgentNode) {
        this.nodes.push(node);
    }

    /**
     * Starts the agent's execution process for a given query.
     * @param query - The user query to process.
     * @returns An async generator yielding AgentStep objects representing the execution process.
     */
    async *start(query: string): AsyncGenerator<AgentStep> {
        try {
            const {selected_task, response} = await b.PlanNextStep(query, inital_tasks)

            // Yield the planned step
            yield {
                type: 'step',
                content: `Planned next step: ${selected_task}`,
                task: selected_task
            }

            yield {
                type: 'notice',
                content: response,
                task: selected_task
            }

            // Find and execute the appropriate node
            const nodeToExecute = this.nodes.find(node => node.taskName === selected_task);

            if (nodeToExecute) {
                for await (const step of nodeToExecute.execute(this.state, query)) {
                    yield step; // Yield results from the node
                }
            } else {
                 console.warn(`No node found for task: ${selected_task}`)
                 yield {
                     type: 'error',
                     content: `No node found for task: ${selected_task}`,
                     task: selected_task
                 }
            }

        } catch (error) {
            console.error("Failed to plan next step:", error)
            yield {
                type: 'error',
                content: error instanceof Error ? error.message : 'Unknown error'
            }
        }
    }
}
