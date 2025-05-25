import axios, { AxiosError } from 'axios';
import { ONNXEmbedder } from './embedding/ONNXEmbedder';
import createLoggerWithPrefix from '../lib/console/logger';

const logger = createLoggerWithPrefix('Embedding');

// Configuration
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY;
const EMBEDDING_API_BASE = process.env.EMBEDDING_API_BASE;
const ALIBABA_API_KEY = process.env.ALIBABA_API_KEY;
const MAX_RETRIES = parseInt(process.env.EMBEDDING_MAX_RETRIES || '3');
const RETRY_DELAY_BASE = parseInt(process.env.EMBEDDING_RETRY_DELAY_BASE || '1000');
const CONCURRENCY_LIMIT = parseInt(process.env.EMBEDDING_CONCURRENCY_LIMIT || '5');

// Embedding provider types
type EmbeddingProvider = 'openai' | 'alibaba' | 'onnx';

// Current active provider (configurable)
let activeProvider: EmbeddingProvider = 'alibaba'; // Default to ONNX
const onnxEmbedder = new ONNXEmbedder();

// Initialize ONNX embedder
onnxEmbedder.init().catch(err => {
  logger.error('Failed to initialize ONNX embedder:', err);
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
    logger.error('OpenAI API credentials not configured');
    return null;
  }

  let retries = 0;
  while (retries < MAX_RETRIES) {
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
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        retries++;
        const delay = Math.pow(2, retries) * RETRY_DELAY_BASE;
        logger.warn(`Rate limit exceeded. Retrying in ${delay}ms... (Attempt ${retries}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        logger.error('Error fetching OpenAI embedding:', error);
        return null;
      }
    }
  }

  logger.error(`Failed to fetch OpenAI embedding after ${MAX_RETRIES} retries due to rate limiting.`);
  return null;
}

async function getAlibabaEmbedding(text: string | string[]): Promise<number[] | number[][] | null> {
  if (!ALIBABA_API_KEY) {
    logger.error('Alibaba API key not configured');
    return null;
  }

  let retries = 0;
  while (retries < MAX_RETRIES) {
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

      if (Array.isArray(text)) {
        return response.data.output.embeddings.map((item: any) => item.embedding) as number[][];
      } else {
        return response.data.data[0].embedding as number[];
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        retries++;
        const delay = Math.pow(2, retries) * RETRY_DELAY_BASE;
        logger.warn(`Rate limit exceeded. Retrying in ${delay}ms... (Attempt ${retries}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        logger.error('Error fetching Alibaba embedding:', error);
        return null;
      }
    }
  }

  logger.error(`Failed to fetch Alibaba embedding after ${MAX_RETRIES} retries due to rate limiting.`);
  return null;
}

async function getONNXEmbedding(text: string): Promise<number[] | null> {
  try {
    const embedding = await onnxEmbedder.embedDocument(text);
    return Array.from(embedding);
  } catch (error) {
    logger.error('Error generating ONNX embedding:', error);
    return null;
  }
}

export async function embedding(text: string | string[], provider: EmbeddingProvider = activeProvider): Promise<number[] | number[][] | null> {
  switch (activeProvider) {
    case 'openai':
      if (Array.isArray(text)) {
        logger.error('OpenAI embedding does not support array input in this implementation.');
        return null;
      }
      return getOpenAIEmbedding(text);
    case 'alibaba':
      return getAlibabaEmbedding(text);
    case 'onnx':
      if (Array.isArray(text)) {
         logger.error('ONNX embedding does not support array input in this implementation.');
         return null;
      }
      return getONNXEmbedding(text);
    default:
      logger.error('Unknown embedding provider:', provider);
      return null;
  }
}