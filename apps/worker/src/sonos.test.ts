import { describe, expect, it, vi } from 'vitest';
import {
  createDirectSonosDevice,
  playBriefingOnTargetRoom,
  probeSonosTargetRoom,
  resolveTargetSonosDevice,
} from './sonos';

describe('resolveTargetSonosDevice', () => {
  it('matches the configured room name against discovered zone attributes', async () => {
    const device = await resolveTargetSonosDevice({
      devices: [
        {
          getZoneAttrs: async () => ({
            CurrentZoneName: 'Kitchen',
          }),
          host: '192.168.1.10',
          play: vi.fn(),
        },
        {
          getZoneAttrs: async () => ({
            CurrentZoneName: 'Bedroom Ceiling',
          }),
          host: '192.168.1.15',
          play: vi.fn(),
        },
      ],
      targetRoom: 'Bedroom Ceiling',
    });

    expect(device.host).toBe('192.168.1.15');
  });
});

describe('playBriefingOnTargetRoom', () => {
  it('plays the hosted briefing URL on the matching speaker', async () => {
    const play = vi.fn(async () => undefined);

    const result = await playBriefingOnTargetRoom({
      discoverDevices: async () => [
        {
          getZoneAttrs: async () => ({
            CurrentZoneName: 'Bedroom Ceiling',
          }),
          host: '192.168.1.15',
          play,
        },
      ],
      playbackUrl:
        'http://arch.local:9999/briefings/2026-04-04/morning-briefing.mp3',
      targetRoom: 'Bedroom Ceiling',
    });

    expect(play).toHaveBeenCalledWith(
      'http://arch.local:9999/briefings/2026-04-04/morning-briefing.mp3',
    );
    expect(result).toEqual({
      host: '192.168.1.15',
      playbackUrl:
        'http://arch.local:9999/briefings/2026-04-04/morning-briefing.mp3',
      roomName: 'Bedroom Ceiling',
    });
  });

  it('can target a speaker directly by configured host without discovery', async () => {
    const play = vi.fn(async () => undefined);

    const result = await playBriefingOnTargetRoom({
      createDeviceFromHost: async () => ({
        getZoneAttrs: async () => ({
          CurrentZoneName: 'Bedroom Ceiling',
        }),
        host: '10.3.78.223',
        play,
      }),
      playbackUrl:
        'http://arch.local:9999/briefings/2026-04-04/morning-briefing.mp3',
      targetHost: '10.3.78.223',
      targetRoom: 'Bedroom Ceiling',
    });

    expect(play).toHaveBeenCalledWith(
      'http://arch.local:9999/briefings/2026-04-04/morning-briefing.mp3',
    );
    expect(result.host).toBe('10.3.78.223');
  });
});

describe('probeSonosTargetRoom', () => {
  it('reports discovered room names and the selected target room', async () => {
    const result = await probeSonosTargetRoom({
      discoverDevices: async () => [
        {
          getZoneAttrs: async () => ({
            CurrentZoneName: 'Bedroom Ceiling',
          }),
          host: '192.168.1.15',
          play: vi.fn(),
        },
        {
          getZoneAttrs: async () => ({
            CurrentZoneName: 'Office',
          }),
          host: '192.168.1.22',
          play: vi.fn(),
        },
      ],
      targetRoom: 'Bedroom Ceiling',
    });

    expect(result).toEqual({
      discoveredRooms: ['Bedroom Ceiling', 'Office'],
      selectedDeviceHost: '192.168.1.15',
      targetRoom: 'Bedroom Ceiling',
    });
  });
});

describe('createDirectSonosDevice', () => {
  it('throws when no host is provided', async () => {
    await expect(createDirectSonosDevice('')).rejects.toThrow(/target host/i);
  });
});
