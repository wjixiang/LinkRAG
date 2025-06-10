import { b } from "baml_client/async_client";
import { Agent, AgentConfig } from "../Agent";
import QueryAnalysisNode from "../QueryAnalysisNode";
import { AgentStep } from "../BaseNode";
import { _handleStream } from "@/lib/utils";

export interface ResearchAgentConfig extends AgentConfig {

}

export default class ResearchAgent extends Agent {
    config: ResearchAgentConfig
    constructor(config: ResearchAgentConfig){
        super(config);
        this.config = config
    }

    async *start(query: string): AsyncGenerator<AgentStep>{
        const eps = await this.query_analysis_node(query) 

        if(eps.subquestions.length===0){
            yield {
                type: "error",
                task: this.config.name,
                content: "Query analysis failed: extracted 0 EPs"
            }
        }

        // Perform research and updating knowledge base
        const research_result = await Promise.all(eps.subquestions.map(async(e)=>{
            const response_proeprty_content = await this.summarize_new_property(
                e.ep_pair.entity,
                e.ep_pair.property
            )

            return {
                ep_pair: e.ep_pair,
                subquestion: e.subquestion,
                content: response_proeprty_content.summary
            }
        }))

        const stream = b.stream.GenerateAnswerEPAbased(query, research_result)
        yield* _handleStream(stream,(i)=>i)
        
        
    }

    async query_analysis_node ( query: string )  {
        const eps = await b.stream.ExtractEP(query, this.config.language).getFinalResponse()
        this.logger.info(`Extracted entity-property pair from query: ${eps.subquestions.map(e=>{
            return e.subquestion + ":" + e.ep_pair.entity + "-->" + e.ep_pair.property
        }).join("\n")}`)
        return eps
    }

    async find_entity_from_kd_node (entityName: string) {
        const entities = await this.knowledgeBase.retriever.entity_keyword_retriever([entityName]);
        return entities
    }
    async handleNewEntityFlow(entityName: string, propertyName: string): Promise<string> {
        this.logger.info(`Entity ${entityName} not found, starting HyDE+RAG flow`);
        
        const entity = await this.knowledgeBase.editor.create_new_entity(entityName);
        const property = await this.knowledgeBase.editor.generate_new_property(entity, propertyName);
        
        return property.content;
    }
    async summarize_new_property(entity: string, property: string) {
        const summary = await b.stream.SummarizeProperty(
            entity,
            property,
            this.config.language
        ).getFinalResponse();
        this.logger.info(`Summarized property ${property} for entity ${entity}`);
        return summary;
    }
}
