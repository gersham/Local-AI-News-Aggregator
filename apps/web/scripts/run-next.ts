import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config as loadEnv } from 'dotenv';

export function getWebAppPath(scriptDirectory: string) {
  return resolve(scriptDirectory, '..');
}

export function getRootEnvPath(scriptDirectory: string) {
  return resolve(scriptDirectory, '../../..', '.env');
}

export function loadRootEnvConfig(
  scriptDirectory: string,
  envLoader: typeof loadEnv = loadEnv,
  processEnv: NodeJS.ProcessEnv = process.env,
) {
  return envLoader({
    path: getRootEnvPath(scriptDirectory),
    processEnv,
    quiet: true,
  });
}

export function buildNextProcessEnv(
  scriptDirectory: string,
  envLoader: typeof loadEnv = loadEnv,
  baseEnv: NodeJS.ProcessEnv = process.env,
) {
  const nextEnv = { ...baseEnv };
  const result = loadRootEnvConfig(scriptDirectory, envLoader, nextEnv);

  for (const [key, value] of Object.entries(result.parsed ?? {})) {
    if (key === 'NODE_ENV') {
      continue;
    }

    nextEnv[key] = value;
  }

  if (result.parsed && Object.hasOwn(result.parsed, 'NODE_ENV')) {
    Reflect.deleteProperty(nextEnv, 'NODE_ENV');
  }

  return nextEnv;
}

async function runNextCommand(command: string) {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const nextEnv = buildNextProcessEnv(scriptDirectory);

  const child = spawn('next', [command], {
    cwd: getWebAppPath(scriptDirectory),
    env: nextEnv,
    stdio: 'inherit',
  });

  await new Promise<void>((resolvePromise, rejectPromise) => {
    child.on('error', rejectPromise);
    child.on('exit', (code, signal) => {
      if (signal) {
        rejectPromise(
          new Error(`next ${command} exited with signal ${signal}`),
        );
        return;
      }

      if ((code ?? 0) !== 0) {
        rejectPromise(new Error(`next ${command} exited with code ${code}`));
        return;
      }

      resolvePromise();
    });
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const command = process.argv[2];

  if (!command || !['build', 'dev', 'start'].includes(command)) {
    throw new Error('Usage: tsx scripts/run-next.ts <dev|build|start>');
  }

  await runNextCommand(command);
}
