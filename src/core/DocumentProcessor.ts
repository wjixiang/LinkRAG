import { ReferenceDocument, default as ReferenceDocumentStorage } from '../database/referenceDocumentStorage';
import createLoggerWithPrefix from '../lib/console/logger';
import { RecordId } from 'surrealdb';
import winston from 'winston';

export class DocumentProcessor {
    private logger: winston.Logger;
    private referenceDocumentStorage: ReferenceDocumentStorage;

    constructor() {
        this.logger = createLoggerWithPrefix('DocumentProcessor');
        this.referenceDocumentStorage = new ReferenceDocumentStorage();
    }

    /**
     * Saves the generated knowledge graph to the reference document storage.
     * @returns {string|null} - Returns the ReferenceDocument's ID if the knowledge graph is saved successfully, otherwise null.
     */
    async saveToReferenceDocumentStorage(file_path: string): Promise<RecordId|null> {
        try {
            const content = await require('fs').promises.readFile(file_path, 'utf-8');
            const plainText = content; // For now, plain text is the same as content

            // Simple hash calculation (can be replaced with a more robust method if needed)
            const simpleHash = (str: string): string => {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    const char = str.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash; // Convert to 32bit integer
                }
                return hash.toString();
            };

            // Create a ReferenceDocument object (without id, which is handled by storage)
            const referenceDocument: ReferenceDocument = {
                type: 'markdown', // Or another appropriate type
                content: content,
                plainText: plainText,
                hash: simpleHash(content + plainText), // Calculate and add hash
                metadata: {
                    // Add any relevant metadata here
                    generatedAt: new Date().toISOString(),
                },
            };

            // Use ReferenceDocumentStorage to save the document
            const savedDocument = await this.referenceDocumentStorage.addReferenceDocument(referenceDocument);

            this.logger.info("Knowledge graph saved to reference document storage with ID:", savedDocument.id);
            return savedDocument.id || null;

        } catch (error) {
            this.logger.error("Failed to save knowledge graph to reference document storage:", error);
            return null;
        }
    }
}