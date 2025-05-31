import SourceManager from './SourceManager';
import createLoggerWithPrefix from '../lib/console/logger';
import { RecordId } from 'surrealdb';
import winston from 'winston';

export class DocumentProcessor {
    private logger: winston.Logger;
    private sourceManager: SourceManager;

    constructor() {
        this.logger = createLoggerWithPrefix('DocumentProcessor');
        this.sourceManager = new SourceManager();
    }

    /**
     * Saves the document to the source management system.
     * @returns {string|null} - Returns the source ID if saved successfully, otherwise null.
     */
    async saveToReferenceDocumentStorage(file_path: string): Promise<RecordId|null> {
        try {
            const content = await require('fs').promises.readFile(file_path, 'utf-8');
            
            // Determine file type from extension
            const fileType = file_path.split('.').pop()?.toLowerCase() || 'txt';
            const validTypes = ['pdf', 'txt', 'markdown', 'md'];
            const type = validTypes.includes(fileType) ?
                (fileType === 'md' ? 'markdown' : fileType as 'pdf'|'txt'|'markdown') :
                'txt';

            // Add source with metadata
            const source = await this.sourceManager.addSource(content, {
                name: file_path.split('/').pop() || 'Untitled',
                type,
                origin: file_path,
                description: `Document imported from ${file_path}`,
                tags: ['imported']
            });

            this.logger.info("Document saved to source management system with ID:", source.id);
            return source.id || null;

        } catch (error) {
            this.logger.error("Failed to save document to source management system:", error);
            return null;
        }
    }
}