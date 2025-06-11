import winston from 'winston';
import createLoggerWithPrefix from '../lib/console/logger';
import { DocumentProcessor } from './DocumentProcessor';
import { ChunkProcessor } from './ChunkProcessor';
import { GraphGenerator } from './GraphGenerator';
import { GraphMerger } from './GraphMerger';
import EntityStorage from '../database/EntityStorage';
import SourceManager from './SourceManager';
import { KnowledgeGraphProcessor } from './KnowledgeGraphProcessor';
import { RecordId } from 'surrealdb';
import { surrealDBClient } from '../database/surrealdbClient';
import { default as ChunkStorage } from '../database/chunkStorage';
import { embedding } from '../lib/embedding';
import pLimit from 'p-limit';
import { SemanticChunkingConfig, semantic_chunking } from '@/lib/chunking/semantic_chunking';
import { createAlibabaBatchEmbeddingJob } from '@/lib/embedding/AlibabaBatchEmbedder';
import PropertyStorage from './PropertyStorage';
import { EntityExtractor } from './EntityExtractor';
import { b } from 'baml_client/async_client';
import { EntityRecord, EntityWithRefDoc, language } from "@/type";
import { Collector } from "@boundaryml/baml";
import { Property, PropertyGenerateRes } from "baml_client";
import KnowledgeBaseRetriever from './KnowledgeBaseRetriever';
import { ChunkRetriever } from './ChunkRetriever';

export interface KnowledgeBaseEditorConfig {
    chunkTableName: string;
    embeddingConcurrencyLimit: number;
    entity_table_name: string;
    relation_table_name: string;
    reference_table_name: string;
    SemanticChunkingConfig: SemanticChunkingConfig;
    property_table_name: string;
    semantic_search_threshold: number;
    language: language;
}

interface Entity {
    id: RecordId;
    name: string;
    description: string;
    type: string;
    aliases: string[];
}

export default class KnowledgeBaseEditor {
    private logger: winston.Logger;
    documentProcessor: DocumentProcessor = new DocumentProcessor();
    chunkProcessor!: ChunkProcessor;
    graphGenerator!: GraphGenerator;
    graphMerger!: GraphMerger;
    chunkStorage: ChunkStorage;
    entityStorage!: EntityStorage;
    propertyStorage: PropertyStorage;
    config: KnowledgeBaseEditorConfig;
    sourceManager: SourceManager;
    knowledgeGraphProcessor!: KnowledgeGraphProcessor;
    entity_extractor: EntityExtractor;
    collector = new Collector();
    private retriever: KnowledgeBaseRetriever;
    private chunkRetriever: ChunkRetriever;

    constructor(config: KnowledgeBaseEditorConfig) {
        this.config = config;
        this.logger = createLoggerWithPrefix('KnowledgeBaseEditor');
        this.documentProcessor = new DocumentProcessor();
        this.sourceManager = new SourceManager();
        this.entityStorage = new EntityStorage(this.config.entity_table_name, this.config.reference_table_name);
        this.propertyStorage = new PropertyStorage(this.config.property_table_name);
        this.chunkStorage = new ChunkStorage(
            this.config.chunkTableName,
            embedding
        );
        this.retriever = new KnowledgeBaseRetriever({
            chunkTableName: this.config.chunkTableName,
            property_table_name: this.config.property_table_name,
            entity_table_name: this.config.entity_table_name,
            semantic_search_threshold: this.config.semantic_search_threshold,
            language: this.config.language
        });
        this.chunkRetriever = new ChunkRetriever({
            chunkTableName: this.config.chunkTableName,
            property_table_name: this.config.property_table_name, // Not directly used by ChunkRetriever, but required by config
            entity_table_name: this.config.entity_table_name, // Not directly used by ChunkRetriever, but required by config
            semantic_search_threshold: this.config.semantic_search_threshold,
            language: this.config.language
        });
        this.graphGenerator = new GraphGenerator(this.entityStorage, this.chunkStorage, {
            relation_table_name: this.config.relation_table_name,
            reference_table_name: this.config.reference_table_name
        });

        this.chunkProcessor = new ChunkProcessor({
            chunkTableName: this.config.chunkTableName,
            embeddingConcurrencyLimit: this.config.embeddingConcurrencyLimit,
            SemanticChunkingConfig: this.config.SemanticChunkingConfig
        });
        this.graphMerger = new GraphMerger(this.entityStorage, {
            relation_table_name: this.config.relation_table_name,
            reference_table_name: this.config.reference_table_name
        });
        this.knowledgeGraphProcessor = new KnowledgeGraphProcessor(this.config, this.logger);
        this.entity_extractor = new EntityExtractor(this.chunkStorage);
    }

    async weave(file_path: string) {
        await surrealDBClient.connect();

        const reference_document_id = await this.save_to_reference_document_storage(file_path);
        if(!reference_document_id) throw new Error(`Add new document failed: ${file_path}`);

        await this.chunking_and_embedding(reference_document_id);
        await this.generateKgsForReference(reference_document_id);
        await this.graphMerger.jointGraph(20);
        await this.build_global_EPE_graph(20);
    }

