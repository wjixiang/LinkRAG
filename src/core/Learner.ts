import KnowledgeGraphRetriever from "./KnowledgeGraphRetriever";
import createLoggerWithPrefix from "../lib/console/logger";
import { b } from 'baml_client/async_client';
import KnowledgeGraphWeaver from './KnowledgeGraphWeaver';
import { RecordId } from "surrealdb";
import type EntityStorage from "../database/EntityStorage";
import type PropertyStorage from "../core/PropertyStorage";
import { EntityRecord, EntityWithRefDoc } from "@/type";
import { Collector } from "@boundaryml/baml";
import { PropertyGenerateRes } from "baml_client";
import { surrealDBClient } from "@/database/surrealdbClient";

interface Entity {
    id: RecordId;
    name: string;
    description: string;
    type: string;
    aliases: string[];
}

interface EntityMatch {
    entity: string;
    confidence: number;
}

interface HypothesizedProperty {
    hypothesis: string;
}

interface RetrievedPropertyInfo {
    information: string;
    sources: string[];
}

interface PropertySummary {
    summary: string;
}



export default class Learner {
    private logger: ReturnType<typeof createLoggerWithPrefix>;
    private retriever: KnowledgeGraphRetriever;
    private weaver: KnowledgeGraphWeaver
    collector = new Collector()

    constructor(retriever: KnowledgeGraphRetriever, weaver: KnowledgeGraphWeaver) {
        this.retriever = retriever;
        this.weaver = weaver;
        this.logger = createLoggerWithPrefix('Learner');
    }

    async summarize_new_property(
        entityName: string,
        propertyName: string,
    ): Promise<string> {
        this.logger.debug(`Starting property summarization for entity ${entityName}, property ${propertyName}`);
        
        // Step B: Retrieve entity
        const entities = await this.retriever.entity_keyword_retriever([entityName]);
        
        if (entities.length === 0) {
            // Step C2: Entity doesn't exist
            return this.handleNewEntityFlow(entityName, propertyName);
        } else if (entities.length === 1) {
            // Step C4: Single entity found
            return this.handleSingleEntityFlow(entities[0], entityName, propertyName);
        } else {
            // Step C5: Multiple entities found
            return this.handleMultipleEntitiesFlow(entities, entityName, propertyName);
        }
    }

    /**
     * generate new property summary
     * @param entity 
     * @param propertyName 
     * @returns 
     */
    async generate_new_property(entity: EntityWithRefDoc | EntityRecord, propertyName: string ) {
        const collector = this.collector
        const hydeResult = await b.HyDEHypothesizeProperty(entity.name, propertyName, {collector});
        const chunks = await this.retriever.chunks_retriver(hydeResult.hypothesis, 10);
        const property = await b.GenerateProperty(
            `What is ${propertyName} of ${entity.name} ?`,
            chunks.map(e=>{
                return {
                    content: e.document.content,
                    metadata: String(e.score)
                }
            }),
            "zh", {collector}
        );
        
        const property_save_res = await this.weaver.propertyStorage.storeProperty(
            entity.id, 
            {
                prop_name: propertyName,
                content: property.content,
            }, chunks.map((c: any) => c.document.id).filter((e,index)=>(index+1) in property.referenceIndex));

        await this.extract_entity_from_property({...property, id: property_save_res[0].id})
        return property
    }

    async extract_entity_from_property(property: PropertyGenerateRes & {id: RecordId}) {
        const entities = await this.weaver.entity_extractor.extract_entities_from_content(property.content)
        this.logger.info(`Extract ${entities.length} entities from property`)

        const entities_validate_res = await this.weaver.entityStorage.validate_entities_existance(entities)
        this.logger.info(`Entities validation result: ${JSON.stringify(entities_validate_res)}`)

        // Create new entities for those not existed
        const entities_create_res = await Promise.all(entities_validate_res.nonExisting.map(async(e)=>await this.create_new_entity(e.name)))

        // Create superset connect between entities and property (backlink)
        const db = await surrealDBClient.getDb()
        const superset_link_creat_res = await Promise.all([...entities_create_res,...entities_validate_res.existing].map(async(e)=>{
            return (await db.insertRelation("superset", {
                in: property.id,
                out: e.id
            }))[0]
        }))
        this.logger.info(`Create ${superset_link_creat_res.length} new property-->entity connection`)
    }

