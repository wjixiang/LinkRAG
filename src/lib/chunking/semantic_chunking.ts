import { parseSentences } from 'sentence-parse';
import { ONNXEmbedder } from '../embedding/ONNXEmbedder';
import { dot } from 'mathjs';

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
async function countTokens(text: string): Promise<number> {
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
    const maxTokenSize = options?.maxTokenSize ?? DEFAULT_MAX_TOKEN_SIZE;
    const similarityThreshold = options?.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
    const minTokenSize = options?.minTokenSize ?? DEFAULT_MIN_TOKEN_SIZE;

    const sentences = await parseSentences(text);
    if (sentences.length === 0) {
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
    for (let i = 0; i < sentences.length; i += batchSize) {
        const sentenceBatch = sentences.slice(i, i + batchSize);
        const embeddingsBatch = await embedderInstance.embedDocuments(sentenceBatch);
        sentenceEmbeddings.push(...embeddingsBatch);

        for (const sentence of sentenceBatch) {
            sentenceTokenCounts.push(await countTokens(sentence));
        }
    }

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        const sentenceTokenCount = sentenceTokenCounts[i];

        // Check if adding the current sentence exceeds the max token size
        if (currentChunkTokenCount + sentenceTokenCount > maxTokenSize && currentChunkSentences.length > 0) {
            chunks.push(currentChunkSentences.join(' '));
            currentChunkSentences = [];
            currentChunkTokenCount = 0;
        }

        currentChunkSentences.push(sentence);
        currentChunkTokenCount += sentenceTokenCount;

        // Check for split point based on similarity (if not the last sentence)
        if (i < sentences.length - 1) {
            const similarity = cosineSimilarity(sentenceEmbeddings[i], sentenceEmbeddings[i + 1]);
            if (similarity < similarityThreshold) {
                if (currentChunkSentences.length > 0) {
                    chunks.push(currentChunkSentences.join(' '));
                    currentChunkSentences = [];
                    currentChunkTokenCount = 0;
                }
            }
        }
    }

    // Add the last chunk if it's not empty
    if (currentChunkSentences.length > 0) {
        chunks.push(currentChunkSentences.join(' '));
    }

    // --- Merge small chunks ---
    const mergedChunks: string[] = [];
    // Recalculate token counts for chunks after initial splitting
    const chunkTokenCounts: number[] = await Promise.all(chunks.map(chunk => countTokens(chunk)));

    for (let i = 0; i < chunks.length; i++) {
        const currentChunk = chunks[i];
        const currentChunkSize = chunkTokenCounts[i];

        if (currentChunkSize < minTokenSize && chunks.length > 1) {
            if (i === 0) {
                // Merge with the next chunk if it's the first chunk
                if (i + 1 < chunks.length) {
                    chunks[i + 1] = currentChunk + ' ' + chunks[i + 1];
                    // Update token count for the merged chunk
                    chunkTokenCounts[i + 1] += currentChunkSize;
                } else {
                     // If it's the only chunk and smaller than min size, keep it as is
                     mergedChunks.push(currentChunk);
                }
            } else {
                // Merge with the previous chunk
                mergedChunks[mergedChunks.length - 1] += ' ' + currentChunk;
                // Update token count for the merged chunk (need to find the index in mergedChunks)
                // This part is tricky with the current merging logic. A simpler approach might be needed.
                // For now, we'll just push and recalculate later if necessary or simplify merging.
            }
        } else {
            mergedChunks.push(currentChunk);
        }
    }
    // A simpler merge logic might be better to avoid complex token count tracking
    // Let's refine the merging logic to be simpler and recalculate token counts after merging

    const finalMergedChunks: string[] = [];
    let tempChunk = "";
    let tempChunkTokenCount = 0;

    for (const chunk of mergedChunks) {
        const chunkSize = await countTokens(chunk);
        if (tempChunkTokenCount + chunkSize < minTokenSize && tempChunk !== "") {
            tempChunk += " " + chunk;
            tempChunkTokenCount += chunkSize;
        } else {
            if (tempChunk !== "") {
                finalMergedChunks.push(tempChunk);
            }
            tempChunk = chunk;
            tempChunkTokenCount = chunkSize;
        }
    }
    if (tempChunk !== "") {
        finalMergedChunks.push(tempChunk);
    }

    // --- End merge small chunks ---


    return finalMergedChunks;
}