import { b } from "baml_client/async_client";
import { Agent, AgentConfig } from "../Agent";
import { AgentStep } from "../BaseNode";
import { _handleStream } from "@/lib/utils";
import { StringDecoder } from "string_decoder";
import { EntityRecord, EntityWithRefDoc, PropertyRecord } from "@/type";
import { RecordId } from "surrealdb";
import { EPA_result, EPpair } from "baml_client/types";
import { EP_pair } from '../../../../baml_client/types';

export interface ResearchAgentConfig extends AgentConfig {
    
}

interface ResearchResult {
    subquestion: string;
    ep_pair: EPpair;
    retrieved_entity: EntityRecord;
    retrieved_properties: PropertyRecord[];
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

        // First get unique entities to avoid duplicate research
        const uniqueEntities = [...new Set(eps.subquestions.map(e => e.ep_pair.entity))];
        
        // Research unique entities with concurrency limit
        const entityResearchMap = new Map<string, EntityRecord>();
        await Promise.all(uniqueEntities.map(entityName =>
            this.limiter(async () => {
                const result = await this.research_entity(entityName);
                entityResearchMap.set(entityName, result);
            })
        ));

        // Map back to original subquestions with research results
        const entities_research_result = eps.subquestions.map(e => ({
            retrieved_entity: entityResearchMap.get(e.ep_pair.entity)!,
            ...e
        }));

        const research_result: ResearchResult[] = await Promise.all(entities_research_result.map(e=>
            this.limiter(async () => {
                return {
                    retrieved_properties: await this.research_property(e),
                    ...e
                }
            })
        ))

        const context = research_result.map(r => this.parse_ep_context(r));
        const stream = b.stream.GenerateAnswerEPAbased(query, context);
        yield* _handleStream(stream, (i) => i);
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
            this.logger.warn(`Function not implement when hitting multiple entities`)
            return entities[0]
        }
    }

    research_property = async(
        e: {
            subquestion: string,
            ep_pair: EPpair,
            retrieved_entity: EntityRecord
        }
    ): Promise<PropertyRecord[]> => {
        const properties = await this.knowledgeBase.retriever.property_keyword_retriever(e.ep_pair.property, e.retrieved_entity.id);
        this.logger.debug(`${JSON.stringify(properties)}`)
        this.logger.info(`Keyword matched ${properties.length} properties for: ${e.ep_pair.property}`)

        if(properties.length===0){
            this.logger.info(`Start property researching`)
            const generated_property = await this.generate_new_property(e.retrieved_entity,e.ep_pair.property)
            return [{
                id: generated_property.id,
                core_entity_id: e.retrieved_entity.id,
                core_entity_name: e.ep_pair.entity,
                prop_name: e.ep_pair.property,
                content: generated_property.content
            }]
        }

        return properties
    }

    parse_ep_context = (research_result: ResearchResult): EPA_result => {
        const { subquestion, ep_pair, retrieved_entity, retrieved_properties } = research_result;
        
        return {
            subquestion,
            ep_pair,
            content: retrieved_properties.map(e=>`${e.content}`).join("\n")
        };
    }

    async generate_new_property(entity: EntityWithRefDoc | EntityRecord, propertyName: string) {
        const hydeResult = await b.HyDEHypothesizeProperty(entity.name, propertyName);
        const chunks = await this.knowledgeBase.retriever.chunks_retriver(hydeResult.hypothesis, 10);
        const property = await b.GenerateProperty(
            `What is ${propertyName} of ${entity.name} ?`,
            chunks.map(e => {
                return {
                    content: e.document.content,
                    metadata: String(e.score)
                }
            }),
            "zh"
        );
        
        const property_save_res = await this.knowledgeBase.editor.propertyStorage.storeProperty(
            entity.id,
            {
                prop_name: propertyName,
                content: property.content,
            }, chunks.filter((c, index) => (index + 1) in property.referenceIndex).map(c => new RecordId(this.knowledgeBase.retriever.config.chunkTableName, c.document.id.id)));

        await this.knowledgeBase.editor.extract_entity_from_property({
            prop_name: propertyName, 
            content: property.content,
            id: property_save_res[0].id}, entity);
        return {
            id: property_save_res[0].id,
            ...property
        };
    }
}
