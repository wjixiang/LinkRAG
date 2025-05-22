import axios from 'axios';
import { ONNXEmbedder } from './embedding/ONNXEmbedder';

// Configuration
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY;
const EMBEDDING_API_BASE = process.env.EMBEDDING_API_BASE;
const ALIBABA_API_KEY = process.env.ALIBABA_API_KEY;

// Embedding provider types
type EmbeddingProvider = 'openai' | 'alibaba' | 'onnx';

// Current active provider (configurable)
let activeProvider: EmbeddingProvider = 'onnx'; // Default to ONNX
const onnxEmbedder = new ONNXEmbedder();

// Initialize ONNX embedder
onnxEmbedder.init().catch(err => {
  console.error('Failed to initialize ONNX embedder:', err);
});

/**
 * Set the active embedding provider
 * @param provider One of: 'openai', 'alibaba', 'onnx'
 */
export function setEmbeddingProvider(provider: EmbeddingProvider): void {
  activeProvider = provider;
}

async function getOpenAIEmbedding(text: string): Promise<number[] | null> {
  if (!EMBEDDING_API_KEY || !EMBEDDING_API_BASE) {
    console.error('OpenAI API credentials not configured');
    return null;
  }

  try {
    const response = await axios.post(`${EMBEDDING_API_BASE}embeddings`, {
      model: 'text-embedding-ada-002',
      input: text,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EMBEDDING_API_KEY}`,
      },
    });
    return response.data.data[0].embedding;
  } catch (error) {
    console.error('Error fetching OpenAI embedding:', error);
    return null;
  }
}

async function getAlibabaEmbedding(text: string): Promise<number[] | null> {
  if (!ALIBABA_API_KEY) {
    console.error('Alibaba API key not configured');
    return null;
  }

  try {
    const response = await axios.post(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings',
      {
        model: 'text-embedding-v3',
        input: text,
        dimension: "1024",
        encoding_format: "float"
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ALIBABA_API_KEY}`,
        },
      }
    );
    return response.data.data[0].embedding;
  } catch (error) {
    console.error('Error fetching Alibaba embedding:', error);
    return null;
  }
}

async function getONNXEmbedding(text: string): Promise<number[] | null> {
  try {
    const embedding = await onnxEmbedder.embedDocument(text);
    return Array.from(embedding); // Convert Float32Array to number[]
  } catch (error) {
    console.error('Error generating ONNX embedding:', error);
    return null;
  }
}

/**
 * Unified embedding function that uses the currently active provider
 * @param text Input text to embed
 * @returns Promise resolving to embedding vector or null if failed
 */
export async function embedding(text: string): Promise<number[] | null> {
  switch (activeProvider) {
    case 'openai':
      return getOpenAIEmbedding(text);
    case 'alibaba':
      return getAlibabaEmbedding(text);
    case 'onnx':
      return getONNXEmbedding(text);
    default:
      console.error('Unknown embedding provider:', activeProvider);
      return null;
  }
}