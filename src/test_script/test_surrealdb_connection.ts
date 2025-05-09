import { surrealDBClient } from '../database/surrrealdbClient';


async function testConnection() {
  try {
    await surrealDBClient.connect();
    console.log('Test connection successful!');
    await surrealDBClient.close();
  } catch (error) {
    console.error('Test connection failed:', error);
  }
}

testConnection();