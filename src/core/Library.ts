import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

/**
 * Interface defining the contract for storage backends
 */
export interface StorageBackend {
  /**
   * Stores content and returns a reference to it
   * @param content The content to store
   * @returns Promise resolving to a storage reference string
   */
  store(content: string): Promise<string>;

  /**
   * Retrieves content by its reference
   * @param reference The storage reference string
   * @returns Promise resolving to the stored content
   */
  retrieve(reference: string): Promise<string>;

  /**
   * Deletes content by its reference
   * @param reference The storage reference string
   * @returns Promise that resolves when deletion is complete
   */
  delete(reference: string): Promise<void>;
}

/**
 * Represents a reference to stored content in the library
 */
export class LibraryReference {
  /**
   * Creates a new LibraryReference
   * @param contentHash SHA-256 hash of the content
   * @param storageType Type of storage backend ('fs', 's3', or 'ipfs')
   * @param storagePath Path/identifier where content is stored
   * @param size Size of content in bytes
   */
  constructor(
    public readonly contentHash: string,
    public readonly storageType: 'fs'|'s3'|'ipfs',
    public readonly storagePath: string,
    public readonly size: number
  ) {}

  /**
   * Returns a string representation of the reference
   * @returns String in format "storageType:contentHash"
   */
  toString(): string {
    return `${this.storageType}:${this.contentHash}`;
  }

  /**
   * Creates a LibraryReference from string representation
   * @param str String in format "storageType:contentHash"
   * @returns New LibraryReference instance
   */
  static fromString(str: string): LibraryReference {
    const [storageType, contentHash] = str.split(':');
    if (!storageType || !contentHash) {
      throw new Error('Invalid LibraryReference string format');
    }
    return new LibraryReference(
      contentHash,
      storageType as 'fs'|'s3'|'ipfs',
      '', // Storage path will be reconstructed when needed
      0 // Size unknown
    );
  }
}

/**
 * Content-addressable storage library for managing information sources
 */
export class Library {
  private backends: Map<string, StorageBackend> = new Map();

  /**
   * Creates a new Library instance with default filesystem backend
   */
  constructor() {
    this.registerBackend('fs', new LocalFileSystemBackend());
  }

  /**
   * Registers a new storage backend
   * @param type Backend type identifier (e.g. 'fs', 's3')
   * @param backend Backend implementation
   * @throws Error if backend type is already registered
   */
  registerBackend(type: string, backend: StorageBackend): void {
    if (this.backends.has(type)) {
      throw new Error(`Backend type ${type} already registered`);
    }
    this.backends.set(type, backend);
  }

  /**
   * Stores content in the library
   * @param content The content to store (must be a string)
   * @returns Promise resolving to a LibraryReference for the stored content
   * @throws Error if content is not a string
   */
  async storeContent(content: string): Promise<LibraryReference> {
    if (typeof content !== 'string') {
      throw new Error('Content must be a string');
    }

    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const size = Buffer.byteLength(content, 'utf8');
    
    const storagePath = await this.backends.get('fs')!.store(content);
    
    return new LibraryReference(
      hash,
      'fs',
      storagePath,
      size
    );
  }

  /**
   * Retrieves content from the library
   * @param ref Reference to the stored content
   * @returns Promise resolving to the stored content
   * @throws Error if storage type is unsupported or content cannot be retrieved
   */
  async getContent(ref: LibraryReference): Promise<string> {
    const backend = this.backends.get(ref.storageType);
    if (!backend) {
      throw new Error(`Unsupported storage type: ${ref.storageType}`);
    }
    
    // For filesystem storage, reconstruct path from content hash
    const storagePath = ref.storageType === 'fs'
      ? path.join('storage/library', ref.contentHash)
      : ref.storagePath;
      
    return backend.retrieve(storagePath);
  }

  /**
   * Deletes content from the library
   * @param ref Reference to the content to delete
   * @returns Promise that resolves when deletion is complete
   * @throws Error if storage type is unsupported or deletion fails
   */
  async deleteContent(ref: LibraryReference): Promise<void> {
    const backend = this.backends.get(ref.storageType);
    if (!backend) {
      throw new Error(`Unsupported storage type: ${ref.storageType}`);
    }
    
    // For filesystem storage, reconstruct path from content hash
    const storagePath = ref.storageType === 'fs'
      ? path.join('./storage/library', ref.contentHash)
      : ref.storagePath;
      
    await backend.delete(storagePath);
  }
}

/**
 * Filesystem-based storage backend implementation
 */
class LocalFileSystemBackend implements StorageBackend {
  private readonly storagePath: string;

  /**
   * Creates a new filesystem backend
   * @param storagePath Base path for storing files (default: './storage/library')
   */
  constructor(storagePath: string = 'storage/library') {
    this.storagePath = storagePath;
  }

  /**
   * Stores content in the filesystem
   * @param content The content to store
   * @returns Promise resolving to the file path where content was stored
   * @throws Error if storage fails
   */
  async store(content: string): Promise<string> {
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const filePath = path.join(this.storagePath, hash);
    
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
      await fs.writeFile(filePath, content);
      return filePath;
    } catch (err) {
      throw new Error(`Failed to store content: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Retrieves content from the filesystem
   * @param reference Path to the stored file
   * @returns Promise resolving to the file content
   * @throws Error if retrieval fails
   */
  async retrieve(reference: string): Promise<string> {
    try {
      return await fs.readFile(reference, 'utf8');
    } catch (err) {
      throw new Error(`Failed to retrieve content: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Deletes content from the filesystem
   * @param reference Path to the file to delete
   * @returns Promise that resolves when deletion is complete
   * @throws Error if deletion fails
   */
  async delete(reference: string): Promise<void> {
    try {
      await fs.unlink(reference);
    } catch (err) {
      throw new Error(`Failed to delete content: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}