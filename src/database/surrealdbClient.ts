import { Surreal } from 'surrealdb';
import * as dotenv from 'dotenv';

dotenv.config();

class SurrealDBClient {
  private db: Surreal | null = null;
  private lastAuthTime: number = 0;
  private authRefreshInterval: number = 3600000; // 1 hour in ms

  async connect(url: string = process.env.SURREALDB_URL || 'http://127.0.0.1:8000/rpc'): Promise<void> {
    try {
      this.db = new Surreal();
      await this.authenticate(url);
      console.log('Connected to SurrealDB');
    } catch (error) {
      console.error('Failed to connect to SurrealDB:', error);
      this.db = null;
      throw error;
    }
  }

  private async authenticate(url: string): Promise<void> {
    if (!this.db) return;
    
    await this.db.connect(url, {
      auth: {
        username: process.env.SURREALDB_USERNAME || 'root',
        password: process.env.SURREALDB_PASSWORD || 'fl5ox03',
      },
      namespace: process.env.SURREALDB_NAMESPACE || 'test',
      database: process.env.SURREALDB_DATABASE || 'test',
    });
    this.lastAuthTime = Date.now();
  }

  private async checkAndRefreshAuth(): Promise<void> {
    if (!this.db) return;
    
    const now = Date.now();
    if (now - this.lastAuthTime > this.authRefreshInterval) {
      console.log('Refreshing SurrealDB authentication token');
      await this.db.invalidate();
      await this.authenticate(process.env.SURREALDB_URL || 'http://127.0.0.1:8000/rpc');
    }
  }

  async getDb(): Promise<Surreal> {
    if (!this.db) {
      throw new Error('SurrealDB connection not established.');
    }
    await this.checkAndRefreshAuth();
    return this.db as Surreal;
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      console.log('Disconnected from SurrealDB');
      this.db = null;
    }
  }
}

export const surrealDBClient = new SurrealDBClient();