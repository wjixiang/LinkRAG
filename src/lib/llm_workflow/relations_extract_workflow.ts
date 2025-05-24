import { b, Entity, Relation, RelationExtractResult } from '../../../baml_client';
import winston from 'winston';
import createLoggerWithPrefix from '../console/logger';
import { language } from '../../type';

export default async function relations_extract_workflow(content: string, entity: Entity[], language: language): Promise<RelationExtractResult[]> {
    const logger = createLoggerWithPrefix('relations_extract_workflow');
    try {
        return b.Extract_relations(content, entity, language);;
    } catch (error) {
        throw error
    }
}