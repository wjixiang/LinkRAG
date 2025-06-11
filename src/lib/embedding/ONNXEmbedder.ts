import { AutoTokenizer, env } from '@xenova/transformers';
import { BertModel } from '@xenova/transformers';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
// const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure local model paths relative to the current file
env.localModelPath = path.resolve(__dirname, '../../../models/Xenova');

/**
 * ONNX-based text embedder using the all-MiniLM-L6-v2 model
 *
 * This class handles loading and running the ONNX model to generate text embeddings.
 * It supports both single text inputs and batches, producing 384-dimensional embeddings.
 */
export class ONNXEmbedder {
    private tokenizer: any;
    private model: any;
    private initialized = false;

    /**
     * Creates a new ONNXEmbedder instance
     * @constructor
     */
    constructor() {
        // Initialization happens in init()
    }

    /**
     * Initializes the model and tokenizer asynchronously
     * @returns Promise that resolves when initialization is complete
     * @throws {Error} If model loading fails
     */
    public async init(): Promise<void> {
        try {
            // Configure environment for WASM fallback
            env.backends.onnx.wasm.numThreads = 1;
            env.backends.onnx.wasm.proxy = true;

            // Load tokenizer
            this.tokenizer = await AutoTokenizer.from_pretrained('all-MiniLM-L6-v2');

            // Try loading model with default settings (may use GPU if available)
            try {
                this.model = await BertModel.from_pretrained('all-MiniLM-L6-v2', {
                    quantized: true,
                    config: {
                        model_file: 'onnx/model_quantized.onnx'
                    }
                });
            } catch (gpuError) {
                console.warn('GPU initialization failed, falling back to WASM:', gpuError);
                // Explicit WASM fallback
                env.backends.onnx.wasm.wasmPaths = {
                    'ort-wasm.wasm': '/node_modules/onnxruntime-web/dist/ort-wasm.wasm',
                    'ort-wasm-simd.wasm': '/node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm'
                };
                this.model = await BertModel.from_pretrained('all-MiniLM-L6-v2', {
                    quantized: true,
                    config: {
                        model_file: 'onnx/model_quantized.onnx'
                    }
                });
            }

            this.initialized = true;
        } catch (error: any) {
            console.error('Failed to initialize ONNXEmbedder:', error);
            throw new Error(`ONNX initialization failed: ${error.message}. Please ensure:
1. WebAssembly is supported in your environment
2. The model files exist at ${env.localModelPath}
3. The ONNX model is properly formatted`);
        }
    }

    /**
     * Generates embedding for a single document
     * @param text Input text to embed
     * @returns Promise resolving to Float32Array containing the embedding
     * @throws {Error} If model isn't initialized or embedding fails
     */
    public async embedDocument(text: string): Promise<Float32Array> {
        if (!this.initialized) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (!this.initialized) {
                throw new Error('Model not initialized');
            }
        }

        try {
            const inputs = await this.tokenizer(text, { padding: true, truncation: true });
            // Workaround for TypeError: Tensor.location must be a string.
            if (inputs.input_ids && inputs.input_ids.location === undefined) {
                inputs.input_ids.location = 'cpu';
            }
            const { last_hidden_state } = await this.model(inputs);
            const embeddings = this.meanPooling(last_hidden_state, inputs.attention_mask);
            return embeddings.data;
        } catch (error) {
            console.error('Embedding failed:', error);
            throw error;
        }
    }

    /**
     * Generates embeddings for multiple documents
     * @param texts Array of texts to embed
     * @returns Promise resolving to Float32Array[] containing all embeddings
     * @throws {Error} If model isn't initialized or embedding fails
     */
    public async embedDocuments(texts: string[]): Promise<Float32Array[]> {
        if (!this.initialized) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (!this.initialized) {
                throw new Error('Model not initialized');
            }
        }

        try {
            const inputs = await this.tokenizer(texts, { padding: true, truncation: true });
            // Workaround for TypeError: Tensor.location must be a string.
            if (inputs.input_ids && inputs.input_ids.location === undefined) {
                inputs.input_ids.location = 'cpu';
            }
            const { last_hidden_state } = await this.model(inputs);
            const embeddings = this.meanPooling(last_hidden_state, inputs.attention_mask);
            return Array.from({ length: embeddings.dims[0] }, (_, i) =>
                embeddings.data.slice(i * embeddings.dims[1], (i + 1) * embeddings.dims[1])
            );
        } catch (error) {
            console.error('Embedding failed:', error);
            throw error;
        }
    }

    /**
     * @deprecated Use embedDocument() or embedDocuments() instead
     */
    public async embed(text: string | string[]): Promise<Float32Array | Float32Array[]> {
        if (Array.isArray(text)) {
            return this.embedDocuments(text);
        }
        return this.embedDocument(text);
    }

    /**
     * Performs mean pooling on token embeddings using attention mask
     * @private
     * @param lastHiddenState The output tensor from the model [batch_size, sequence_length, hidden_size]
     * @param attentionMask The attention mask tensor [batch_size, sequence_length]
     * @returns Object containing pooled embeddings and their dimensions
     */
    private meanPooling(lastHiddenState: any, attentionMask: any): { data: Float32Array, dims: number[] } {
        // Get dimensions [batch_size, sequence_length, hidden_size]
        const [batchSize, seqLength, hiddenSize] = lastHiddenState.dims;

        // Initialize output array
        const output = new Float32Array(batchSize * hiddenSize);
        const outputDims = [batchSize, hiddenSize];

        for (let i = 0; i < batchSize; i++) {
            // Get attention mask for this sample
            const mask = attentionMask.data.slice(i * seqLength, (i + 1) * seqLength);
            // Convert BigInt attention mask to numbers if needed
            const maskValues = Array.from(mask).map(v => Number(v));
            const maskSum = maskValues.reduce((a: number, b: number) => a + b, 0);

            // Initialize sum for this sample
            const sampleSum = new Float32Array(hiddenSize).fill(0);

            for (let j = 0; j < seqLength; j++) {
                if (mask[j] === 0) continue;

                // Get hidden state for this token
                const tokenOffset = (i * seqLength + j) * hiddenSize;
                const tokenEmbedding = lastHiddenState.data.slice(tokenOffset, tokenOffset + hiddenSize);

                // Add to sum
                for (let k = 0; k < hiddenSize; k++) {
                    sampleSum[k] += tokenEmbedding[k];
                }
            }

            // Calculate mean and store in output
            const outputOffset = i * hiddenSize;
            for (let k = 0; k < hiddenSize; k++) {
                output[outputOffset + k] = sampleSum[k] / maskSum;
            }
        }
        return { data: output, dims: outputDims };
    }

    /**
     * Gets the dimensionality of embeddings produced by this model
     * @returns Promise resolving to the embedding dimension (384 for all-MiniLM-L6-v2)
     */
    public async getEmbeddingDimensions(): Promise<number> {
        if (!this.initialized) {
            await this.init();
        }
        return 384; // Dimension for all-MiniLM-L6-v2
    }
}