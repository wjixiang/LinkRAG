import { ChatMessage } from '@/components/MessageItem';
import { Agent } from './Agent';
import { AgentNode, AgentStep, BaseNode } from './BaseNode';
import { Task } from 'baml_client/types';
import { b } from 'baml_client/async_client';
import { _handleStream } from '../utils';

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

export default class TaskClassifyNode extends BaseNode {
    taskName = "Plan next step";
    
    constructor(agent: Agent) {
        super(agent);
    }

    protected async *work(state: ChatMessage[], query: string): AsyncGenerator<AgentStep, { nextTask: string } > {
        const stream =  b.stream.PlanNextStep(query, inital_tasks)
        yield* _handleStream(stream, (i) => (i.response ?? ""));
        const {selected_task} = await stream.getFinalResponse()

        if (!selected_task) {
            throw new Error('No task selected');
        }
        return {
            nextTask: selected_task
        }

        // const next_node = this.agent.getNode(selected_task)?.execute(this.agent.state, query);
        // if(next_node) for await(const i of next_node) yield i
    }

    protected proceed(result: { nextTask: string; data?: any; }): AgentNode|null  {
        return this.agent.getNode(result.nextTask) ?? null
    }

}