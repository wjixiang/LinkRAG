import { Surreal } from 'surrealdb';
import dotenv from 'dotenv';

dotenv.config();

class SurrealDBClient {
  private db: Surreal | null = null;

  async connect(url: string = process.env.SURREALDB_URL || 'http://127.0.0.1:8000/rpc'): Promise<void> {
    try {
      this.db = new Surreal();
      await this.db.connect(url, {
        auth: {
          username: process.env.SURREALDB_USERNAME || 'root',
          password: process.env.SURREALDB_PASSWORD || 'fl5ox03',
        },
        namespace: process.env.SURREALDB_NAMESPACE || 'test',
        database: process.env.SURREALDB_DATABASE || 'test',
      });
      console.log('Connected to SurrealDB');
    } catch (error) {
      console.error('Failed to connect to SurrealDB:', error);
      this.db = null;
      throw error;
    }
  }

  getDb(): Surreal {
    if (!this.db) {
      throw new Error('SurrealDB connection not established.');
    }
    return this.db;
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