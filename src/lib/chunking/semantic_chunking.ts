import { parseSentences } from 'sentence-parse';
import { ONNXEmbedder } from '../embedding/ONNXEmbedder';
import { dot } from 'mathjs';
import winston from 'winston';
import createLoggerWithPrefix from '../console/logger';
import ProgressBar from 'progress';

// Define default options
const DEFAULT_MAX_TOKEN_SIZE = 512; // Example value, adjust as needed
const DEFAULT_SIMILARITY_THRESHOLD = 0.5; // Example value, adjust as needed
const DEFAULT_MIN_TOKEN_SIZE = 50; // Example value, adjust as needed for merging small chunks

/**
 * Interface for options passed to the semantic_chunking function.
 */
export interface SemanticChunkingConfig {
    maxTokenSize?: number;
    similarityThreshold?: number;
    minTokenSize?: number;
}

let embedder: ONNXEmbedder | null = null;

async function getEmbedder(): Promise<ONNXEmbedder> {
    if (!embedder) {
        embedder = new ONNXEmbedder();
        await embedder.init();
    }
    return embedder;
}

// Simple token counting function (can be replaced with a more accurate one if needed)
export async function countTokens(text: string): Promise<number> {
    const embedderInstance = await getEmbedder();
    // Ensure tokenizer is available before using it
    if (!embedderInstance['tokenizer']) {
         throw new Error("Tokenizer not initialized in ONNXEmbedder");
    }
    const encoded = await embedderInstance['tokenizer'](text); // Accessing private tokenizer for token count
    return encoded.input_ids.size;
}

