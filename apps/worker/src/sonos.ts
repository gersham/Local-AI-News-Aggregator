import { AsyncDeviceDiscovery, Sonos } from 'sonos';

export type SonosDeviceLike = {
  getZoneAttrs: () => Promise<{
    CurrentZoneName?: string;
  }>;
  host: string;
  play: (uri: string) => Promise<unknown>;
};

function normalizeRoomName(roomName: string) {
  return roomName.trim().toLowerCase();
}

export async function discoverSonosDevices(timeout = 5000) {
  const discovery = new AsyncDeviceDiscovery();

  return (await discovery.discoverMultiple({
    timeout,
  })) as SonosDeviceLike[];
}

export async function createDirectSonosDevice(targetHost: string) {
  const host = targetHost.trim();

  if (host.length === 0) {
    throw new Error('A Sonos target host is required for direct playback.');
  }

  return new Sonos(host) as SonosDeviceLike;
}

export async function resolveTargetSonosDevice(options: {
  devices: SonosDeviceLike[];
  targetRoom: string;
}) {
  const targetRoom = normalizeRoomName(options.targetRoom);

  for (const device of options.devices) {
    const zoneAttributes = await device.getZoneAttrs();
    const roomName = zoneAttributes.CurrentZoneName;

    if (roomName && normalizeRoomName(roomName) === targetRoom) {
      return device;
    }
  }

  throw new Error(
    `No Sonos device matched target room "${options.targetRoom}".`,
  );
}

export async function probeSonosTargetRoom(options: {
  createDeviceFromHost?: (targetHost: string) => Promise<SonosDeviceLike>;
  discoverDevices?: () => Promise<SonosDeviceLike[]>;
  targetHost?: string;
  targetRoom: string;
}) {
  const createDeviceFromHost =
    options.createDeviceFromHost ?? createDirectSonosDevice;
  const discoverDevices = options.discoverDevices ?? discoverSonosDevices;
  const devices = options.targetHost
    ? [await createDeviceFromHost(options.targetHost)]
    : await discoverDevices();
  const discoveredRooms: string[] = [];

  for (const device of devices) {
    const roomName = (await device.getZoneAttrs()).CurrentZoneName;

    if (roomName) {
      discoveredRooms.push(roomName);
    }
  }

  const selectedDevice = await resolveTargetSonosDevice({
    devices,
    targetRoom: options.targetRoom,
  });

  return {
    discoveredRooms,
    selectedDeviceHost: selectedDevice.host,
    targetRoom: options.targetRoom,
  };
}

export async function playBriefingOnTargetRoom(options: {
  createDeviceFromHost?: (targetHost: string) => Promise<SonosDeviceLike>;
  discoverDevices?: () => Promise<SonosDeviceLike[]>;
  playbackUrl: string;
  targetHost?: string;
  targetRoom: string;
}) {
  const createDeviceFromHost =
    options.createDeviceFromHost ?? createDirectSonosDevice;
  const discoverDevices = options.discoverDevices ?? discoverSonosDevices;
  const devices = options.targetHost
    ? [await createDeviceFromHost(options.targetHost)]
    : await discoverDevices();
  const selectedDevice = await resolveTargetSonosDevice({
    devices,
    targetRoom: options.targetRoom,
  });
  const roomName = (await selectedDevice.getZoneAttrs()).CurrentZoneName;

  if (!roomName) {
    throw new Error(
      `Selected Sonos device ${selectedDevice.host} has no room name.`,
    );
  }

  await selectedDevice.play(options.playbackUrl);

  return {
    host: selectedDevice.host,
    playbackUrl: options.playbackUrl,
    roomName,
  };
}
