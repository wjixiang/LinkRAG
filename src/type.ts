import { Embeddings } from "@langchain/core/embeddings";
import { Entity, Relation } from "baml_client";
import { RecordId } from "surrealdb";

export interface embeddingInstance {
    Embeddings:Embeddings,
    EmbeddingModal: string,
    EmbeddingLength: number,
}
  

export type language = 'zh' | 'en' | 'ja' | 'ko' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' | 'ar' | 'hi' | 'bn' | 'pa' | 'jv' | 'tr' | 'vi' | 'th' | 'pl' | 'uk' | 'ro' | 'nl' | 'el';

export interface EntityRecord extends Entity  {
    id: RecordId;
}

export interface RelationRecord  {
    id: RecordId;
    in: RecordId;
    out: RecordId;
    relation: string;
}