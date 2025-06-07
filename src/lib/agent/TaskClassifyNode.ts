import { ChatMessage } from '@/components/MessageItem';
import { AgentNode, AgentStep } from './Agent';
import { Task } from 'baml_client/types';
import { b } from 'baml_client/async_client';
import { ExecuteRAGNode } from './ExecuteRAGNode';
import KnowledgeBase from '@/core/KnowledgeBase';
import { setting } from '@/settings';

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

export default class TaskClassifyNode implements AgentNode {
    taskName = "Analysis query";

    async *execute(state: ChatMessage[], query: string): AsyncGenerator<AgentStep> {
        try {
            const {selected_task, response} = await b.PlanNextStep(query, inital_tasks)
        
                    // Yield the planned step
            yield {
                type: 'notice',
                content: `Planned next step: ${selected_task}`,
                task: selected_task
            }

            yield {
                type: 'push',
                content: response,
                isFinal: true,
                task: selected_task
            }

            let next_node
            switch(selected_task) {
                case "Execute_RAG":
                    next_node =  new ExecuteRAGNode(new KnowledgeBase(setting)).execute(state, query)
                    for await(const i of next_node) yield i
                default:
            }
        } catch (error) {
            throw(error)
        }
    }

}