declare module 'sonos' {
  export class AsyncDeviceDiscovery {
    discoverMultiple(options?: { timeout?: number }): Promise<
      Array<{
        getZoneAttrs: () => Promise<{
          CurrentZoneName?: string;
        }>;
        host: string;
        play: (uri: string) => Promise<unknown>;
      }>
    >;
  }

  export class Sonos {
    constructor(host: string, port?: number);
    getZoneAttrs(): Promise<{
      CurrentZoneName?: string;
    }>;
    host: string;
    play(uri: string): Promise<unknown>;
  }
}
