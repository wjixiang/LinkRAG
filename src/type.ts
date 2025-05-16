import { Embeddings } from "@langchain/core/embeddings";
import { Entity, Relation } from "baml_client";
import { RecordId } from "surrealdb";

export interface embeddingInstance {
    Embeddings:Embeddings,
    EmbeddingModal: string
}
  

export type language = 'zh' | 'en' | 'ja' | 'ko' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' | 'ar' | 'hi' | 'bn' | 'pa' | 'jv' | 'tr' | 'vi' | 'th' | 'pl' | 'uk' | 'ro' | 'nl' | 'el';

// export interface EntityRecord extends Entity  {
//     referenceIds: RecordId[]
// }

// export interface RelationRecord extends Relation {
//     referenceIds: RecordId[]
// }