import KnowledgeGraphRetriever from "./KnowledgeGraphRetriever";
import createLoggerWithPrefix from "../lib/console/logger";
import { b } from 'baml_client/async_client';
import KnowledgeGraphWeaver from './KnowledgeGraphWeaver';


export default class Learner {
    private logger: ReturnType<typeof createLoggerWithPrefix>;
    private retriever: KnowledgeGraphRetriever;
    private weaver: KnowledgeGraphWeaver

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
        
        // First try to retrieve the entity
        const entities = await this.retriever.entity_keyword_retriever([entityName]);
        
        if (entities.length > 0) {
            // Entity exists - summarize based on existing properties
            const entity = entities[0];
            this.logger.info(`Found existing entity ${entity.name}, summarizing property`);
            return `Summarized property "${propertyName}" for existing entity "${entity.name}"`;
        } else {
            this.logger.info(`Entity ${entityName} not found, starting HyDE+RAG flow`);
            const entity_definition = await this.create_new_entity(entityName)  
            // TODO: Store the new entity and property in the knowledge graph
            
            

            return entity_definition.description
        }
    }

    async create_new_entity(entityName: string) {
        const HydeEntity = await b.HyDEDefineEntity(entityName, "zh")
        
        const retrieved_chunks = await this.retriever.chunks_retriver(HydeEntity.name+HydeEntity, 10)
        const entity_definition = await b.DefineEntityWithReferences(entityName, retrieved_chunks.map(e=>e.document.content), "中文")
        return entity_definition
    }
}

