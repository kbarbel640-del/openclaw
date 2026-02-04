import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export type SimplexCliHandle = {
  proc: ChildProcessWithoutNullStreams;
  stop: () => void;
};

export function startSimplexCli(params: {
  cliPath: string;
  wsPort: number;
  dataDir?: string;
  log?: {
    info?: (message: string) => void;
    warn?: (message: string) => void;
    error?: (message: string) => void;
  };
}): SimplexCliHandle {
  const args = ["-p", String(params.wsPort)];
  if (params.dataDir) {
    args.push("-d", params.dataDir);
  }

  const proc = spawn(params.cliPath, args, {
    // Keep stdin open so simplex-chat doesn't exit on immediate EOF.
    stdio: ["pipe", "pipe", "pipe"],
  });

  proc.stdout.on("data", (chunk) => {
    const text = chunk.toString("utf8").trim();
    if (text) {
      params.log?.info?.(`[simplex] ${text}`);
    }
  });

  proc.stderr.on("data", (chunk) => {
    const text = chunk.toString("utf8").trim();
    if (text) {
      params.log?.warn?.(`[simplex] ${text}`);
    }
  });

  proc.on("exit", (code, signal) => {
    params.log?.warn?.(`SimpleX CLI exited (code=${code ?? "?"} signal=${signal ?? "?"})`);
  });

  return {
    proc,
    stop: () => {
      if (!proc.killed) {
        proc.kill();
      }
    },
  };
}
