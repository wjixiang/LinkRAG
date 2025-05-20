import * as natural from 'natural';
import Segment from 'segment';

/**
 * Extract keyword from query by TF-IDF
 */
export class KeywordExtractor {
  private segmenter: Segment;
  private stemmer: typeof natural.PorterStemmer;

  constructor() {
    // Initialize Chinese text segmenter
    this.segmenter = new Segment();
    this.segmenter.useDefault();
    this.stemmer = natural.PorterStemmer;
  }

  private tokenizeChinese(text: string): string[] {
    return this.segmenter.doSegment(text, {
      simple: true,
      stripPunctuation: true
    });
  }

  /**
   * Extract keywords from text
   * @param text Input text to process
   * @param options Configuration options
   * @returns Array of extracted keywords
   */
  extractKeywords(
    text: string,
    options: {
      minLength?: number;
      maxLength?: number;
      stopwords?: string[];
      stem?: boolean;
    } = {}
  ): string[] {
    const {
      minLength = 2,
      maxLength = 20,
      stopwords = natural.stopwords,
      stem = true
    } = options;

    // Tokenize text
    let tokens: string[] = [];
    // Handle Chinese text
    if (/[\u4e00-\u9fa5]/.test(text)) {
      tokens = this.tokenizeChinese(text);
    } else {
      // Fallback to natural's tokenizer for non-Chinese
      const naturalTokenizer = new natural.WordTokenizer();
      tokens = naturalTokenizer.tokenize(text) || [];
    }
    
    // Filter tokens
    tokens = tokens
      .map((token: string) => token.toLowerCase())
      .filter((token: string) => {
        // Length check
        if (token.length < minLength || token.length > maxLength) return false;
        // Stopwords check
        if (stopwords.includes(token)) return false;
        return true;
      });

    // Stem tokens if enabled
    if (stem) {
      tokens = tokens.map((token: string) => this.stemmer.stem(token));
    }

    return tokens;
  }

  /**
   * Get top N keywords by frequency
   * @param text Input text to process
   * @param topN Number of top keywords to return
   * @param options Configuration options
   * @returns Array of [keyword, frequency] tuples
   */
  getTopKeywords(
    text: string,
    topN: number = 10,
    options?: {
      minLength?: number;
      maxLength?: number;
      stopwords?: string[];
      stem?: boolean;
    }
  ): [string, number][] {
    const keywords = this.extractKeywords(text, options);
    const frequencyMap = new Map<string, number>();

    // Count keyword frequencies
    for (const keyword of keywords) {
      frequencyMap.set(keyword, (frequencyMap.get(keyword) || 0) + 1);
    }

    // Sort by frequency and return top N
    return Array.from(frequencyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN);
  }
}