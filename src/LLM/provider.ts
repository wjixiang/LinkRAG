import { Embeddings } from "@langchain/core/embeddings";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

export function getChatModal(): ChatOpenAI {
  return new ChatOpenAI({
    apiKey: process.env.CHATMODAL_API_KEY,
    configuration: {
      baseURL: process.env.CHATMODAL_API_BASE,
    },
  });
}

export function getEmbeddings(): Embeddings {
  return new OpenAIEmbeddings({
    apiKey: process.env.EMBEDDING_API_KEY,
    configuration: {
      baseURL: process.env.EMBEDDING_API_BASE,
    },
  });
}
