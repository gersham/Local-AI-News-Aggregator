import { existsSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { MongoClient } from 'mongodb';

const envPath = '.env';

if (existsSync(envPath)) {
  loadEnv({ path: envPath });
}

const requiredEnvNames = [
  'XAI_API_KEY',
  'EXA_API_KEY',
  'ELEVENLABS_API_KEY',
  'MONGODB_URI',
  'SONOS_TARGET_ROOM',
  'MORNING_BRIEFING_TIME',
  'MORNING_BRIEFING_TIMEZONE',
  'AUDIO_HOST_BASE_URL',
] as const;

const missingEnv = requiredEnvNames.filter(
  (name) => !process.env[name]?.trim(),
);

if (missingEnv.length > 0) {
  console.error('Service verification failed before remote checks.');
  console.error(`Missing required .env values: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const remoteChecks = [
  {
    name: 'xAI',
    url: 'https://api.x.ai/v1/models',
    init: {
      headers: {
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      },
    },
  },
  {
    name: 'Exa',
    url: 'https://api.exa.ai/search',
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.EXA_API_KEY ?? '',
      },
      body: JSON.stringify({
        query: 'news',
        numResults: 1,
        text: false,
      }),
    },
  },
  {
    name: 'ElevenLabs',
    url: 'https://api.elevenlabs.io/v1/voices',
    init: {
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '',
      },
    },
  },
] as const;

const failures: string[] = [];

for (const check of remoteChecks) {
  try {
    const response = await fetch(check.url, check.init);

    if (!response.ok) {
      failures.push(check.name);
      console.error(
        `[failed] ${check.name}: ${response.status} ${response.statusText}`,
      );
      continue;
    }

    console.log(`[ok] ${check.name}: remote access verified`);
  } catch (error) {
    failures.push(check.name);
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[failed] ${check.name}: ${message}`);
  }
}

let mongoClient: MongoClient | undefined;

try {
  mongoClient = new MongoClient(process.env.MONGODB_URI ?? '');
  await mongoClient.connect();
  await mongoClient
    .db(process.env.MONGODB_DB_NAME ?? 'local_ai_news_aggregator')
    .command({ ping: 1 });
  console.log('[ok] MongoDB: remote access verified');
} catch (error) {
  failures.push('MongoDB');
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[failed] MongoDB: ${message}`);
} finally {
  await mongoClient?.close();
}

if (failures.length > 0) {
  console.error('\nRemote service verification failed.');
  console.error(`Blocked integrations: ${failures.join(', ')}`);
  process.exit(1);
}

console.log('\nRemote service verification passed.');
