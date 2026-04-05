import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  defaultOperationalSettings,
  loadSourceRegistryFromMongo,
} from '@news-aggregator/core';
import { config as loadEnv } from 'dotenv';
import { runWorkerCli } from './cli';
import { buildPublicSourceFetchPlans } from './public-sources';
import { buildXSearchPlans } from './x-search';

export function isWorkerCommand(command: string | undefined) {
  return (
    command?.startsWith('ingest:') ||
    command?.startsWith('briefing:') ||
    command?.startsWith('elevenlabs:') ||
    command?.startsWith('audio:') ||
    command?.startsWith('sonos:') ||
    false
  );
}

export function shouldExitAfterCommand(command: string | undefined) {
  return command !== 'audio:serve';
}

export async function runWorkerEntryPoint(argv = process.argv.slice(2)) {
  loadEnv({ path: resolve(process.cwd(), '../../.env') });

  const command = argv[0];

  if (isWorkerCommand(command)) {
    await runWorkerCli(argv);

    if (shouldExitAfterCommand(command)) {
      process.exit(0);
    }

    return;
  }

  const registryLegacyPath =
    process.env.SOURCE_REGISTRY_LEGACY_PATH ??
    process.env.SOURCE_REGISTRY_PATH ??
    resolve(process.cwd(), '../../data/sources.seed.json');
  const exampleRegistryPath =
    process.env.SOURCE_REGISTRY_EXAMPLE_PATH ??
    resolve(process.cwd(), '../../config/sources.example.json');
  const sourceRegistry = (
    await loadSourceRegistryFromMongo({
      sourceRegistryExamplePath: exampleRegistryPath,
      sourceRegistryLegacyPath: registryLegacyPath,
    })
  ).registry;
  const publicSourcePlans = buildPublicSourceFetchPlans(sourceRegistry);
  const xSearchPlans = buildXSearchPlans(sourceRegistry);

  console.log('Worker ready.');
  console.log({
    baseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
    publicDiscoveryPlanCount: publicSourcePlans.length,
    targetRoom: process.env.SONOS_TARGET_ROOM ?? 'unset',
    xSearchPlanCount: xSearchPlans.length,
    availableCommands: [
      'ingest:run',
      'briefing:preview',
      'briefing:audio',
      'briefing:generate',
      'briefing:deliver',
      'elevenlabs:probe',
      'audio:serve',
      'sonos:probe',
      'sonos:play-briefing',
    ],
    scheduledBriefingTime:
      process.env.MORNING_BRIEFING_TIME ??
      defaultOperationalSettings.morningBriefingTime,
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await runWorkerEntryPoint();
}
