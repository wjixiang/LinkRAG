import { parseSentences } from 'sentence-parse';
import { ONNXEmbedder } from '../embedding/ONNXEmbedder';
import winston from 'winston';
import createLoggerWithPrefix from '../console/logger';
import pLimit from 'p-limit';

export class SentenceSimilarityCalculator {
    private logger: winston.Logger;
    private embedder: ONNXEmbedder | null = null;

    constructor() {
        this.logger = createLoggerWithPrefix('SentenceSimilarityCalculator');
    }

    private async getEmbedder(): Promise<ONNXEmbedder> {
        if (!this.embedder) {
            this.embedder = new ONNXEmbedder();
            await this.embedder.init();
        }
        return this.embedder;
    }

    private cosineSimilarity(vec1: Float32Array, vec2: Float32Array): number {
        const arr1 = Array.from(vec1);
        const arr2 = Array.from(vec2);

        const product = arr1.reduce((sum, val, i) => sum + val * arr2[i], 0);
        const magnitude1 = Math.sqrt(arr1.reduce((sum, val) => sum + val * val, 0));
        const magnitude2 = Math.sqrt(arr2.reduce((sum, val) => sum + val * val, 0));
        if (magnitude1 === 0 || magnitude2 === 0) {
            return 0;
        }
        return product / (magnitude1 * magnitude2);
    }

    public async generateAndSaveChart(text: string, outputPath: string): Promise<void> {
        try {
            this.logger.info('Starting sentence similarity calculation');

            // Parse and embed sentences
            const sentences = await parseSentences(text);
            if (sentences.length < 2) {
                throw new Error('Need at least 2 sentences for similarity comparison');
            }

            const embedder = await this.getEmbedder();
            const limit = pLimit(5); // Limit concurrent embeddings to 5
            const embeddings = await Promise.all(
                sentences.map((sentence: string) => limit(() => embedder.embedDocuments([sentence])))
            ).then(results => results.flat());

            // Calculate similarities
            const similarities: number[] = [];
            for (let i = 0; i < embeddings.length - 1; i++) {
                similarities.push(this.cosineSimilarity(embeddings[i], embeddings[i + 1]));
            }

            // Generate CSV content
            const labels = Array.from({length: sentences.length-1}, (_,i) => `S${i+1}-${i+2}`);
            let csvContent = 'SentencePair,Similarity\n';
            labels.forEach((label, i) => {
                csvContent += `${label},${similarities[i].toFixed(4)}\n`;
            });

            // Save to file
            const fs = require('fs');
            return fs.promises.writeFile(outputPath, csvContent);

        } catch (error) {
            this.logger.error(`Visualization failed: ${error}`);
            throw error;
        }
    }
}
