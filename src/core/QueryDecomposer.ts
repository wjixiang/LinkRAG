import { b } from '../../baml_client';

interface SimpleQuestionResult {
  isSimple: boolean;
  answer?: string;
  subQuestions?: string[];
}

export class QueryDecomposer {
  private readonly SIMPLE_QUESTION_THRESHOLD = 1; // Number of attributes indicating simple question

  async analyzeQuery(query: string): Promise<SimpleQuestionResult> {
    try {
      // First try to extract EP pairs
      const epPairs = await b.ExtractEP(query);
      
      if (epPairs.length === 0) {
        // Fallback to attribute extraction if no EP pairs found
        const attributes = await b.ExtractAttributesFromText(query, [
          '临床表现',
          '诊断方法',
          '治疗方案'
        ]);

        if (attributes.length <= this.SIMPLE_QUESTION_THRESHOLD) {
          return {
            isSimple: true,
            answer: this.generateSimpleAnswer(query, attributes)
          };
        }
        return {
          isSimple: false,
          subQuestions: this.decomposeQuery(query, attributes)
        };
      }

      // If EP pairs found, use them for decomposition
      if (epPairs.length === 1) {
        return {
          isSimple: true,
          answer: `关于"${query}"的简单回答: ${epPairs[0].property}`
        };
      }
      
      return {
        isSimple: false,
        subQuestions: epPairs.map(ep =>
          `${query}中提到的${ep.entity}的${ep.property}是什么？`
        )
      };
    } catch (error) {
      console.error('Error analyzing query:', error);
      return {
        isSimple: false,
        subQuestions: [query] // Fallback to original query
      };
    }
  }

  private generateSimpleAnswer(query: string, attributes: any[]): string {
    if (attributes.length === 0) {
      return `关于"${query}"的简单回答`;
    }
    return `关于"${query}"的${attributes[0].type}是: ${attributes[0].description}`;
  }

  private decomposeQuery(query: string, attributes: any[]): string[] {
    return attributes.map(attr => 
      `${query}中提到的${attr.name}是什么？`
    );
  }
}