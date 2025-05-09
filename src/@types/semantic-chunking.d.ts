declare module 'semantic-chunking' {
    /**
     * Represents the input document structure for chunking.
     */
    interface DocumentInput {
        /**
         * The name of the document (optional).
         */
        document_name?: string;
        /**
         * The text content of the document.
         */
        document_text: string;
    }

    /**
     * Represents a semantic chunk generated from the input text.
     */
    interface Chunk {
        /**
         * A unique identifier for the document (current timestamp in milliseconds).
         */
        document_id: number;
        /**
         * The name of the document being chunked (if provided).
         */
        document_name?: string;
        /**
         * The total number of final chunks returned from the input text.
         */
        number_of_chunks: number;
        /**
         * The number of the current chunk.
         */
        chunk_number: number;
        /**
         * The name of the embedding model used.
         */
        model_name: string;
        /**
         * The precision of the embedding model used (options: 'fp32', 'fp16', 'q8', 'q4').
         */
        dtype: string;
        /**
         * The chunked text.
         */
        text: string;
        /**
         * The embedding vector (if returnEmbedding is true).
         */
        embedding?: number[];
        /**
         * The token length (if returnTokenLength is true).
         */
        token_length?: number;
    }

    /**
     * Options for configuring the semantic chunking process.
     */
    interface ChunkitOptions {
        /**
         * Enables logging of detailed processing steps (optional, default false).
         */
        logging?: boolean;
        /**
         * Maximum token size for each chunk (optional, default 500).
         */
        maxTokenSize?: number;
        /**
         * Threshold to determine if sentences are similar enough to be in the same chunk (optional, default 0.5).
         * A higher value demands higher similarity.
         */
        similarityThreshold?: number;
        /**
         * Minimum possible dynamic similarity threshold (optional, default 0.4).
         */
        dynamicThresholdLowerBound?: number;
        /**
         * Maximum possible dynamic similarity threshold (optional, default 0.8).
         */
        dynamicThresholdUpperBound?: number;
        /**
         * Number of sentences to look ahead for calculating similarity (optional, default 3).
         */
        numSimilaritySentencesLookahead?: number;
        /**
         * Determines whether to rebalance and combine chunks into larger ones up to the max token limit (optional, default true).
         */
        combineChunks?: boolean;
        /**
         * Threshold for combining chunks based on similarity during the rebalance and combining phase (optional, default 0.5).
         */
        combineChunksSimilarityThreshold?: number;
        /**
         * ONNX model used for creating embeddings (optional, default 'Xenova/all-MiniLM-L6-v2').
         */
        onnxEmbeddingModel?: string;
        /**
         * Precision of the embedding model (options: 'fp32', 'fp16', 'q8', 'q4') (optional, default 'fp32').
         */
        dtype?: string;
        /**
         * Local path to save and load models (example: './models') (optional, default null).
         */
        localModelPath?: string;
        /**
         * Directory to cache downloaded models (example: './models') (optional, default null).
         */
        modelCacheDir?: string;
        /**
         * If set to true, each chunk will include an embedding vector (optional, default false).
         */
        returnEmbedding?: boolean;
        /**
         * If set to true, each chunk will include the token length (optional, default false).
         */
        returnTokenLength?: boolean;
        /**
         * A prefix to add to each chunk (e.g., "search_document: ") (optional, default null).
         */
        chunkPrefix?: string;
        /**
         * If set to true, the chunk prefix will be removed from the results (optional, default false).
         */
        excludeChunkPrefixInResults?: boolean;
    }

    /**
     * Semantically creates chunks from a large document.
     * @param documents An array of document objects, each containing document_name and document_text.
     * @param options Optional configuration options for chunking.
     * @returns A Promise that resolves to an array of chunk objects.
     */
    export function chunkit(documents: DocumentInput[], options?: ChunkitOptions): Promise<Chunk[]>;
}