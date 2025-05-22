import { b, Entity, Relation, RelationExtractResult } from '../../../baml_client';
import Logger from '../console/logger';
import { language } from '../../type';

export default async function relations_extract_workflow(content: string, entity: Entity[], language: language): Promise<RelationExtractResult[]> {
    const logger = new Logger('entities_extraction_workflow');
    try {
        return b.Extract_relations(content, entity, language);;
    } catch (error) {
        throw error
    }
}