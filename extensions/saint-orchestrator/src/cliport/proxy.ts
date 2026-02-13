#!/usr/bin/env node
import net from "node:net";
import path from "node:path";
import process from "node:process";
import type { CliportRequest } from "./types.js";
import {
  FRAME_ERROR,
  FRAME_EXIT,
  FRAME_STDERR,
  FRAME_STDOUT,
  tryDecodeFrames,
} from "./protocol.js";

function resolveCliName(argv: string[]): { cli: string; args: string[] } {
  const invoked = path.basename(argv[1] || argv[0] || "cliport-proxy");
  if (invoked !== "cliport-proxy") {
    return {
      cli: invoked,
      args: argv.slice(2),
    };
  }

  const cliFlag = argv[2];
  const cliName = argv[3];
  if (cliFlag === "--cli" && typeof cliName === "string" && cliName.trim()) {
    return {
      cli: cliName.trim(),
      args: argv.slice(4),
    };
  }

  throw new Error("cliport-proxy requires --cli <name> when invoked directly");
}

function parseExitPayload(buffer: Buffer): { code: number } {
  try {
    const parsed = JSON.parse(buffer.toString("utf-8")) as { code?: unknown };
    const code = typeof parsed.code === "number" && Number.isFinite(parsed.code) ? parsed.code : 1;
    return { code };
  } catch {
    return { code: 1 };
  }
}

export async function runCliportProxy(argv = process.argv): Promise<number> {
  const socketPath = process.env.CLIPORT_SOCKET?.trim() || "/var/run/cliport.sock";
  const token = process.env.CLIPORT_TOKEN?.trim() || "";
  const sessionKey = process.env.CLIPORT_SESSION_KEY?.trim() || "";
  const containerName = process.env.CLIPORT_CONTAINER_NAME?.trim() || "";
  const timeoutMsRaw = process.env.CLIPORT_PROXY_TIMEOUT_MS?.trim();
  const timeoutMs = timeoutMsRaw ? Number.parseInt(timeoutMsRaw, 10) : undefined;

  if (!token) {
    process.stderr.write("cliport: missing CLIPORT_TOKEN\n");
    return 1;
  }

  let cli: string;
  let args: string[];
  try {
    ({ cli, args } = resolveCliName(argv));
  } catch (err) {
    process.stderr.write(`cliport: ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }

  const request: CliportRequest = {
    type: "exec",
    token,
    cli,
    args,
    cwd: process.cwd(),
    sessionKey: sessionKey || undefined,
    containerName: containerName || undefined,
    timeoutMs: typeof timeoutMs === "number" && Number.isFinite(timeoutMs) ? timeoutMs : undefined,
  };

  return await new Promise<number>((resolve) => {
    const client = new net.Socket();
    let pending = Buffer.alloc(0) as Buffer;
    let settled = false;

    const finish = (code: number) => {
      if (settled) {
        return;
      }
      settled = true;
      try {
        client.destroy();
      } catch {
        // ignore
      }
      resolve(code);
    };

    client.on("error", (err) => {
      process.stderr.write(`cliport: socket error: ${err.message}\n`);
      finish(1);
    });

    client.on("close", () => {
      if (!settled) {
        finish(1);
      }
    });

    client.on("data", (chunk) => {
      pending = Buffer.concat([pending, chunk as Buffer]);
      const decoded = tryDecodeFrames(pending);
      pending = decoded.rest;

      for (const frame of decoded.frames) {
        if (frame.kind === FRAME_STDOUT) {
          process.stdout.write(frame.payload);
          continue;
        }
        if (frame.kind === FRAME_STDERR) {
          process.stderr.write(frame.payload);
          continue;
        }
        if (frame.kind === FRAME_ERROR) {
          const message = frame.payload.toString("utf-8").trim();
          process.stderr.write(`cliport: ${message}\n`);
          finish(1);
          return;
        }
        if (frame.kind === FRAME_EXIT) {
          const payload = parseExitPayload(frame.payload);
          finish(payload.code);
          return;
        }
      }
    });

    client.connect(socketPath, () => {
      client.write(`${JSON.stringify(request)}\n`);
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCliportProxy().then((code) => {
    process.exitCode = code;
  });
}
