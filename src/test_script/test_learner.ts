import {KnowledgeGraphWeaver_config } from "@/settings";
import createLoggerWithPrefix from "../lib/console/logger";
import KnowledgeBaseEditor from "@/core/KnowledgeBaseEditor";

async function main() {
    // Initialize dependencies
    const logger = createLoggerWithPrefix('TestLearner');
    const weaver = new KnowledgeBaseEditor(KnowledgeGraphWeaver_config)
    
    // Test with existing entity
    // logger.info("Testing with existing entity...");
    // const existingResult = await learner.summarize_new_property(
    //     "系统性红斑狼疮",
    //     "治疗"
    // );
    // console.log("Existing entity result:", existingResult);

    // Test with new entity
    logger.info("\nTesting with new entity...");
    const newResult = await weaver.summarize_new_property(
        "抗利尿激素",
        "生理功能"
    );
    console.log("New entity result:", newResult);
}

main().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});