import dotenv from 'dotenv';

dotenv.config();

import { MilvusClient, DataType, FunctionType } from "@zilliz/milvus2-sdk-node";
import Logger from '../lib/console/logger';
import { embeddingInstance } from '../type';

interface MilvusVectorStorageConfig {
    StorageNameSpace: string;
    embedding_ins: embeddingInstance;
    cosine_better_than_threshold: number;
}

/**
 * data structure for MilvusVectorStorage(not include `dense_vector` and `sparse_vector`)
 */
export interface VectorStorageDocument {
    id: string;
    description: string;
    referenceIds: string; // use JSON.stringfy to convert `referenceIds: string[]` into `string`
}

/**
 * MilvusVectorStorage class for managing vector storage in Milvus, for graphRAG
 */
export default class MilvusVectorStorage {
    StorageNameSpace: string; // Using string for StorageNameSpace
    embedding_ins: embeddingInstance;
    cosine_better_than_threshold: number = 0.2; // Using number for float
    meta_fields: Set<string> = new Set(); // Using Set for set
    private milvusClient: MilvusClient;
    private logger: Logger;

    constructor(config: MilvusVectorStorageConfig) {
        this.logger = new Logger("MilvusVectorStorage");
        this.embedding_ins = config.embedding_ins
        this.StorageNameSpace = config.StorageNameSpace
        // Initialize Milvus client using environment variables
        if (!process.env.MILVUS_URI) {
            throw new Error("env empty: MILVUS_URI");
        }
        this.milvusClient = new MilvusClient({
            address: process.env.MILVUS_URI,
            // timeout: parseInt(process.env.MILVUS_CLIENT_TIMEOUT || '30000'), // Use env variable with fallback
            // username: process.env.MILVUS_USERNAME,
            // password: process.env.MILVUS_PASSWORD,
            // token: process.env.TOKEN,
            // tls: {
            //     skipCertCheck: true, // Disable SSL certificate verification
            // }
        });
    }

    /**
     * test script: `npx tsx src/test_script/test-milvus-create-collection.ts  `
     */
    async create_collection(): Promise<void> {
        // Define the schema based on VectorStorageDocument and vector fields
        const schema = {
            collection_name: this.StorageNameSpace,
            fields: [
                {
                    name: "id",
                    data_type: DataType.VarChar,
                    is_primary_key: true,
                    max_length: 256, // Assuming a reasonable max length for IDs
                },
                {
                    name: "description",
                    data_type: DataType.VarChar,
                    max_length: 65535, // Assuming a reasonable max length for description
                    enable_analyzer: true, // Enable analyzer for BM25 input field
                },
                {
                    name: "referenceIds",
                    data_type: DataType.VarChar,
                    max_length: 65535, // Assuming a reasonable max length for stringified referenceIds
                },
                {
                    name: "dense_vector",
                    data_type: DataType.FloatVector,
                    dim: 1536, // Placeholder: Dimension should be determined by this.embedding_ins
                },
                {
                    name: "sparse_vector",
                    data_type: DataType.SparseFloatVector,
                }
            ],
            description: "Vector storage collection for " + this.StorageNameSpace,
        };

        try {
            // Check if collection exists
            const exists = await this.milvusClient.hasCollection({ collection_name: this.StorageNameSpace });

            // Define the BM25 function
            const functions = [
                {
                    name: 'text_bm25_emb', // Function name
                    description: 'bm25 function for description field',
                    type: FunctionType.BM25,
                    input_field_names: ['description'], // Input field is the raw text field
                    output_field_names: ['sparse_vector'], // Output field is the sparse vector field
                    params: {},
                },
            ];

            if (!exists.value) {
                // Define index parameters
                const indexParams = [
                    {
                        field_name: "dense_vector",
                        index_type: "HNSW", // Or other appropriate index type
                        metric_type: "COSINE", // Or other appropriate metric type
                        params: { nlist: 1024 }, // Adjust nlist as needed
                    },
                    {
                        field_name: "sparse_vector",
                        index_type: "AUTOINDEX", // Or other appropriate index type for sparse vectors
                        metric_type: "BM25", // Or other appropriate metric type for sparse vectors
                        params: {}, // Adjust params as needed
                    },
                ];

                // Create the collection with index parameters and functions
                await this.milvusClient.createCollection({
                    collection_name: this.StorageNameSpace,
                    fields: schema.fields,
                    description: schema.description,
                    index_params: indexParams,
                    functions: functions, // Include the functions definition
                });
                this.logger.info(`Milvus collection '${this.StorageNameSpace}' created successfully with indexes and functions.`);
                
                // Load collection after creation
                await this.milvusClient.loadCollectionSync({
                    collection_name: this.StorageNameSpace,
                    timeout: 60 // Set a timeout (e.g., 60 seconds)
                });
                this.logger.info(`Milvus collection '${this.StorageNameSpace}' loaded.`);
            } else {
                this.logger.info(`Milvus collection '${this.StorageNameSpace}' already exists.`);
                
                // If collection exists, ensure it is loaded
                await this.milvusClient.loadCollectionSync({
                    collection_name: this.StorageNameSpace,
                    timeout: 60 // Set a timeout (e.g., 60 seconds)
                });
                this.logger.info(`Milvus collection '${this.StorageNameSpace}' loaded.`);
            }
        } catch (error) {
            this.logger.error(`Error creating or loading Milvus collection '${this.StorageNameSpace}':`, error);
            throw error; // Re-throw the error to be handled by the caller
        }
    }

