import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, relative, resolve, sep } from 'node:path';

function getContentType(pathname: string) {
  const extension = extname(pathname).toLowerCase();

  if (extension === '.mp3') {
    return 'audio/mpeg';
  }

  if (extension === '.json') {
    return 'application/json; charset=utf-8';
  }

  if (extension === '.txt') {
    return 'text/plain; charset=utf-8';
  }

  return 'application/octet-stream';
}

function isPathWithinRoot(rootPath: string, candidatePath: string) {
  const normalizedRoot = rootPath.endsWith(sep)
    ? rootPath
    : `${rootPath}${sep}`;

  return candidatePath === rootPath || candidatePath.startsWith(normalizedRoot);
}

export function buildHostedArtifactUrl(options: {
  artifactPath: string;
  artifactsRoot: string;
  baseUrl: string;
}) {
  const rootPath = resolve(options.artifactsRoot);
  const artifactPath = resolve(options.artifactPath);

  if (!isPathWithinRoot(rootPath, artifactPath)) {
    throw new Error(
      `Artifact path ${artifactPath} is outside the artifacts root ${rootPath}.`,
    );
  }

  const relativePath = relative(rootPath, artifactPath).split(sep).join('/');
  const baseUrl = new URL(options.baseUrl);

  return new URL(
    relativePath,
    `${baseUrl.href.replace(/\/?$/, '/')}`,
  ).toString();
}

async function listen(server: Server, host: string, port: number) {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise);
    server.listen(port, host, () => {
      server.off('error', rejectPromise);
      resolvePromise();
    });
  });
}

export async function startAudioArtifactServer(options: {
  artifactsRoot: string;
  host: string;
  port: number;
}) {
  const artifactsRoot = resolve(options.artifactsRoot);
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(
        request.url ?? '/',
        `http://${request.headers.host ?? `${options.host}:${options.port}`}`,
      );
      const relativePath = decodeURIComponent(requestUrl.pathname).replace(
        /^\/+/,
        '',
      );
      const filePath = resolve(artifactsRoot, relativePath);

      if (!isPathWithinRoot(artifactsRoot, filePath)) {
        response.statusCode = 404;
        response.end('Not found');
        return;
      }

      await access(filePath);
      const fileStat = await stat(filePath);

      if (!fileStat.isFile()) {
        response.statusCode = 404;
        response.end('Not found');
        return;
      }

      response.setHeader('Content-Length', fileStat.size);
      response.setHeader('Content-Type', getContentType(filePath));
      createReadStream(filePath).pipe(response);
    } catch {
      response.statusCode = 404;
      response.end('Not found');
    }
  });

  await listen(server, options.host, options.port);
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Audio artifact server did not expose a TCP address.');
  }

  return {
    close: async () => {
      await new Promise<void>((resolvePromise, rejectPromise) => {
        server.close((error) => {
          if (error) {
            rejectPromise(error);
            return;
          }

          resolvePromise();
        });
      });
    },
    origin: `http://${address.address}:${address.port}`,
  };
}
