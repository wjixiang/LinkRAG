import { Library, LibraryReference } from '../Library';
import fs from 'fs/promises';
import path from 'path';

describe('Library', () => {
  const testStoragePath = './test-storage';
  let library: Library;

  beforeEach(async () => {
    // Clean up test storage before each test
    try {
      await fs.rm(testStoragePath, { recursive: true, force: true });
    } catch {}
    
    library = new Library();
  });

  afterAll(async () => {
    // Clean up after all tests
    await fs.rm(testStoragePath, { recursive: true, force: true });
  });

  it('should store and retrieve content', async () => {
    const testContent = 'This is test content';
    const ref = await library.storeContent(testContent);
    
    expect(ref.contentHash).toHaveLength(64); // SHA-256 hash length
    expect(ref.storageType).toBe('fs');
    expect(ref.size).toBe(testContent.length);

    const retrieved = await library.getContent(ref);
    expect(retrieved).toBe(testContent);
  });

  it('should generate same hash for same content', async () => {
    const content = 'Identical content';
    const ref1 = await library.storeContent(content);
    const ref2 = await library.storeContent(content);
    
    expect(ref1.contentHash).toBe(ref2.contentHash);
    expect(ref1.storagePath).toBe(ref2.storagePath);
  });

  it('should throw when retrieving non-existent content', async () => {
    const fakeRef = new LibraryReference(
      'fakehash',
      'fs',
      '/nonexistent/path',
      0
    );
    
    await expect(library.getContent(fakeRef)).rejects.toThrow();
  });

  it('should delete content', async () => {
    const content = 'Content to delete';
    const ref = await library.storeContent(content);
    
    await library.deleteContent(ref);
    await expect(library.getContent(ref)).rejects.toThrow();
  });

  it('should handle large content', async () => {
    const largeContent = 'A'.repeat(10 * 1024 * 1024); // 10MB
    const ref = await library.storeContent(largeContent);
    
    const retrieved = await library.getContent(ref);
    expect(retrieved.length).toBe(largeContent.length);
    expect(retrieved).toBe(largeContent);
  });
});