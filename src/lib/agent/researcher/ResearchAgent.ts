import { Agent, AgentConfig } from "../Agent";

export interface ResearchAgentConfig extends AgentConfig {

}

export default class ResearchAgent extends Agent {
    config: ResearchAgentConfig
    constructor(config: ResearchAgentConfig){
        super(config);
        this.config = config
    }


}