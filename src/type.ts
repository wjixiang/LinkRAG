import { Embeddings } from "@langchain/core/embeddings";

export interface embeddingInstance {
    Embeddings:Embeddings,
    EmbeddingModal: string
}
  

export type RecordId = {
    tb: string;
    id: string;
}

export type language = 'zh' | 'en' | 'ja' | 'ko' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' | 'ar' | 'hi' | 'bn' | 'pa' | 'jv' | 'tr' | 'vi' | 'th' | 'pl' | 'uk' | 'ro' | 'nl' | 'el';