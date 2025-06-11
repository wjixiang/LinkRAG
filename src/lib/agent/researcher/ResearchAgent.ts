import { b } from "baml_client/async_client";
import { Agent, AgentConfig } from "../Agent";
import { AgentStep } from "../BaseNode";
import { _handleStream } from "@/lib/utils";
import { StringDecoder } from "string_decoder";
import { EntityRecord, EntityWithRefDoc } from "@/type";

export interface ResearchAgentConfig extends AgentConfig {
    
}

export default class ResearchAgent extends Agent {
    name = "Researcher"
    config: ResearchAgentConfig

    constructor(config: ResearchAgentConfig){
        super(config);
        this.config = config;
    }

    async *start(query: string): AsyncGenerator<AgentStep>{
        const eps = await this.query_analysis_node(query)

        if(eps.subquestions.length===0){
            yield {
                type: "error",
                task: this.name,
                content: "Query analysis failed: extracted 0 EPs"
            }
        }

        // Perform research with concurrency limit
        const research_result = await Promise.all(eps.subquestions.map(e =>
            this.limiter(() => this.research_entity( // 使用父类的limiter
                e.ep_pair.entity
            ).then(content => ({
                ep_pair: e.ep_pair,
                subquestion: e.subquestion,
                content
            })))
        ));

        // const stream = b.stream.GenerateAnswerEPAbased(query, research_result)
        // yield* _handleStream(stream,(i)=>i)
        
        
    }

    async query_analysis_node ( query: string )  {
        const eps = await b.stream.ExtractEP(query, this.config.language).getFinalResponse()
        this.logger.info(`Extracted entity-property pair from query: \n- ${eps.subquestions.map(e=>{
            return e.subquestion + "\n- " + e.ep_pair.entity + "-->" + e.ep_pair.property
        }).join("\n")}`)
        return eps
    }

    async handleNewEntityFlow(entityName: string): Promise<EntityWithRefDoc> {
        this.logger.info(`Entity ${entityName} not found, starting HyDE+RAG flow`);
        
        const entity = await this.knowledgeBase.editor.create_new_entity(entityName);
        
        return entity;
    }

    research_entity = async(
        entityName: string,
    ): Promise<EntityRecord> => {
        this.logger.debug(`Start retrieving process for entity ${entityName}`);
        
        const entities = await this.knowledgeBase.retriever.entity_keyword_retriever([entityName]);
        
        if (entities.length === 0) {
            this.logger.info(`None entity hitted for: ${entityName}. start extracting new entities`)
            return this.handleNewEntityFlow(entityName);
        } else if (entities.length === 1) {
            this.logger.info(`Hit single entity from knowledgebase for: ${entityName}`)
            return entities[0]
        } else {
            this.logger.info(`Hit multiple entities from knowledgebase for: ${entityName}`)
            // return this.handleMultipleEntitiesFlow(entities, entityName, propertyName);
            throw new Error(`not implement`)
        }
    }


}
