import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildHostedArtifactUrl, startAudioArtifactServer } from './audio-host';

const servers: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();

    if (server) {
      await server.close();
    }
  }
});

describe('buildHostedArtifactUrl', () => {
  it('maps a local artifact path to a hosted briefing URL', () => {
    const url = buildHostedArtifactUrl({
      artifactPath:
        '/Users/gersham/Sources/personal/NewsAggregator/artifacts/briefings/2026-04-04/morning-briefing.mp3',
      artifactsRoot: '/Users/gersham/Sources/personal/NewsAggregator/artifacts',
      baseUrl: 'http://arch.local:9999',
    });

    expect(url).toBe(
      'http://arch.local:9999/briefings/2026-04-04/morning-briefing.mp3',
    );
  });
});

describe('startAudioArtifactServer', () => {
  it('serves artifact files over HTTP and rejects path traversal', async () => {
    const artifactsRoot = join(tmpdir(), `audio-host-${Date.now()}`);
    const filePath = join(
      artifactsRoot,
      'briefings',
      '2026-04-04',
      'morning-briefing.mp3',
    );

    await mkdir(join(artifactsRoot, 'briefings', '2026-04-04'), {
      recursive: true,
    });
    await writeFile(filePath, 'audio-bytes', 'utf8');

    const server = await startAudioArtifactServer({
      artifactsRoot,
      host: '127.0.0.1',
      port: 0,
    });
    servers.push(server);

    const okResponse = await fetch(
      `${server.origin}/briefings/2026-04-04/morning-briefing.mp3`,
    );
    const missingResponse = await fetch(`${server.origin}/../../.env`);

    expect(okResponse.status).toBe(200);
    expect(await okResponse.text()).toBe('audio-bytes');
    expect(missingResponse.status).toBe(404);

    await rm(artifactsRoot, { force: true, recursive: true });
  });
});
