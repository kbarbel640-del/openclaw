declare module "../../scripts/run-node.mjs" {
  export const runNodeWatchedPaths: string[];
  export function runNodeMain(params?: {
    spawn?: (
      cmd: string,
      args: string[],
      options: unknown,
    ) => {
      on: (
        event: "exit",
        cb: (code: number | null, signal: string | null) => void,
      ) => void | undefined;
    };
    spawnSync?: unknown;
    fs?: unknown;
    stderr?: { write: (value: string) => void };
    execPath?: string;
    cwd?: string;
    args?: string[];
    env?: NodeJS.ProcessEnv;
    platform?: NodeJS.Platform;
  }): Promise<number>;
}

declare module "../../scripts/watch-node.mjs" {
  export function runWatchMain(params?: {
    spawn?: (
      cmd: string,
      args: string[],
      options: unknown,
    ) => { on: (event: "exit", cb: (code: number | null, signal: string | null) => void) => void };
    process?: NodeJS.Process;
    cwd?: string;
    args?: string[];
    env?: NodeJS.ProcessEnv;
    now?: () => number;
  }): Promise<number>;
}

declare module "../../scripts/gateway-watch.mjs" {
  export function buildGatewayWatchArgs(params?: {
    platform?: NodeJS.Platform;
    args?: string[];
  }): string[];
  export function runGatewayWatchMain(params?: {
    platform?: NodeJS.Platform;
    spawnSync?: (
      cmd: string,
      args: string[],
      options?: unknown,
    ) => {
      status?: number | null;
    };
    execPath?: string;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    args?: string[];
    process?: NodeJS.Process;
    spawn?: (
      cmd: string,
      args: string[],
      options: unknown,
    ) => { on: (event: "exit", cb: (code: number | null, signal: string | null) => void) => void };
    now?: () => number;
  }): Promise<number>;
}
