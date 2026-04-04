import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  defaultOperationalSettings,
  readSourceRegistryFromFile,
} from '@news-aggregator/core';
import { config as loadEnv } from 'dotenv';
import { runWorkerCli } from './cli';
import { buildPublicSourceFetchPlans } from './public-sources';
import { buildXSearchPlans } from './x-search';

export function isWorkerCommand(command: string | undefined) {
  return (
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

  const registryPath =
    process.env.SOURCE_REGISTRY_PATH ??
    resolve(process.cwd(), '../../data/sources.json');
  const exampleRegistryPath =
    process.env.SOURCE_REGISTRY_EXAMPLE_PATH ??
    resolve(process.cwd(), '../../config/sources.example.json');
  const sourceRegistry = readSourceRegistryFromFile(
    existsSync(registryPath) ? registryPath : exampleRegistryPath,
  );
  const publicSourcePlans = buildPublicSourceFetchPlans(sourceRegistry);
  const xSearchPlans = buildXSearchPlans(sourceRegistry);

  console.log('Worker scaffold ready.');
  console.log({
    baseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
    publicDiscoveryPlanCount: publicSourcePlans.length,
    targetRoom: process.env.SONOS_TARGET_ROOM ?? 'unset',
    xSearchPlanCount: xSearchPlans.length,
    availableCommands: [
      'briefing:preview',
      'briefing:audio',
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
