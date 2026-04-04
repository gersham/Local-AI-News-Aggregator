import { describe, expect, it } from 'vitest';
import { shouldExitAfterCommand } from './index';

describe('shouldExitAfterCommand', () => {
  it('keeps the process alive for long-running audio serving', () => {
    expect(shouldExitAfterCommand('audio:serve')).toBe(false);
  });

  it('exits after one-shot worker commands', () => {
    expect(shouldExitAfterCommand('briefing:audio')).toBe(true);
    expect(shouldExitAfterCommand('briefing:deliver')).toBe(true);
    expect(shouldExitAfterCommand('elevenlabs:probe')).toBe(true);
    expect(shouldExitAfterCommand('sonos:play-briefing')).toBe(true);
  });
});
