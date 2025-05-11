import KnowledgeGraphRetriever from '../../core/KnowledgeGraphRetriever';
import Logger from '../console/logger';
import { b } from '../../../baml_client';
import { RetrievedDocument } from '../../../baml_client';
import { ChunkDocument } from '../../database/chunkStorage';
import { language } from '../../type';


/**
 * Implements a baseline Retrieval Augmented Generation (RAG) workflow.
 * This function retrieves relevant documents based on a query and then uses
 * a Language Model (LLM) to generate an answer based on the retrieved documents.
 * Optionally uses HyDE (Hypothetical Document Embedding) for retrieval.
 * test script: `src/test_script/test_rag_workflow.ts`
 *
 * @param KnowledgeGraphRetriever - An instance of KnowledgeGraphRetriever for document retrieval.
 * @param query - The user's query.
 * @param top_k - The number of top documents to retrieve.
 * @param HyDE - Whether to use HyDE for retrieval (defaults to true).
 * @param language - The language of the query and expected answer (defaults to "zh").
 * @returns A promise that resolves with the generated answer string.
 * @throws If an error occurs during HyDE rewrite, document retrieval, or answer generation.
 */
export default async function baseline_rag_workflow(
    KnowledgeGraphRetriever: KnowledgeGraphRetriever, 
    query: string, 
    top_k: number, 
    HyDE: boolean = true, 
    language: language = "zh"
): Promise<string> {
    const logger = new Logger('baseline_rag_workflow');
    let retrievalQuery = query;

    if (HyDE) {
        logger.info('HyDE is enabled. Generating hypothetical answer for retrieval.');
        try {
            const hydeResult = await b.HyDE_rewrite(query, language);
            retrievalQuery = hydeResult.HyDE_answer;
            logger.info(`HyDE rewritten query: ${retrievalQuery}`);
        } catch (error) {
            logger.error(`Error during HyDE rewrite: ${error}`);
            // Continue with original query if HyDE rewrite fails
        }
    }

    logger.info(`Retrieving documents for query: ${retrievalQuery}`);
    try {
        const documents: ChunkDocument[] = await KnowledgeGraphRetriever.chunks_retriver(retrievalQuery, top_k);

        // Map retrieved documents to the BAML RetrievedDocument type
        const bamlDocuments: RetrievedDocument[] = documents.map((doc: ChunkDocument) => ({
            content: doc.content, // Assuming the retrieved document has a 'text' property for content
            metadata: JSON.stringify(doc.metadata) // Assuming the retrieved document has a 'metadata' property
        }));

        logger.info(`Retrieved ${bamlDocuments.length} documents. Generating answer.`);
        const answer = await b.GenerateAnswer(query, bamlDocuments, language);
        logger.info('Answer generated successfully.');
        return answer;
    } catch (error) {
        logger.error(`Error during document retrieval or answer generation: ${error}`);
        throw error; // Re-throw the error to be handled by the caller
    }
}