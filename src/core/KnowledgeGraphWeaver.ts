import { ReferenceDocument, default as ReferenceDocumentStorage } from '../database/referenceDocumentStorage';
import { ChunkDocument, default as ChunkStorage } from '../database/chunkStorage';
import { surrealDBClient } from '../database/surrealdbClient';
import { semantic_chunking } from '../lib/chunking/semantic_chunking';
import { gte_Qwen2_7B_instruct_Embedding } from '../lib/embedding';
import Logger from '../lib/console/logger';
import { RecordId } from 'surrealdb';
import pLimit from 'p-limit';
import entities_extraction_workflow from '@/lib/llm_workflow/entities_extraction_workflow';
import { entity_type } from '@/promp';
import { Entity, Relation } from 'baml_client';
import relations_extract_workflow from '@/lib/llm_workflow/relations_extract_workflow';
import EntityStorage from '../database/EntityStorage'; // Import EntityStorage
import { b } from 'baml_client'; // Import the BAML client as 'b'
// import { EntityRecord, RelationRecord } from '@/type';


export interface KnowledgeGraphWeaverConfig {
    chunkTableName: string;
    embeddingConcurrencyLimit: number;
    relation_table_name: string;
    // Add other configuration options as needed, e.g., chunking options
}

export default class KnowledgeGraphWeaver {

    private logger: Logger;
    private referenceDocumentStorage: ReferenceDocumentStorage;
    private chunkStorage!: ChunkStorage; // Definite assignment assertion
    private entityStorage!: EntityStorage; // Definite assignment assertion
    private config: KnowledgeGraphWeaverConfig;

    private async initializeStorages() {
        const db = await surrealDBClient.getDb();
        this.chunkStorage = new ChunkStorage(
            db,
            this.config.chunkTableName,
            gte_Qwen2_7B_instruct_Embedding
        );
        this.entityStorage = new EntityStorage(db);
    }

    constructor(config: KnowledgeGraphWeaverConfig) {
        this.config = config;
        this.logger = new Logger('KnowledgeGraphWeaver');
        this.referenceDocumentStorage = new ReferenceDocumentStorage();
        this.initializeStorages().catch(error => {
            this.logger.error("Failed to initialize storage instances:", error);
        });
    }