    async query(query: string, top_k: number, ids: string[] | null = null): Promise<Record<string, any>[]> {
        // Placeholder implementation
        this.logger.info("query method called");
        return [];
    }

    async upsert(data: Record<string, Record<string, any>>): Promise<void> {
        this.logger.info(`Upserting ${Object.keys(data).length} entities into collection '${this.StorageNameSpace}'`);
        const entities = [];

        for (const id in data) {
            const entityData = data[id];
            const description = entityData.description;
            let referenceIds = entityData.referenceIds;

            // Ensure referenceIds is a string, stringify if it's an array
            if (Array.isArray(referenceIds)) {
                referenceIds = JSON.stringify(referenceIds);
            } else if (typeof referenceIds !== 'string') {
                // Handle cases where referenceIds is neither string nor array, maybe convert to string or log a warning
                referenceIds = String(referenceIds);
            }

            try {
                // Generate dense vector embedding
                const dense_vector = (await this.embedding_ins.Embeddings.embedDocuments([description]))[0];

                entities.push({
                    id: id,
                    description: description,
                    referenceIds: referenceIds,
                    dense_vector: dense_vector,
                    // sparse_vector will be generated by the BM25 function defined in create_collection
                });
            } catch (error) {
                this.logger.error(`Error generating embedding for entity ID ${id}:`, error);
                // Decide how to handle errors: skip the entity, throw an error, etc.
                // For now, we'll log and continue with the next entity.
            }
        }

        if (entities.length > 0) {
            try {
                await this.milvusClient.upsert({
                    collection_name: this.StorageNameSpace,
                    data: entities,
                });
                this.logger.info(`Successfully upserted ${entities.length} entities.`);
            } catch (error) {
                this.logger.error(`Error during Milvus upsert operation:`, error);
                throw error; // Re-throw the error to be handled by the caller
            }
        } else {
            this.logger.info("No entities to upsert.");
        }
    }

    async delete_entity(entity_name: string): Promise<void> {
        // Placeholder implementation
        this.logger.info("delete_entity method called");
    }

    async delete_entity_relation(entity_name: string): Promise<void> {
        // Placeholder implementation
        this.logger.info("delete_entity_relation method called");
    }

    async get_by_id(id: string): Promise<Record<string, any> | null> {
        // Placeholder implementation
        this.logger.info("get_by_id method called");
        return null;
    }

    async get_by_ids(ids: string[]): Promise<Record<string, any>[]> {
        // Placeholder implementation
        this.logger.info("get_by_ids method called");
        return [];
    }

    async delete(ids: string[]): Promise<void> {
        // Placeholder implementation
        this.logger.info("delete method called");
    }
}