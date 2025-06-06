interface Message {
    sender: "user" | "agent";
    content: string;
}

export default class Researcher {
    task: string;
    messages: Message[] = [];

    constructor(task: string) {
        this.task = task
    }

    async start() {
        
    }
}