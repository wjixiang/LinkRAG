import { Embeddings } from "@langchain/core/embeddings";
import { Entity, Relation } from "baml_client";
import { RecordId } from "surrealdb";

export interface embeddingInstance {
    Embeddings:Embeddings,
    EmbeddingModal: string,
    EmbeddingLength: number,
}
  

export type language = 'zh' | 'en' | 'ja' | 'ko' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' | 'ar' | 'hi' | 'bn' | 'pa' | 'jv' | 'tr' | 'vi' | 'th' | 'pl' | 'uk' | 'ro' | 'nl' | 'el';

export interface EntityWithRefDoc{
  id: RecordId;
  name: string
  description: string
  type: string
  aliases: string[]
  referenceDoc: RecordId[]
}

export interface EntityRecord extends Entity  {
    id: RecordId;
}

export interface RetrievedEntityRecord extends EntityRecord {
    score: number;
}

export interface RelationRecord  {
    id: RecordId;
    in: RecordId;
    out: RecordId;
    relation: string;
}

export interface RelationWithId extends Relation {
    id: RecordId
}

export interface PropertySummarizeResult {
    core_entity: EntityRecord;
    relation_set: RelationWithId[];
    property_name: string;
    property_content: string;
}


export interface RetrievedProperty{
    id: RecordId;
    core_entity: RecordId;
    property_name: string;
    property_content: string;
    score: number;
}