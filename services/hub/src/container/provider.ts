import type { DeviceCredentials } from "../db/queries.js";

export type ContainerUrls = {
  gatewayUrl: string;
  bridgeUrl: string;
};

export type SpawnResult = {
  containerId: string;
  gatewayUrl: string;
  gatewayToken: string;
  bridgeUrl: string;
  deviceCredentials: DeviceCredentials;
};

export type StartResult = ContainerUrls & {
  newContainerId?: string;
};

export type RestartResult = ContainerUrls & {
  newContainerId?: string;
};

export interface ContainerProvider {
  spawn(params: { name: string; image: string }): Promise<SpawnResult>;
  start(containerId: string): Promise<StartResult>;
  stop(containerId: string): Promise<void>;
  remove(containerId: string): Promise<void>;
  getLogs(containerId: string, tail?: number): Promise<string>;
  getStatus(containerId: string): Promise<string>;
  getRestartMarker(containerId: string): Promise<string>;
  waitForRestart(
    containerId: string,
    marker: string,
    opts?: { timeoutMs?: number },
  ): Promise<RestartResult>;
}
