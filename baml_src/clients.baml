client<llm> Hunyuanlite {
  provider openai-generic
  options {
    model "hunyuan-lite"
    api_key env.CHATMODAL_API_KEY
    base_url "https://api.zhizengzeng.com/v1"
  }
}

client<llm> GLM4Flash {
  provider openai-generic
  options {
    model "glm-4-flash"
    api_key env.GLM_API_KEY
    base_url "https://open.bigmodel.cn/api/paas/v4"
    retry_policy GLMRetry
  }
}

client<llm> GLM4Plus {
  provider openai-generic
  options {
    model "glm-4-plus"
    api_key env.GLM_API_KEY
    base_url "https://open.bigmodel.cn/api/paas/v4"
    retry_policy GLMRetry
  }
}

client<llm> DeepseekR1 {
  provider  openai-generic
  options {
    model "deepseek-reasoner"
    api_key "sk-d31cb4c9371344fdab8bc78b1cc420ce"
    base_url "https://api.deepseek.com"
  }
}

client<llm> QiniuDeepseekV3 {
  provider openai-generic
  options {
    model "deepseek-v3"
    api_key env.QINIU_DEEPSEEK_FREE_API_KEY
    base_url "https://api.qnaigc.com/v1"
  }
}

client<llm> OpenrouterQWEN3 {
  provider openai-generic
  options {
    model "qwen/qwen3-235b-a22b"
    api_key env.OPENROUTER_API_KEY
    base_url "https://openrouter.ai/api/v1"
  }
}

client<llm> QWen3 {
  provider openai-generic
  options {
    model "qwen-turbo-latest"
    api_key env.ALIBABA_API_KEY
    base_url "https://dashscope.aliyuncs.com/compatible-mode/v1/"
    enable_thinking false
  }
}

client<llm> QwenTurbo {
  provider openai-generic
  options {
    model "qwen-turbo-latest"
    api_key env.ALIBABA_API_KEY
    base_url "https://dashscope.aliyuncs.com/compatible-mode/v1/"
  }
}

// strategies
retry_policy GLMRetry {
  max_retries 3
  strategy {
    type exponential_backoff
    delay_ms 200
  }
}
