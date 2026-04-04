import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const checks = [
  { name: 'node', command: 'node', args: ['-v'] },
  { name: 'pnpm', command: 'pnpm', args: ['-v'] },
  { name: 'git', command: 'git', args: ['--version'] },
  { name: 'codex', command: 'codex', args: ['--version'] },
  { name: 'agent-browser', command: 'agent-browser', args: ['--help'] },
  { name: 'playwright', command: 'playwright', args: ['--version'] },
  { name: 'ffmpeg', command: 'ffmpeg', args: ['-version'] },
] as const;

const failures: string[] = [];

for (const check of checks) {
  try {
    const { stdout, stderr } = await execFileAsync(check.command, check.args, {
      timeout: 15_000,
    });

    const firstLine = `${stdout}${stderr}`.trim().split('\n')[0] ?? 'ok';
    console.log(`[ok] ${check.name}: ${firstLine}`);
  } catch (error) {
    failures.push(check.name);
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[missing] ${check.name}: ${message}`);
  }
}

if (failures.length > 0) {
  console.error('\nTool verification failed.');
  console.error(`Missing or unusable tools: ${failures.join(', ')}`);
  process.exit(1);
}

console.log('\nTool verification passed.');
