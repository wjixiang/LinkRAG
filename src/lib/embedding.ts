import axios from 'axios';

const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY;
const EMBEDDING_API_BASE = process.env.EMBEDDING_API_BASE;
const ALIBABA_API_KEY = process.env.ALIBABA_API_KEY;

if (!EMBEDDING_API_KEY || !EMBEDDING_API_BASE || !ALIBABA_API_KEY) {
  console.error('EMBEDDING_API_KEY and EMBEDDING_API_BASE must be set in environment variables.');
}


async function getEmbedding(modal: string,text: string): Promise<number[] | null> {
  if (!EMBEDDING_API_KEY || !EMBEDDING_API_BASE) {
    return null; // Or throw an error
  }

  try {
    const response = await axios.post(`${EMBEDDING_API_BASE}embeddings`, {
      model: modal, // Replace with the actual model name if different
      input: text,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EMBEDDING_API_KEY}`,
      },
    });

    // Assuming the API returns an object with an 'embedding' field containing the vector
    // console.log('Embedding response:', response.data.data[0].embedding);
    return response.data.data[0].embedding;
  } catch (error) {
    console.error('Error fetching embedding:', error);
    return null;
  }
}

export function text_embedding_ada_002_Embedding(text: string): Promise<number[] | null>{
  return getEmbedding('text-embedding-ada-002', text);
}

export async function gte_Qwen2_7B_instruct_Embedding(text: string): Promise<number[] | null> {
  if (!EMBEDDING_API_KEY || !EMBEDDING_API_BASE) {
    return null; // Or throw an error
  }

  try {
    const response = await axios.post(`https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings`, {
      model: 'text-embedding-v3',
      input: text,
      dimension: "1024",
      encoding_format: "float"
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ALIBABA_API_KEY}`,
      },
    });

    return response.data.data[0].embedding;
  } catch (error) {
    console.error('Error fetching embedding:', error);
    return null;
  }
}