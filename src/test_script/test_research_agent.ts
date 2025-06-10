import ResearchAgent from "../lib/agent/researcher/ResearchAgent";
import { b } from "baml_client/async_client";

// Minimal ResearchAgent config that only requires name and language
interface TestConfig {
  name: string;
  language: string;
}

// Mock logger implementation
class TestLogger {
  info(msg: string) { console.log(`[INFO] ${msg}`); }
  error(msg: string) { console.error(`[ERROR] ${msg}`); }
}

// Simple CLI test for ResearchAgent
async function testResearchAgent() {
  // Create minimal config
  const config: TestConfig = {
    name: "test-research-agent",
    language: "zh"
  };

  // Initialize ResearchAgent with mock logger
  const agent = new ResearchAgent({
    ...config,
    logger: new TestLogger()
  } as any);

  // Test query
  const query = "如何鉴别糖尿病酮症酸中毒与低血糖昏迷";

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