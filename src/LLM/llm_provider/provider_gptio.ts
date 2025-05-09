import { Embeddings } from "@langchain/core/embeddings";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { provider } from "../provider";
import dotenv from 'dotenv';

// 确保环境变量加载
dotenv.config();

class provide_gptio implements provider {
  // 定义支持的聊天模型
  supported_chat_modal = {
    "gpt-4o": "gpt-4o",
    "gpt-4o-mini": "gpt-4o-mini",
    "claude-3-7-sonnet": "claude-3-7-sonnet",
    "claude-3-7-sonnet-thinking": "claude-3-7-sonnet-thinking",
    "o3-mini": "o3-mini",
    "deepseek-r1": "deepseek-r1",
    "deepseek-v3": "deepseek-v3",
    "api-gemini-2.0-flash-thinking-exp": "api-gemini-2.0-flash-thinking-exp"
  };

  // 定义支持的嵌入模型
  supported_embedding_modal = {
    "text-embedding-3-large": "text-embedding-3-large",
    "text-embedding-3-small": "text-embedding-3-small",
    "text-embedding-ada-002": "text-embedding-ada-002"
  };

  // API 密钥和基础 URL
  apikey: string;
  baseurl: string;
  vectorNoteCollection: string = "note";
    
  constructor() {
    if (!process.env.GPTIO_API_KEY) {
      throw new Error("GPTIO_API_KEY 环境变量未提供！");
    }
    if (!process.env.GPTIO_BASE_URL) {
      throw new Error("GPTIO_BASE_URL 环境变量未提供！");
    }
    this.apikey = process.env.GPTIO_API_KEY;
    this.baseurl = process.env.GPTIO_BASE_URL;
  }

  getEmbeddingModal = (modelName: string) => {
    if (!(modelName in this.supported_embedding_modal)) {
      throw new Error(
        `不支持的嵌入模型: ${modelName}。支持的模型有: ${Object.keys(
          this.supported_embedding_modal
        ).join(", ")}`
      );
    }

    return {
      Embeddings: new OpenAIEmbeddings({
        model: modelName,
        openAIApiKey: this.apikey,
        configuration: {
          baseURL: this.baseurl
        }
      }),
      EmbeddingModal: modelName
    }
  };

  getChatModal = (modelName: string, temperature: number = 0): ChatOpenAI => {
    if (!(modelName in this.supported_chat_modal)) {
      throw new Error(
        `不支持的聊天模型: ${modelName}。支持的模型有: ${Object.keys(
          this.supported_chat_modal
        ).join(", ")}`
      );
    }

    return new ChatOpenAI({
      model: modelName,
      temperature: temperature,
      openAIApiKey: this.apikey,
      configuration: {
        baseURL: this.baseurl
      }
    });
  };
}

export default provide_gptio;
