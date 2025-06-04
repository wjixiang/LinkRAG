import { AttributeExtractor } from '../core/EPExtractor';

// Sample medical texts to test
const TEST_TEXTS = [
  "高血压患者常见临床表现包括头痛、头晕和心悸",
  "乳腺癌的诊断通常需要乳腺X线摄影和活检等辅助检查",
  "糖尿病的治疗方案包括胰岛素注射和饮食控制"
];

async function main() {
  const extractor = new AttributeExtractor();
  
  for (const text of TEST_TEXTS) {
    console.log(`\nInput text: "${text}"`);
    
    try {
      const epStrings = await extractor.extract(text);
      
      if (epStrings.length > 0) {
        console.log("Extracted EP strings:");
        epStrings.forEach(ep => console.log(`- ${ep}`));
      } else {
        console.log("No EP strings extracted");
      }
    } catch (error) {
      console.error("Error during extraction:", error);
    }
  }
}

main().catch(console.error);