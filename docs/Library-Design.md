# Library Component Design

## Core Interfaces

```typescript
// Storage Backend Interface
interface StorageBackend {
  store(content: string): Promise<string>;
  retrieve(reference: string): Promise<string>;
  delete(reference: string): Promise<void>;
}

// Library Reference Class
class LibraryReference {
  constructor(
    public readonly contentHash: string,
    public readonly storageType: 'fs'|'s3'|'ipfs',
    public readonly storagePath: string, 
    public readonly size: number
  ) {}
}
```

## Main Library Implementation

```typescript
class Library {
  private backends: Map<string, StorageBackend> = new Map();

  constructor() {
    this.registerBackend('fs', new LocalFileSystemBackend());
  }

  registerBackend(type: string, backend: StorageBackend) {
    this.backends.set(type, backend);
  }

  async storeContent(content: string): Promise<LibraryReference> {
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const size = Buffer.byteLength(content, 'utf8');
    const storagePath = await this.backends.get('fs')!.store(content);
    
    return new LibraryReference(hash, 'fs', storagePath, size);
  }

  async getContent(ref: LibraryReference): Promise<string> {
    const backend = this.backends.get(ref.storageType);
    if (!backend) throw new Error(`Unsupported storage type: ${ref.storageType}`);
    return backend.retrieve(ref.storagePath);
  }
}
```

## Filesystem Backend Implementation

```typescript
class LocalFileSystemBackend implements StorageBackend {
  private storagePath = './storage/library';

  async store(content: string): Promise<string> {
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const filePath = path.join(this.storagePath, hash);
    await fs.promises.mkdir(this.storagePath, { recursive: true });
    await fs.promises.writeFile(filePath, content);
    return filePath;
  }

  async retrieve(reference: string): Promise<string> {
    return fs.promises.readFile(reference, 'utf8');
  }

  async delete(reference: string): Promise<void> {
    await fs.promises.unlink(reference);
  }
}
```

## Integration with InformationSource

```typescript
class InformationSource {
  private library: Library;

  constructor(library: Library) {
    this.library = library;
  }

  async addContent(content: string) {
    const ref = await this.library.storeContent(content);
    // Store reference in database
    await db.store({
      contentRef: ref,
      // ... other metadata
    });
  }
}
```

## Next Steps

1. Switch to Code mode to implement these components
2. Create test cases
3. Integrate with existing system