    private async handleNewEntityFlow(entityName: string, propertyName: string): Promise<string> {
        this.logger.info(`Entity ${entityName} not found, starting HyDE+RAG flow`);
        
        // Step D1-D4: Create new entity
        const entity = await this.create_new_entity(entityName);
        
        const property = await this.generate_new_property(entity, propertyName)
        
        return property.content;
    }

    private async handleSingleEntityFlow(entity: Entity, entityName: string, propertyName: string): Promise<string> {
        this.logger.info(`Found single entity ${entity.name}, checking consistency`);
        
        // Step f1: Check entity consistency
        if (entity.name.toLowerCase() !== entityName.toLowerCase()) {
            // Step f12: Inconsistent entity name
            const selected = await b.SelectMostMatchingEntity(
                [entity.name],
                entityName
            );
            if (!selected) {
                return this.handleNewEntityFlow(entityName, propertyName);
            }
            // Convert EntityMatch to Entity
            const matchedEntity: Entity = {
                ...entity,
                name: selected.entity
            };
            return this.handlePropertyFlow(matchedEntity, propertyName);
        }
        
        return this.handlePropertyFlow(entity, propertyName);
    }

    private async handleMultipleEntitiesFlow(entities: Entity[], entityName: string, propertyName: string): Promise<string> {
        this.logger.info(`Found multiple entities (${entities.length}), selecting best match`);
        
        // Step j1: Select most matching entity
        const selected = await b.SelectMostMatchingEntity(
            entities.map(e => e.name),
            entityName
        );
        if (!selected) {
            return this.handleNewEntityFlow(entityName, propertyName);
        }
        
        // Find the full entity from the selected name
        const matchedEntity = entities.find(e => e.name === selected.entity);
        if (!matchedEntity) {
            return this.handleNewEntityFlow(entityName, propertyName);
        }
        
        return this.handlePropertyFlow(matchedEntity, propertyName);
    }

    private async handlePropertyFlow(entity: Entity, propertyName: string): Promise<string> {
        // Step f2: Check if property exists
        const existingProperty = await this.weaver.propertyStorage.getProperty(entity.id, propertyName);
        
        if (existingProperty) {
            // Step g11: Property exists - summarize and update
            this.logger.info(`Property ${propertyName} exists, updating summary`);
            
            const chunks = await this.retriever.chunks_retriver(propertyName, 10);
            const context = chunks.map((c: any) => c.document.content).join('\n\n');
            const newSummary = await b.SummarizeProperty(
                entity.name,
                propertyName,
                context
            );
            
            const updatedSummary = await b.UpdateSummary(
                existingProperty.summary,
                newSummary.summary,
                entity.name,
                propertyName
            );
            
            await this.weaver.propertyStorage.updateProperty(
                entity.id,
                { name: propertyName, summary: updatedSummary.summary }
            );
            
            return updatedSummary.summary;
        } else {
            // Step g12: Property doesn't exist - create new
            this.logger.info(`Property ${propertyName} doesn't exist, creating new`);
            const property = await this.generate_new_property(entity, propertyName)
            
            return property.content;
        }
    }

    async create_new_entity(entityName: string): Promise<EntityWithRefDoc> {
        const HydeEntity = await b.HyDEDefineEntity(entityName, "zh");
        
        const retrieved_chunks = await this.retriever.chunks_retriver(`${HydeEntity.name} ${HydeEntity.description}`, 10);
        const entity_definition = await b.DefineEntityWithReferences(
            entityName,
            retrieved_chunks.map((e: any) => e.document.content),
            "中文"
        );
        const {reference, ...entity} = entity_definition;

        // Convert EntityWithRef to EntityWithRefDoc by transforming reference to referenceDoc
        const entity_with_ref_doc = {
            ...entity,
            referenceDoc: retrieved_chunks.filter((e: any, index: number) => {
                return (index + 1) in entity_definition.reference
            }).map((e: any) => e.document.id)
        };

        const entity_create_result = await this.weaver.entityStorage.createEntity(entity_with_ref_doc);
        return {id: entity_create_result[0].id, ...entity_with_ref_doc};
    }
}
