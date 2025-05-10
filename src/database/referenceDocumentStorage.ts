import { surrealDBClient } from './surrrealdbClient';
import { Surreal } from 'surrealdb';
import { RecordId } from 'surrealdb';

export interface ReferenceDocument {
    id?: RecordId;
    type: 'pdf' | 'txt' | 'markdown';
    content: string; // Store raw content
    plainText: string; // Store extracted plain text
    hash: string; // Add hash field
    metadata?: any; // Optional metadata
    [key: string]: any; // Add index signature
}

export default class ReferenceDocumentStorage {
    private db: Surreal;
    private tableName = 'reference_documents';

    constructor() {
        this.db = surrealDBClient.getDb();
    }

    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString();
    }

    async addReferenceDocument(document: ReferenceDocument): Promise<ReferenceDocument> {
        // Calculate hash if not already present
        if (!document.hash) {
            document.hash = this.simpleHash(document.content);
        }

        // Check for existing document with the same hash
        const existingDocuments = await this.db.query(
            `SELECT * FROM ${this.tableName} WHERE hash = $hash`,
            { hash: document.hash }
        ) as { result: ReferenceDocument[] }[];

        if (existingDocuments[0] && Array.isArray(existingDocuments[0].result) && existingDocuments[0].result.length > 0) {
            console.log(`Document with hash ${document.hash} already exists. Returning existing document.`);
            return existingDocuments[0].result[0];
        }

        // Add the new document
        const createdDocument = await this.db.create(this.tableName, document);
        return createdDocument[0] as unknown as ReferenceDocument;
    }

    async getReferenceDocument(id: RecordId): Promise<ReferenceDocument | undefined> {
        console.debug(`[ReferenceDocumentStorage] Attempting to get document with ID: ${this.tableName}:${id.id}`);
        const document = await this.db.select<ReferenceDocument>(id);
        console.debug(`[ReferenceDocumentStorage] Result of select for ID ${id.id}:`, document);
        return document
    }

    async getPlainText(id: RecordId): Promise<string | undefined> {
        const document = await this.getReferenceDocument(id);
        return document?.plainText;
    }

    async removeReferenceDocument(id: RecordId): Promise<void> {
        await this.db.delete(`${this.tableName}:${id}`);
    }

    async listReferenceDocuments(): Promise<ReferenceDocument[]> {
        const documents = await this.db.select(this.tableName);
        return documents as unknown as ReferenceDocument[];
    }
}