    /**
     * Saves the generated knowledge graph to the reference document storage.
     * @returns {string|null} - Returns the ReferenceDocument's ID if the knowledge graph is saved successfully, otherwise null.
     */
    async save_to_reference_document_storage(file_path: string): Promise<RecordId|null> {
        try {

            const content = await require('fs').promises.readFile(file_path, 'utf-8');
            const plainText = content; // For now, plain text is the same as content

            // Simple hash calculation (can be replaced with a more robust method if needed)
            const simpleHash = (str: string): string => {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    const char = str.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash; // Convert to 32bit integer
                }
                return hash.toString();
            };

            // Create a ReferenceDocument object (without id, which is handled by storage)
            const referenceDocument: ReferenceDocument = {
                type: 'markdown', // Or another appropriate type
                content: content,
                plainText: plainText,
                hash: simpleHash(content + plainText), // Calculate and add hash
                metadata: {
                    // Add any relevant metadata here
                    generatedAt: new Date().toISOString(),
                },
            };

            // Use ReferenceDocumentStorage to save the document
            const savedDocument = await this.referenceDocumentStorage.addReferenceDocument(referenceDocument);

            this.logger.info("Knowledge graph saved to reference document storage with ID:", savedDocument.id);
            return savedDocument.id || null;

        } catch (error) {
            this.logger.error("Failed to save knowledge graph to reference document storage:", error);
            return null;
        }
    }

    async chunking_and_embedding(id: RecordId) {
        this.logger.debug(`Starting chunking_and_embedding for ID: ${id}`);
        try {
            // 1. 从ReferenceDocument，根据传入的RecordId获取对应记录
            this.logger.debug(`Attempting to get reference document with ID: ${id}`);
            const referenceDocument = await this.referenceDocumentStorage.getReferenceDocument(id);
            this.logger.debug(`Finished getting reference document. Found: ${!!referenceDocument}`);

            if (!referenceDocument) {
                this.logger.error(`Reference document with ID ${id.id} not found.`);
                this.logger.debug(`Exiting chunking_and_embedding due to document not found.`);
                return;
            }

            // 2. 使用'src/lib/chunking/semantic_chunking.ts' 方法对ReferenceDocument进行切片
            this.logger.debug(`Starting semantic chunking for document ID: ${id.id}`);
            const chunks = await semantic_chunking(referenceDocument.plainText);
            this.logger.info(`Chunked document into ${chunks.length} chunks.`);
            this.logger.debug(`Semantic chunking finished. Generated ${chunks.length} chunks.`);

            // 3. 使用'src/lib/embedding.ts' 的 `gte_Qwen2_7B_instruct_Embedding`对chunks进行批量同步嵌入；使用p-limit限制并发；最终数据组装成`ChunkDocument`类型数据
            this.logger.debug(`Starting embedding process with concurrency limit: ${this.config.embeddingConcurrencyLimit}`);
            const limit = pLimit(this.config.embeddingConcurrencyLimit);
            const chunkDocuments: Omit<ChunkDocument, 'id'>[] = [];
            this.logger.debug(`Created p-limit instance and initialized chunkDocuments array.`);

            const embeddingPromises = chunks.map(async (chunkContent) => {
                return limit(async () => {
                    const embedding = await gte_Qwen2_7B_instruct_Embedding(chunkContent);
                    if (embedding) {
                        chunkDocuments.push({
                            referenceIds: [id.id], // Link chunk to the reference document
                            embedding: embedding,
                            content: chunkContent,
                            metadata: {
                                referenceDocumentId: id.id,
                                // Add other relevant metadata
                            },
                        });
                    } else {
                        this.logger.warning(`Failed to generate embedding for a chunk.`);
                    }
                });
            });

            this.logger.debug(`Mapping chunks to embedding promises.`);
            await Promise.all(embeddingPromises);
            this.logger.debug(`All embedding promises resolved.`);

            this.logger.info(`Generated ${chunkDocuments.length} chunk documents with embeddings.`);

            // 4. 使用'src/database/chunkStorage.ts' 保存嵌入后的结果
            // The upsert method in ChunkStorage expects a Record<string, Omit<ChunkDocument, 'id'>>
            this.logger.debug(`Preparing chunk documents for upsert. Total chunks: ${chunkDocuments.length}`);
            // The upsert method in ChunkStorage expects a Record<string, Omit<ChunkDocument, 'id'>>
            // We need to generate unique IDs for each chunk document before upserting
            const chunkDocumentsWithIds: Record<string, Omit<ChunkDocument, 'id'>> = {};
            chunkDocuments.forEach((chunk, index) => {
                this.logger.debug(`Generating ID for chunk index ${index}`);
                 // Generate a simple unique ID for the chunk, e.g., using reference ID and index
                const chunkId = `${id.id}_chunk_${index}`;
                chunkDocumentsWithIds[chunkId] = chunk;
            });


            this.logger.debug(`Calling chunkStorage.upsert with ${Object.keys(chunkDocumentsWithIds).length} documents.`);
            await this.chunkStorage.upsert(chunkDocumentsWithIds);
            this.logger.info(`Saved ${chunkDocuments.length} chunk documents to storage.`);
            this.logger.debug(`chunkStorage.upsert call completed.`);
            this.logger.debug(`Finished chunking_and_embedding for ID: ${id}`);

        } catch (error) {
            this.logger.error("Error during chunking and embedding:", error);
            this.logger.debug(`Caught error during chunking_and_embedding: ${error}`);
        }
    }

    async entities_extraction(id: RecordId): Promise<Entity[]> {
        const chunk_tobe_extracted = await this.chunkStorage.get_by_id(id);
        if(chunk_tobe_extracted){
            const extractedEntities = await entities_extraction_workflow(chunk_tobe_extracted.content, entity_type);
            return extractedEntities
        }
        else{
            // this.logger.error(`Chunk with ID ${id} not found for entity extraction.`);
            throw new Error(`Chunk with ID ${id} not found for entity extraction.`);
        }
    }


    async relation_extraction(id: RecordId, entities: Entity[]): Promise<Relation[]> {
        const chunk_tobe_extracted = await this.chunkStorage.get_by_id(id);
        if(!chunk_tobe_extracted){
            this.logger.error(`Chunk with ID ${id} not found for relation extraction.`);
            return [];
        }
        this.logger.debug(`Starting relation extraction for ID: ${id} with entities: ${JSON.stringify(entities)}`);
        // Implement your relation extraction logic here
        const relations = await relations_extract_workflow(chunk_tobe_extracted.content, entities, 'zh');
        this.logger.debug(`Finished relation extraction. Extracted relations: ${JSON.stringify(relations)}`);
        return relations
        
    }

    /**
     * Checks if an entity with the same name exists and merges if it does, otherwise creates a new entity.
     * @param entity The entity to check and merge or create.
     * @returns The RecordId of the saved or merged entity.
     */
    private async checkAndMergeEntity(entity: Entity, chunkId: RecordId): Promise<RecordId> {
        this.logger.debug(`Checking and merging entity: ${JSON.stringify(entity)}`);
        // const existingEntities = await this.entityStorage.findEntityByName(entity.name);
        this.logger.info(`Entity with name "${entity.name}" not found. Creating new entity.`);
        const createdEntities = await this.entityStorage.createNode(entity);
        const referenceDb = await surrealDBClient.getDb();
        await referenceDb.insertRelation("reference", {
                    in: createdEntities[0].id,
                    out: chunkId,
                });
        if (createdEntities.length > 0) {
            this.logger.info(`Created new entity with ID: ${createdEntities[0].id}`);
            return createdEntities[0].id;
        } else {
            throw new Error(`Failed to create entity: ${entity.name}`);
        }

        // if (existingEntities.length > 0) {
        //     const existingEntity = existingEntities[0];
        //     this.logger.info(`Entity with name "${entity.name}" already exists. Merging properties into ID: ${existingEntity.id}`);
        //     // Merge properties from the new entity into the existing one

        //     const mergedDefinition = b.MergeEntities({
        //         name: existingEntity.name,
        //         description: existingEntity.description,
        //         type: existingEntity.type
        //     },entity)

        //     this.logger.info("merged definition:",mergedDefinition)
        //     await this.entityStorage.updateNode(existingEntity.id, {...entity, description: mergedDefinition});
        //     this.logger.debug(`Merged properties for entity ID: ${existingEntity.id}`);
        //     return existingEntity.id;
        // } else {
        //     this.logger.info(`Entity with name "${entity.name}" not found. Creating new entity.`);
        //     const createdEntities = await this.entityStorage.createNode(entity);
        //     const referenceDb = await surrealDBClient.getDb();
        //     await referenceDb.insertRelation("reference", {
        //                 in: createdEntities[0].id,
        //                 out: chunkId,
        //             });
        //     if (createdEntities.length > 0) {
        //         this.logger.info(`Created new entity with ID: ${createdEntities[0].id}`);
        //         return createdEntities[0].id;
        //     } else {
        //         throw new Error(`Failed to create entity: ${entity.name}`);
        //     }
        // }
    }

    /**
     * Generates the knowledge graph for a given chunk.
     * @param chunkId The RecordId of the chunk to generate the knowledge graph from.
     */
    async generate_kg(chunkId: RecordId): Promise<void> {
        this.logger.info(`Starting knowledge graph generation for chunk ID: ${chunkId}`);
        try {
            // 1. Extract entities
            const entities = await this.entities_extraction(chunkId);
            this.logger.info(`Extracted ${entities.length} entities.`);

            // 2. Process entities (check existence and merge/create)
            const entityIdMap = new Map<string, RecordId>();
            for (const entity of entities) {
                const entityId = await this.checkAndMergeEntity(entity, chunkId);
                entityIdMap.set(entity.name, entityId);
            }
            this.logger.info(`Processed ${entityIdMap.size} unique entities.`);

            // 3. Extract relations
            const relations = await this.relation_extraction(chunkId, entities);
            this.logger.info(`Extracted ${relations.length} relations.`);

            // 4. Ensure all entities referenced in relations exist and save relations
            const processedRelationNames = new Set<string>(); // To avoid processing the same relation multiple times

            for (const relation of relations) {
                 // Generate a unique key for the relation to check if it's already processed
                const relationKey = `${relation.source_entity}-${relation.relation}-${relation.target_entity}`;
                if (processedRelationNames.has(relationKey)) {
                    continue; // Skip if already processed
                }

                // Check if source entity exists, create if not
                if (!entityIdMap.has(relation.source_entity)) {
                    this.logger.info(`Source entity "${relation.source_entity}" not found. Creating new entity.`);
                    // Create a basic entity with just the name
                    const newEntity: Entity = { name: relation.source_entity, description: '', type: 'Unknown' }; // Provide default values
                    const createdEntities = await this.entityStorage.createNode(newEntity);
                    // create entity--reference-->chunk
                    const db = await surrealDBClient.getDb();
                    await db.insertRelation("reference", {
                        in: createdEntities[0].id,
                        out: chunkId,
                        // data: { description: relation.relationship_description } // Include relation properties
                    });

                    if (createdEntities.length > 0) {
                        this.logger.info(`Created new source entity with ID: ${createdEntities[0].id}`);
                        entityIdMap.set(relation.source_entity, createdEntities[0].id);
                    } else {
                        this.logger.error(`Failed to create source entity: ${relation.source_entity}. Skipping relation.`);
                        continue; // Skip relation if source entity creation fails
                    }
                }

                // Check if target entity exists, create if not
                if (!entityIdMap.has(relation.target_entity)) {
                    this.logger.info(`Target entity "${relation.target_entity}" not found. Creating new entity.`);
                     // Create a basic entity with just the name
                    const newEntity: Entity = { name: relation.target_entity, description: '', type: 'Unknown' }; // Provide default values
                    const createdEntities = await this.entityStorage.createNode(newEntity);
                    if (createdEntities.length > 0) {
                        this.logger.info(`Created new target entity with ID: ${createdEntities[0].id}`);
                        entityIdMap.set(relation.target_entity, createdEntities[0].id);
                    } else {
                        this.logger.error(`Failed to create target entity: ${relation.target_entity}. Skipping relation.`);
                        continue; // Skip relation if target entity creation fails
                    }
                }

                // Now that both entities are guaranteed to exist in entityIdMap, save the relation
                const fromEntityId = entityIdMap.get(relation.source_entity)!; // Use non-null assertion as we've ensured existence
                const toEntityId = entityIdMap.get(relation.target_entity)!; // Use non-null assertion as we've ensured existence

                this.logger.debug(`Creating relation: ${relation.source_entity} -> ${relation.relation} -> ${relation.target_entity}`);
                const relationDb = await surrealDBClient.getDb();
                const createdRelation = await relationDb.insertRelation(this.config.relation_table_name, {
                    in: fromEntityId,
                    out: toEntityId,
                    relation: relation.relation,
                    // data: { description: relation.relationship_description } // Include relation properties
                });
                this.logger.debug(`Created relation successfully.`);

                // create relation--reference-->chunk
                const db = await surrealDBClient.getDb();
                await db.insertRelation("reference", {
                    in: createdRelation[0].id,
                    out: chunkId,
                    // data: { description: relation.relationship_description } // Include relation properties
                });

                processedRelationNames.add(relationKey); // Mark as processed
            }

            this.logger.info(`Finished processing relations. Total unique entities processed: ${entityIdMap.size}`);

            this.logger.info(`Knowledge graph generation completed for chunk ID: ${chunkId}`);

        } catch (error) {
            this.logger.error(`Error during knowledge graph generation for chunk ID ${chunkId}:`, error);
        }
    }

    async joint_graph() {
        const db = await surrealDBClient.getDb();
        const duplicated_entities_groups = await db.query<{count: number, name: string}[][]>(`SELECT * FROM (SELECT name, count() AS count FROM nodes GROUP BY name) WHERE count > 1;`)
        this.logger.info(`Get ${duplicated_entities_groups[0].length} groups of duplicated entities`)

        // Process each entity name with concurrency control
        const limit = pLimit(5); // Limit to 5 concurrent merges
        const mergePromises = duplicated_entities_groups[0].map(({name}) => {
            return limit(async () => {
                try {
                    await this.merge_entities(name);
                    this.logger.debug(`Successfully processed entity: ${name}`);
                } catch (error) {
                    this.logger.error(`Failed to merge entities for name ${name}:`, error);
                }
            });
        });

        await Promise.all(mergePromises);
        this.logger.info(`Finished processing all duplicated entities`);
    }

    /**
     * 
     * @param entity_name shared name of duplicated entities
     */
    async merge_entities(entity_name: string){
        const db = await surrealDBClient.getDb();
        const duplicated_entities = await db.query<EntityRecord[][]>(`SELECT * FROM nodes WHERE name = "${entity_name}";`)
        
        if (duplicated_entities[0].length < 2) {
            this.logger.info(`No duplicates found for entity: ${entity_name}`);
            return;
        }


        // Use first entity as base for merging
        let mergedEntity = duplicated_entities[0][0];
        
        // Merge all other entities into the base one
        for (let i = 1; i < duplicated_entities[0].length; i++) {
            const currentEntity = duplicated_entities[0][i];
            this.logger.debug(`Merging entity ${currentEntity.id} into ${mergedEntity.id}`);

            // Merge properties using BAML
            const mergedDefinition = await b.MergeEntities(mergedEntity, currentEntity);
            
            // Update the merged entity with new properties
            mergedEntity = {
                ...mergedEntity,
                description: mergedDefinition,
                // type: currentEntity.type || mergedEntity.type
            };

            // Update the merged entity in storage
            await this.entityStorage.updateNode(mergedEntity.id, mergedEntity);

            // Get all relations involving the current entity
            const incomingRelations = await db.query<{id: RecordId, in: RecordId, out: RecordId, relation: string}[][]>(
                `SELECT * FROM ${this.config.relation_table_name} WHERE in = ${currentEntity.id};`
            );
            const outgoingRelations = await db.query<{id: RecordId, in: RecordId, out: RecordId, relation: string}[][]>(
                `SELECT * FROM ${this.config.relation_table_name} WHERE out = ${currentEntity.id};`
            );

            // Delete all existing relations first
            await db.query(
                `DELETE FROM ${this.config.relation_table_name} WHERE in = ${currentEntity.id} OR out = ${currentEntity.id};`
            );

            // Create new relations pointing to merged entity
            for (const rel of incomingRelations[0] || []) {
                await db.insertRelation(this.config.relation_table_name, {
                    in: mergedEntity.id,
                    out: rel.out,
                    relation: rel.relation
                });
            }
            for (const rel of outgoingRelations[0] || []) {
                await db.insertRelation(this.config.relation_table_name, {
                    in: rel.in,
                    out: mergedEntity.id,
                    relation: rel.relation
                });
            }

            this.logger.debug(`Recreated ${incomingRelations[0]?.length || 0} incoming and ${outgoingRelations[0]?.length || 0} outgoing relations for entity ${currentEntity.id}`);

            // Only delete after all relations are recreated
            await this.entityStorage.deleteNode(currentEntity.id);
        }

        this.logger.info(`Successfully merged ${duplicated_entities[0].length} entities for name: ${entity_name}`);
    }
}

interface EntityRecord extends Entity {
    id: RecordId
}