// Calculate cosine similarity between two vectors
function cosineSimilarity(vec1: Float32Array, vec2: Float32Array): number {
    // Convert Float32Array to standard arrays for mathjs
    const arr1 = Array.from(vec1);
    const arr2 = Array.from(vec2);

    const product = dot(arr1, arr2) as number;
    const magnitude1 = Math.sqrt(arr1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(arr2.reduce((sum, val) => sum + val * val, 0));
    if (magnitude1 === 0 || magnitude2 === 0) {
        return 0;
    }
    return product / (magnitude1 * magnitude2);
}

export async function semantic_chunking(
    text: string,
    options?: SemanticChunkingConfig // Use the new interface here
): Promise<string[]> {
    const logger = createLoggerWithPrefix('SemanticChunking');
    logger.info('Starting semantic chunking process');

    const maxTokenSize = options?.maxTokenSize ?? DEFAULT_MAX_TOKEN_SIZE;
    const similarityThreshold = options?.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
    const minTokenSize = options?.minTokenSize ?? DEFAULT_MIN_TOKEN_SIZE;

    logger.debug(`Options: maxTokenSize=${maxTokenSize}, similarityThreshold=${similarityThreshold}, minTokenSize=${minTokenSize}`);

    const sentences = await parseSentences(text);
    logger.info(`Parsed ${sentences.length} sentences`);

    if (sentences.length === 0) {
        logger.info('No sentences found, returning empty array');
        return [];
    }

    const embedderInstance = await getEmbedder();
    const chunks: string[] = [];
    let currentChunkSentences: string[] = [];
    let currentChunkTokenCount = 0;
    const sentenceTokenCounts: number[] = [];
    const sentenceEmbeddings: Float32Array[] = [];

    // Process sentences in batches for embedding and token counting
    const batchSize = 64; // Adjust batch size as needed
    logger.info(`Processing sentences in batches of ${batchSize} for embedding and token counting`);

    const embeddingProgressBar = new ProgressBar('Embedding and token counting [:bar] :percent :etas', {
        total: sentences.length,
        width: 40,
    });

    for (let i = 0; i < sentences.length; i += batchSize) {
        const sentenceBatch = sentences.slice(i, i + batchSize);
        logger.debug(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(sentences.length / batchSize)}`);
        const embeddingsBatch = await embedderInstance.embedDocuments(sentenceBatch);
        sentenceEmbeddings.push(...embeddingsBatch);

        for (const sentence of sentenceBatch) {
            sentenceTokenCounts.push(await countTokens(sentence));
            embeddingProgressBar.tick();
        }
    }
    logger.info('Finished embedding and token counting for all sentences');

    logger.info('Starting initial chunk splitting based on token size and similarity');
    const splittingProgressBar = new ProgressBar('Chunk splitting [:bar] :percent :etas', {
        total: sentences.length,
        width: 40,
    });

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        const sentenceTokenCount = sentenceTokenCounts[i];

        // Check if adding the current sentence exceeds the max token size
        if (currentChunkTokenCount + sentenceTokenCount > maxTokenSize && currentChunkSentences.length > 0) {
            logger.debug(`Splitting chunk due to max token size. Current chunk size: ${currentChunkTokenCount}, next sentence size: ${sentenceTokenCount}`);
            chunks.push(currentChunkSentences.join(' '));
            currentChunkSentences = [];
            currentChunkTokenCount = 0;
        }

        currentChunkSentences.push(sentence);
        currentChunkTokenCount += sentenceTokenCount;

        // Check for split point based on similarity (if not the last sentence)
        if (i < sentences.length - 1) {
            const similarity = cosineSimilarity(sentenceEmbeddings[i], sentenceEmbeddings[i + 1]);
            logger.debug(`Similarity between sentence ${i} and ${i+1}: ${similarity}`);
            if (similarity < similarityThreshold) {
                if (currentChunkSentences.length > 0) {
                    logger.debug(`Splitting chunk due to low similarity (${similarity} < ${similarityThreshold})`);
                    chunks.push(currentChunkSentences.join(' '));
                    currentChunkSentences = [];
                    currentChunkTokenCount = 0;
                }
            }
        }
        splittingProgressBar.tick();
    }

    // Add the last chunk if it's not empty
    if (currentChunkSentences.length > 0) {
        logger.debug('Adding last chunk');
        chunks.push(currentChunkSentences.join(' '));
    }
    logger.info(`Initial splitting resulted in ${chunks.length} chunks`);

    // --- Merge small chunks ---
    logger.info(`Starting merging of chunks smaller than ${minTokenSize} tokens`);
    const mergedChunks: string[] = [];
    // Recalculate token counts for chunks after initial splitting
    // This part might be slow, consider adding a progress bar here too if needed
    const chunkTokenCounts: number[] = await Promise.all(chunks.map(chunk => countTokens(chunk)));
    logger.debug('Recalculated token counts for initial chunks');

    const mergingProgressBar = new ProgressBar('Merging small chunks [:bar] :percent :etas', {
        total: chunks.length,
        width: 40,
    });

    const finalMergedChunks: string[] = [];
    let tempChunk = "";
    let tempChunkTokenCount = 0;

    for (const chunk of chunks) { // Iterate through initial chunks, not mergedChunks
        const chunkSize = await countTokens(chunk);
        if (tempChunkTokenCount + chunkSize < minTokenSize && tempChunk !== "") {
            logger.debug(`Merging chunk with size ${chunkSize} into previous chunk (current merged size: ${tempChunkTokenCount})`);
            tempChunk += " " + chunk;
            tempChunkTokenCount += chunkSize;
        } else {
            if (tempChunk !== "") {
                finalMergedChunks.push(tempChunk);
                logger.debug(`Pushed merged chunk with size ${tempChunkTokenCount}`);
            }
            tempChunk = chunk;
            tempChunkTokenCount = chunkSize;
            logger.debug(`Starting new merged chunk with size ${tempChunkTokenCount}`);
        }
        mergingProgressBar.tick();
    }
    if (tempChunk !== "") {
        finalMergedChunks.push(tempChunk);
        logger.debug(`Pushed final merged chunk with size ${tempChunkTokenCount}`);
    }

    logger.info(`Merging resulted in ${finalMergedChunks.length} final chunks`);
    // --- End merge small chunks ---

    logger.info('Semantic chunking process finished');
    return finalMergedChunks;
}