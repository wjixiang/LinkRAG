import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { provider } from "../provider";
import * as dotenv from 'dotenv';
dotenv.config()


class provide_zhizeng implements provider {
  // 定义支持的聊天模型
  supported_chat_modal = {
    "gpt-4o": "gpt-4o",
    "gpt-4o-mini": "gpt-4o-mini",
    "claude-3-7-sonnet": "claude-3-7-sonnet",
    "claude-3-7-sonnet-thinking": "claude-3-7-sonnet-thinking",
    "o3-mini": "o3-mini",
    "deepseek-r1": "deepseek-reasoner",
    "deepseek-v3": "deepseek-chat",
    "gpt-3.5-turbo-instruct": "gpt-3.5-turbo-instruct",
    "SparkDesk-v1.1":"SparkDesk-v1.1",
    "glm-4-flash":"glm-4-flash",
    "ERNIE-Speed-128K":"ERNIE-Speed-128K",
    "hunyuan-lite":"hunyuan-lite",
    "gpt-3.5-turbo":"gpt-3.5-turbo"
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
    if (!process.env.ZHIZENG_API_KEY) {
      throw new Error("ZHIZENG_API_KEY 环境变量未提供！");
    }
    if (!process.env.ZHIZENG_BASE_URL) {
      throw new Error("ZHIZENG_BASE_URL 环境变量未提供！");
    }
    this.apikey = process.env.ZHIZENG_API_KEY;
    this.baseurl = process.env.ZHIZENG_BASE_URL;
  }

  // 使用箭头函数确保绑定 this
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

  // 使用箭头函数确保绑定 this
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

export default provide_zhizeng;