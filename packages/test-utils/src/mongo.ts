import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

export async function createMongoTestContext() {
  const server = await MongoMemoryServer.create();
  const client = new MongoClient(server.getUri());

  await client.connect();

  const dbName = `news_aggregator_test_${randomUUID().replace(/-/gu, '')}`;

  return {
    client,
    dbName,
    uri: server.getUri(),
    async cleanup() {
      await client.close();
      await server.stop();
    },
  };
}