    async generateKgsForReference(referenceId: RecordId, ConcurrencyLimit=50): Promise<void> {
        try {
            const db = await surrealDBClient.getDb();
            const result = await db.query<{id: RecordId}[][]>(
                `SELECT id FROM ${this.config.chunkTableName} WHERE referenceIds CONTAINS ${referenceId}`
            );
            
            if (!result || result.length === 0) {
                this.logger.info('No matching chunks found');
                return;
            }

            const recordIds = result[0].map(r => r.id);
            this.logger.info(`Found ${recordIds.length} chunks to process`);

            const limit = pLimit(ConcurrencyLimit);
            await Promise.all(recordIds.map(recordId =>
                limit(async () => {
                    try {
                        this.logger.info(`Starting knowledge graph generation for chunk ID: ${recordId}`);
                        await this.graphGenerator.generateGraph(recordId);
                        this.logger.info(`Knowledge graph generation completed for chunk ID: ${recordId}`);
                    } catch (error) {
                        this.logger.error(`Error processing chunk ${recordId}:`, error);
                    }
                })
            ));
        } catch (error) {
            this.logger.error('Error during knowledge graph generation:', error);
            throw error;
        } finally {
            await surrealDBClient.close();
        }
    }

    async save_to_reference_document_storage(file_path: string): Promise<RecordId | null> {
        return this.documentProcessor.saveToReferenceDocumentStorage(file_path);
    }

    async chunking_and_embedding_from_path(file_path: string): Promise<void> {
        this.logger.debug(`Starting chunking_and_embedding from file path: ${file_path}`);
        try {
            const content = await require('fs').promises.readFile(file_path, 'utf-8');
            
            const metadata = await this.sourceManager.addSource(content, {
                name: file_path.split('/').pop() || file_path,
                type: file_path.endsWith('.pdf') ? 'pdf' :
                      file_path.endsWith('.md') ? 'markdown' : 'txt',
                origin: file_path,
                description: 'Temporary source for chunking and embedding'
            });

            if (!metadata?.id) {
                throw new Error('Failed to create source metadata');
            }

            const storedContent = await this.sourceManager.getSourceContent(metadata.id);
            if (!storedContent) {
                throw new Error(`Failed to get content for file ${file_path}`);
            }

            await this.chunkProcessor.processDocument(metadata.id, storedContent);
            this.logger.debug(`Finished chunking_and_embedding from file path: ${file_path}`);
        } catch (error) {
            this.logger.error(`Error during chunking and embedding from file path ${file_path}:`, error);
            throw error;
        }
    }

    async chunking_and_embedding(id: RecordId) {
        const content = await this.sourceManager.getSourceContent(id);
        if (!content) {
            this.logger.error(`Source content with ID ${id.id} not found.`);
            return;
        }
        
        await this.chunkProcessor.processDocument(id, content);
    }

    async chunking_and_embedding_batch(id: RecordId): Promise<string | null> {
        this.logger.debug(`Starting batch chunking and embedding for ID: ${id}`);
        try {
            const content = await this.sourceManager.getSourceContent(id);
            if (!content) {
                this.logger.error(`Source content with ID ${id.id} not found for batch processing.`);
                return null;
            }

            const chunks = await semantic_chunking(content, this.config.SemanticChunkingConfig);
            this.logger.info(`Chunked document into ${chunks.length} chunks for batch embedding.`);

            const combinedChunks: string[] = [];
            for (let i = 0; i < chunks.length - 1; i++) {
                combinedChunks.push(chunks[i] + ' ' + chunks[i + 1]);
            }
            const allChunks = [...chunks, ...combinedChunks];
            this.logger.info(`Total chunks for batch embedding: ${allChunks.length}`);

            if (allChunks.length === 0) {
                this.logger.warn(`No chunks generated for batch embedding for ID: ${id}`);
                return null;
            }

            const batchJobId = await createAlibabaBatchEmbeddingJob(allChunks);
            this.logger.info(`Alibaba batch embedding job initiated for ID ${id}. Job ID: ${batchJobId}`);

            return batchJobId;
        } catch (error) {
            this.logger.error(`Error during batch chunking and embedding for ID ${id}:`, error);
            throw error;
        }
    }

    async build_global_EPE_graph(concurrencyLimit = 100) {
        return this.knowledgeGraphProcessor.build_global_EPE_graph(concurrencyLimit);
    }

    async summarize_new_property(
        entityName: string,
        propertyName: string,
    ): Promise<string> {
        this.logger.debug(`Starting property summarization for entity ${entityName}, property ${propertyName}`);
        
        const entities = await this.retriever.entity_keyword_retriever([entityName]);
        
        if (entities.length === 0) {
            return this.handleNewEntityFlow(entityName, propertyName);
        } else if (entities.length === 1) {
            return this.handleSingleEntityFlow(entities[0], entityName, propertyName);
        } else {
            return this.handleMultipleEntitiesFlow(entities, entityName, propertyName);
        }
    }

