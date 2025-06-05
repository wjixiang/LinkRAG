import { b } from '../../baml_client';
import * as dotenv from 'dotenv';
import { language } from '../type';
dotenv.config()

interface SimpleQuestionResult {
  isSimple: boolean;
  answer?: string;
  subQuestions?: string[];
}

export interface QueryDecomposerConfig {
  language: language;

}

export class QueryDecomposer {
  private readonly SIMPLE_QUESTION_THRESHOLD = 1; // Number of attributes indicating simple question
  config: QueryDecomposerConfig;
  constructor( config: QueryDecomposerConfig ) {
    this.config = config
  }

  async convert_query(query: string) {
    const eps = await b.ExtractEP(query, this.config.language)
    return eps 
  }
}