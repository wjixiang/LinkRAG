import { Embeddings } from "@langchain/core/embeddings";

export interface embeddingInstance {
    Embeddings:Embeddings,
    EmbeddingModal: string
}
  

export type RecordId = {
    tb: string;
    id: string;
}