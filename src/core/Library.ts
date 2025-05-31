import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

export interface StorageBackend {
  store(content: string): Promise<string>;
  retrieve(reference: string): Promise<string>;
  delete(reference: string): Promise<void>;
}

export class LibraryReference {
  constructor(
    public readonly contentHash: string,
    public readonly storageType: 'fs'|'s3'|'ipfs',
    public readonly storagePath: string,
    public readonly size: number
  ) {}

  toString(): string {
    return `${this.storageType}:${this.contentHash}`;
  }
}

export class Library {
  private backends: Map<string, StorageBackend> = new Map();

  constructor() {
    this.registerBackend('fs', new LocalFileSystemBackend());
  }

  registerBackend(type: string, backend: StorageBackend): void {
    if (this.backends.has(type)) {
      throw new Error(`Backend type ${type} already registered`);
    }
    this.backends.set(type, backend);
  }

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

  async getContent(ref: LibraryReference): Promise<string> {
    const backend = this.backends.get(ref.storageType);
    if (!backend) {
      throw new Error(`Unsupported storage type: ${ref.storageType}`);
    }
    return backend.retrieve(ref.storagePath);
  }

  async deleteContent(ref: LibraryReference): Promise<void> {
    const backend = this.backends.get(ref.storageType);
    if (!backend) {
      throw new Error(`Unsupported storage type: ${ref.storageType}`);
    }
    await backend.delete(ref.storagePath);
  }
}

class LocalFileSystemBackend implements StorageBackend {
  private readonly storagePath: string;

  constructor(storagePath: string = './storage/library') {
    this.storagePath = storagePath;
  }

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

  async retrieve(reference: string): Promise<string> {
    try {
      return await fs.readFile(reference, 'utf8');
    } catch (err) {
      throw new Error(`Failed to retrieve content: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async delete(reference: string): Promise<void> {
    try {
      await fs.unlink(reference);
    } catch (err) {
      throw new Error(`Failed to delete content: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}