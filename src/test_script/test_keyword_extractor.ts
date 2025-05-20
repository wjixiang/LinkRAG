import { KeywordExtractor } from '../core/KeywordExtractor';

// Sample Chinese text to analyze
const sampleText = `
自然语言处理是人工智能的一个重要领域，它研究能实现人与计算机之间用自然语言进行有效通信的各种理论和方法。
自然语言处理是一门融语言学、计算机科学、数学于一体的科学。
`;

// Create extractor instance
const extractor = new KeywordExtractor();

// Basic keyword extraction
console.log('=== Basic Keywords ===');
const keywords = extractor.extractKeywords(sampleText);
console.log(keywords);

// Top keywords by frequency
console.log('\n=== Top 5 Keywords ===');
const topKeywords = extractor.getTopKeywords(sampleText, 5);
console.log(topKeywords);

// With custom options
console.log('\n=== With Custom Options ===');
const customKeywords = extractor.extractKeywords(sampleText, {
  minLength: 3,
  stopwords: ['研究', '方法'],
  stem: false
});
console.log(customKeywords);

// Clinical text sample
const clinicalText = `
患者主诉持续性头痛伴恶心呕吐三天。查体显示血压升高至160/100mmHg，神经系统检查未见明显异常。
初步诊断为高血压危象，建议立即住院治疗并进行头颅CT检查排除脑血管意外。
`;

// Clinical keywords
console.log('\n=== Clinical Keywords ===');
const clinicalKeywords = extractor.extractKeywords(clinicalText);
console.log(clinicalKeywords);

// Top clinical keywords
console.log('\n=== Top Clinical Keywords ===');
const topClinical = extractor.getTopKeywords(clinicalText, 5);
console.log(topClinical);

// Clinical with custom options
console.log('\n=== Clinical With Options ===');
const customClinical = extractor.extractKeywords(clinicalText, {
  minLength: 2,
  stopwords: ['患者', '显示', '进行']
});
console.log(customClinical);

// English text sample
const englishText = `Natural language processing is a subfield of artificial intelligence that focuses on the interaction between computers and humans through natural language.`;

// English keywords
console.log('\n=== English Keywords ===');
const englishKeywords = extractor.extractKeywords(englishText);
console.log(englishKeywords);

// Top English keywords
console.log('\n=== Top English Keywords ===');
const topEnglish = extractor.getTopKeywords(englishText, 5);
console.log(topEnglish);

// English with custom options
console.log('\n=== English With Options ===');
const customEnglish = extractor.extractKeywords(englishText, {
  minLength: 4,
  stopwords: ['that', 'the', 'and']
});
console.log(customEnglish);