import { ClientRegistry } from "@boundaryml/baml";
import * as dotenv from 'dotenv';
dotenv.config()

export type supported_llm = "glm-4-plus"

export default class DynamicLlmClient {
    cr = new ClientRegistry()

    constructor() {
        this.create_llm()
    }

    create_llm() {
        this.cr.addLlmClient(
            "glm-4-plus",
            "openai-generic",
            {
                model: "glm-4-plus",
                temperature: 0.6,
                api_key: process.env.GLM_API_KEY,
                base_url:"https://open.bigmodel.cn/api/paas/v4"
            }
        )

        this.cr.addLlmClient(
            "GLM4plus",
            "openai-generic",
            {
                model: "glm-4-plus",
                temperature: 0.6,
                api_key: process.env.GLM_API_KEY,
                base_url:"https://open.bigmodel.cn/api/paas/v4"
            }
        )
    }
}