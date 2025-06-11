import { language } from "@/type";
import ResearchAgent, { ResearchAgentConfig } from "../lib/agent/researcher/ResearchAgent";
import * as dotenv from 'dotenv';
import KnowledgeBase from "@/core/KnowledgeBase";
import { setting } from "@/settings";
dotenv.config()

// Minimal ResearchAgent config that only requires name and language
interface TestConfig {
  name: string;
  language: string;
}



// Simple CLI test for ResearchAgent
async function testResearchAgent() {
  // Create minimal config
  const config: ResearchAgentConfig = {
    language: "中文" as language,
    knowledgebase: new KnowledgeBase(setting)
  };

  // Initialize ResearchAgent with mock logger
  const agent = new ResearchAgent(config);

  // Test query
  const query = "高血压病的临床表现";

  console.log(`Testing ResearchAgent with query: "${query}"`);
  
  try {
    // Execute the research flow
    const result = await agent.start(query).next();
    
    if (result.value?.type === "error") {
      console.error("Research failed:", result.value.content);
    } else {
      console.log("Research completed successfully");
      console.log("Result:", result.value);
    }
  } catch (error) {
    console.error("Error during research:", error);
  }
}

// Run the test
testResearchAgent()
  .then(() => console.log("Test completed"))
  .catch(console.error);