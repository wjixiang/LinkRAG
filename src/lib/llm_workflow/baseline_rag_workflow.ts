import KnowledgeBaseRetriever from '@/core/KnowledgeBaseRetriever';
import { semanticSearchResult } from '../../database/chunkStorage';
import Logger from '../console/logger';
import {b} from '../../../baml_client/async_client'
import { RetrievedDocument } from '../../../baml_client';
import { language } from '../../type';
import createLoggerWithPrefix from '../console/logger';
import KnowledgeBase from '@/core/KnowledgeBase';
import { setting } from '@/settings';



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
    query: string, 
    top_k: number, 
    HyDE: boolean = true, 
    language: language = "zh"
){
    const logger = createLoggerWithPrefix('baseline_rag_workflow');
    let retrievalQuery = query;

    if (HyDE) {
        logger.info(`HyDE is enabled. Generating hypothetical answer for retrieval: ${query}`);
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
        const kb = new KnowledgeBase(setting)
        let documents: semanticSearchResult[] = await kb.retriever.chunks_retriver(retrievalQuery, top_k);
       

        // Map retrieved documents to the BAML RetrievedDocument type
        const bamlDocuments: RetrievedDocument[] = documents.map((doc: semanticSearchResult) => ({
            content: doc.document.content, // Assuming the retrieved document has a 'text' property for content
            metadata: JSON.stringify(doc.score) // Assuming the retrieved document has a 'metadata' property
        }));

        // console.log('Retrieved documents:', bamlDocuments);

        logger.info(`Retrieved ${bamlDocuments.length} documents. Generating answer.`);
        const stream = b.stream.GenerateAnswer(query, bamlDocuments, language);
        logger.info('Answer stream initiated.');
        return {stream , bamlDocuments}
    } catch (error) {
        logger.error(`Error during document retrieval or answer generation: ${error}`);
        throw error; // Re-throw the error to be handled by the caller
    }
}