import { KnowledgeGraphRetriever_Config, KnowledgeGraphWeaver_config } from "@/settings";
import KnowledgeGraphRetriever from "../core/KnowledgeGraphRetriever";
import Learner from "../core/Learner";
import createLoggerWithPrefix from "../lib/console/logger";
import KnowledgeGraphWeaver from "@/core/KnowledgeGraphWeaver";

async function main() {
    // Initialize dependencies
    const logger = createLoggerWithPrefix('TestLearner');
    const retriever = new KnowledgeGraphRetriever(KnowledgeGraphRetriever_Config);
    const weaver = new KnowledgeGraphWeaver(KnowledgeGraphWeaver_config)
    const learner = new Learner(retriever, weaver);

    // Test with existing entity
    // logger.info("Testing with existing entity...");
    // const existingResult = await learner.summarize_new_property(
    //     "系统性红斑狼疮",
    //     "治疗"
    // );
    // console.log("Existing entity result:", existingResult);

    // Test with new entity
    logger.info("\nTesting with new entity...");
    const newResult = await learner.summarize_new_property(
        "克罗恩病",
        "手术指征"
    );
    console.log("New entity result:", newResult);
}

main().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});