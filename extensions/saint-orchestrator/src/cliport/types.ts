import type net from "node:net";

export type CliportRequest = {
  type: "exec";
  token: string;
  cli: string;
  args: string[];
  cwd: string;
  sessionKey?: string;
  containerName?: string;
  timeoutMs?: number;
};

export type CliportRegistryEntry = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  timeoutMs?: number;
  rateLimitPerMinute?: number;
};

export type CliportRegistry = {
  version: number;
  clis: Record<string, CliportRegistryEntry>;
  globalRateLimitPerMinute?: number;
  maskedPaths?: string[];
  workspaceRoot?: string;
  sandboxAgentRoot?: string;
  timeoutMsDefault?: number;
};

export type CliportExecResult = {
  code: number | null;
  signal: NodeJS.Signals | number | null;
  timedOut: boolean;
  durationMs: number;
};

export type CliportDaemonOptions = {
  socketPath: string;
  registryPath: string;
  stateDir: string;
  workspaceDir: string;
  logger?: {
    info?: (message: string) => void;
    warn?: (message: string) => void;
    error?: (message: string) => void;
  };
  defaultTokens?: string[];
};

export type CliportDaemon = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isRunning: () => boolean;
  readonly server?: net.Server;
};

export type RateCounter = {
  windowMinute: number;
  count: number;
};
