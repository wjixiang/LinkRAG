import { QueryDecomposer, QueryDecomposerConfig } from '../core/QueryDecomposer';

const config: QueryDecomposerConfig = {
  language: "zh"
}

async function main() {
  const decomposer = new QueryDecomposer(config);
  
  // Test simple query
  const query1 = "糖尿病的临床表现是什么？";
  console.log(`Testing query: "${query1}"`);
  const result1 = await decomposer.convert_query(query1);
  console.log('Result:', result1);

  // Test more complex query
  const query2 = "糖尿病和高血压的诊断方法和治疗方案";
  console.log(`Testing query: "${query2}"`);
  const result2 = await decomposer.convert_query(query2);
  console.log('Result:', result2);

  // Test more indirect query
  const query3 = "如何鉴别肱骨外上髁骨折和肘关节脱位？";
  console.log(`Testing query: "${query3}"`);
  const result3 = await decomposer.convert_query(query3);
  console.log('Result:', result3);
}

main().catch(console.error);