    async generate_new_property(entity: EntityWithRefDoc | EntityRecord, propertyName: string) {
        const collector = this.collector;
        const hydeResult = await b.HyDEHypothesizeProperty(entity.name, propertyName, {collector});
        const chunks = await this.chunkRetriever.retrieve(hydeResult.hypothesis, 10);
        const property = await b.GenerateProperty(
            `What is ${propertyName} of ${entity.name} ?`,
            chunks.map(e => {
                return {
                    content: e.document.content,
                    metadata: String(e.score)
                }
            }),
            "zh", {collector}
        );
        
        const property_save_res = await this.propertyStorage.storeProperty(
            entity.id,
            {
                prop_name: propertyName,
                content: property.content,
            }, chunks.filter((c, index) => (index + 1) in property.referenceIndex).map(c => new RecordId(this.config.chunkTableName, c.document.id.id)));

        await this.extract_entity_from_property({
            prop_name: propertyName, 
            content: property.content,
            id: property_save_res[0].id}, entity);
        return property;
    }

    async extract_entity_from_property(property: Property & {id: RecordId}, core_entity: Entity) {
        const entities = await this.entity_extractor.extract_entities_from_property(core_entity, property);
        this.logger.info(`Extract ${entities.length} entities from property`);

        const entities_validate_res = await this.entityStorage.validate_entities_existance(entities);
        this.logger.info(`Entities validation result: ${JSON.stringify(entities_validate_res)}`);

        const entities_create_res = await Promise.all(entities_validate_res.nonExisting.map(async(e)=>await this.create_new_entity(e.name)));

        const db = await surrealDBClient.getDb();
        const superset_link_creat_res = await Promise.all([...entities_create_res,...entities_validate_res.existing].map(async(e)=>{
            return (await db.insertRelation("superset", {
                in: property.id,
                out: e.id
            }))[0]
        }));
        this.logger.info(`Create ${superset_link_creat_res.length} new property-->entity connection`);
    }

    private async handleNewEntityFlow(entityName: string, propertyName: string): Promise<string> {
        this.logger.info(`Entity ${entityName} not found, start extracting flow`);
        
        const entity = await this.create_new_entity(entityName);
        const property = await this.generate_new_property(entity, propertyName);
        
        return property.content;
    }

    private async handleSingleEntityFlow(entity: Entity, entityName: string, propertyName: string): Promise<string> {
        this.logger.info(`Found single entity ${entity.name}, checking consistency`);
        
        if (entity.name.toLowerCase() !== entityName.toLowerCase()) {
            const selected = await b.SelectMostMatchingEntity(
                [entity.name],
                entityName
            );
            if (!selected) {
                return this.handleNewEntityFlow(entityName, propertyName);
            }
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
        
        const selected = await b.SelectMostMatchingEntity(
            entities.map(e => e.name),
            entityName
        );
        if (!selected) {
            return this.handleNewEntityFlow(entityName, propertyName);
        }
        
        const matchedEntity = entities.find(e => e.name === selected.entity);
        if (!matchedEntity) {
            return this.handleNewEntityFlow(entityName, propertyName);
        }
        
        return this.handlePropertyFlow(matchedEntity, propertyName);
    }

    private async handlePropertyFlow(entity: Entity, propertyName: string): Promise<string> {
        const existingProperty = await this.propertyStorage.getProperty(entity.id, propertyName);
        
        if (existingProperty) {
            this.logger.info(`Property ${propertyName} exists, updating summary`);
            
            const chunks = await this.chunkRetriever.retrieve(propertyName, 10);
            const context = chunks.map(c => c.document.content).join('\n\n');
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
            
            await this.propertyStorage.updateProperty(
                entity.id,
                { name: propertyName, summary: updatedSummary.summary }
            );
            
            return updatedSummary.summary;
        } else {
            this.logger.info(`Property ${propertyName} doesn't exist, creating new`);
            const property = await this.generate_new_property(entity, propertyName);
            
            return property.content;
        }
    }

    /**
     * Extract & save new entity based on RAG
     * @param entityName 
     * @returns 
     */
    async create_new_entity(entityName: string): Promise<EntityWithRefDoc> {
        const stream = b.stream.HyDEDefineEntity(entityName, this.config.language);
        const HydeEntity = await stream.getFinalResponse()
        
        const retrieved_chunks = await this.chunkRetriever.retrieve(`${HydeEntity.name} ${HydeEntity.description}`, 10);
        const entity_definition = await b.stream.DefineEntityWithReferences(
            entityName,
            retrieved_chunks.map(e => e.document.content),
            this.config.language
        ).getFinalResponse()
        const {reference, ...entity} = entity_definition;

        const entity_with_ref_doc = {
            ...entity,
            referenceDoc: retrieved_chunks.filter((e, index) => {
                return (index + 1) in entity_definition.reference
            }).map(e => new RecordId(this.config.chunkTableName, e.document.id.id))
        };

        const entity_create_result = await this.entityStorage.createEntity(entity_with_ref_doc);
        return {id: entity_create_result[0].id, ...entity_with_ref_doc};
    }
}
