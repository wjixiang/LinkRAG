import crypto from 'crypto';
import { surrealDBClient } from '../database/surrealdbClient';
import { RecordId } from 'surrealdb';
import { Library, LibraryReference } from './Library';
import createLogger from '../lib/console/logger';

const logger = createLogger('SourceManager');

/**
 * Configuration options for SourceManager
 */
export interface SourceManagerConfig {
  /**
   * Name of the database table to use (default: 'sources')
   */
  tableName?: string;

  /**
   * Custom Library instance to use (default: new Library())
   */
  library?: Library;

  /**
   * Maximum number of sources to cache in memory (default: 100)
   */
  maxCacheSize?: number;
}

/**
 * Metadata for an information source
 */
export interface SourceMetadata {
  id?: RecordId;
  name: string;
  type: 'pdf' | 'txt' | 'markdown' | 'webpage' | 'database';
  description?: string;
  origin: string; // URL or file path
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  /**
   * Whether the source has been processed (chunked & embedded)
   */
  processed?: boolean;
  /**
   * Content hash for deduplication
   */
  hash?: string;
  [key: string]: any; // Allow additional properties
}

/**
 * Manages information sources using Library for content storage
 * and SurrealDB for metadata/indexing
 */
export default class SourceManager {
  private tableName: string;
  private library: Library;
  private maxCacheSize: number;

  constructor(config: SourceManagerConfig = {}) {
    this.tableName = config.tableName || 'sources';
    this.library = config.library || new Library();
    this.maxCacheSize = config.maxCacheSize || 100;
  }

  /**
   * Adds a new information source
   * @param content The source content
   * @param metadata Source metadata
   * @returns Promise resolving to the stored source metadata
   */
  async addSource(content: string, metadata: Omit<SourceMetadata, 'id'|'createdAt'|'updatedAt'>): Promise<SourceMetadata> {
    // Calculate content hash
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    
    // Check if source with same hash exists
    const existing = await this.searchSources({ hash });
    let contentRef: LibraryReference;
    
    if (existing.length > 0) {
      // Reuse existing content reference
      contentRef = LibraryReference.fromString(existing[0].contentRef);
      logger.debug(`Reusing existing content for hash ${hash} (ref: ${contentRef})`);
    } else {
      // Store new content in library
      contentRef = await this.library.storeContent(content);
      logger.debug(`Stored new content with hash ${hash} (ref: ${contentRef})`);
    }
    
    // Prepare full metadata
    const now = new Date();
    const fullMetadata: SourceMetadata = {
      name: metadata.name,
      type: metadata.type,
      origin: metadata.origin,
      ...metadata,
      contentRef: contentRef.toString(),
      hash,
      createdAt: now,
      updatedAt: now,
      processed: false
    };
    
    logger.info(`Creating source metadata for ${metadata.name} (type: ${metadata.type})`);

    // Store metadata in SurrealDB
    const db = await surrealDBClient.getDb();
    const createdSource = await db.create(this.tableName, fullMetadata);
    return createdSource[0] as unknown as SourceMetadata;
  }

  /**
   * Gets source metadata by ID
   * @param id Source record ID
   * @returns Promise resolving to the source metadata or undefined if not found
   */
  async getSource(id: RecordId): Promise<SourceMetadata | undefined> {
    const db = await surrealDBClient.getDb();
    const source = await db.select<SourceMetadata>(id);
    return source;
  }

  /**
   * Gets source content by metadata ID
   * @param id Source record ID
   * @returns Promise resolving to the source content or undefined if not found
   */
  async getSourceContent(id: RecordId): Promise<string | undefined> {
    const metadata = await this.getSource(id);
    if (!metadata?.contentRef) return undefined;

    const ref = LibraryReference.fromString(metadata.contentRef);
    return this.library.getContent(ref);
  }

  /**
   * Updates source metadata
   * @param id Source record ID 
   * @param updates Partial metadata updates
   * @returns Promise resolving to updated source metadata
   */
  async updateSource(id: RecordId, updates: Partial<SourceMetadata>): Promise<SourceMetadata> {
    const db = await surrealDBClient.getDb();
    updates.updatedAt = new Date();
    await db.merge(id, updates);
    // Return the full updated record
    const updated = await db.select<SourceMetadata>(id);
    return updated as unknown as SourceMetadata;
  }

  /**
   * Removes a source
   * @param id Source record ID
   * @returns Promise that resolves when removal is complete
   */
  async removeSource(id: RecordId): Promise<void> {
    // First get metadata to clean up content
    const metadata = await this.getSource(id);
    if (metadata?.contentRef) {
      const ref = LibraryReference.fromString(metadata.contentRef);
      await this.library.deleteContent(ref);
    }

    // Then delete metadata record
    const db = await surrealDBClient.getDb();
    await db.delete(id);
  }

  /**
   * Lists all sources with basic metadata
   * @returns Promise resolving to array of source metadata
   */
  async listSources(): Promise<SourceMetadata[]> {
    const db = await surrealDBClient.getDb();
    const sources = await db.select(this.tableName);
    return sources as unknown as SourceMetadata[];
  }

  /**
   * Searches sources by metadata fields
   * @param query Search query object
   * @returns Promise resolving to matching sources
   */
  async searchSources(query: Partial<SourceMetadata>): Promise<SourceMetadata[]> {
    const db = await surrealDBClient.getDb();
    const whereClause = Object.entries(query)
      .map(([key, val]) => `${key} = ${typeof val === 'string' ? `'${val}'` : val}`)
      .join(' AND ');

    const result = await db.query(
      `SELECT * FROM ${this.tableName} WHERE ${whereClause}`
    ) as { result: SourceMetadata[] }[];

    return result[0]?.result || [];
  }
}