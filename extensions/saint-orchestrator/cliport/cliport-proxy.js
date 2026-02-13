#!/usr/bin/env node
const net = require("node:net");
const path = require("node:path");

const FRAME_STDOUT = 1;
const FRAME_STDERR = 2;
const FRAME_EXIT = 3;
const FRAME_ERROR = 4;

function resolveCli(argv) {
  const invoked = path.basename(argv[1] || argv[0] || "cliport-proxy");
  if (invoked !== "cliport-proxy") {
    return { cli: invoked, args: argv.slice(2) };
  }
  if (argv[2] === "--cli" && typeof argv[3] === "string") {
    return { cli: argv[3], args: argv.slice(4) };
  }
  throw new Error("cliport-proxy requires --cli <name> when invoked directly");
}

function decodeFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (offset + 5 <= buffer.length) {
    const kind = buffer.readUInt8(offset);
    const size = buffer.readUInt32BE(offset + 1);
    const end = offset + 5 + size;
    if (end > buffer.length) {
      break;
    }
    frames.push({ kind, payload: buffer.subarray(offset + 5, end) });
    offset = end;
  }
  return { frames, rest: buffer.subarray(offset) };
}

async function main() {
  const socketPath = process.env.CLIPORT_SOCKET || "/var/run/cliport.sock";
  const token = process.env.CLIPORT_TOKEN || "";
  const sessionKey = process.env.CLIPORT_SESSION_KEY || "";
  const containerName = process.env.CLIPORT_CONTAINER_NAME || "";
  const timeoutMsRaw = process.env.CLIPORT_PROXY_TIMEOUT_MS;
  const timeoutMs =
    typeof timeoutMsRaw === "string" && timeoutMsRaw.trim()
      ? Number.parseInt(timeoutMsRaw.trim(), 10)
      : undefined;
  if (!token) {
    process.stderr.write("cliport: missing CLIPORT_TOKEN\n");
    process.exitCode = 1;
    return;
  }

  let cli;
  let args;
  try {
    ({ cli, args } = resolveCli(process.argv));
  } catch (err) {
    process.stderr.write(`cliport: ${err.message}\n`);
    process.exitCode = 1;
    return;
  }

  const request = {
    type: "exec",
    token,
    cli,
    args,
    cwd: process.cwd(),
    sessionKey: sessionKey || undefined,
    containerName: containerName || undefined,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : undefined,
  };

  await new Promise((resolve) => {
    const client = new net.Socket();
    let pending = Buffer.alloc(0);
    let done = false;
    const finish = (code) => {
      if (done) {
        return;
      }
      done = true;
      try {
        client.destroy();
      } catch {
        // ignore
      }
      process.exitCode = code;
      resolve();
    };

    client.on("error", (err) => {
      process.stderr.write(`cliport: socket error: ${err.message}\n`);
      finish(1);
    });
    client.on("close", () => {
      if (!done) {
        finish(1);
      }
    });
    client.on("data", (chunk) => {
      pending = Buffer.concat([pending, chunk]);
      const decoded = decodeFrames(pending);
      pending = decoded.rest;
      for (const frame of decoded.frames) {
        if (frame.kind === FRAME_STDOUT) {
          process.stdout.write(frame.payload);
        } else if (frame.kind === FRAME_STDERR) {
          process.stderr.write(frame.payload);
        } else if (frame.kind === FRAME_ERROR) {
          process.stderr.write(`cliport: ${frame.payload.toString("utf-8")}\n`);
          finish(1);
          return;
        } else if (frame.kind === FRAME_EXIT) {
          try {
            const payload = JSON.parse(frame.payload.toString("utf-8"));
            const code = Number.isFinite(payload.code) ? payload.code : 1;
            finish(code);
          } catch {
            finish(1);
          }
          return;
        }
      }
    });

    client.connect(socketPath, () => {
      client.write(`${JSON.stringify(request)}\n`);
    });
  });
}

main().catch((err) => {
  process.stderr.write(`cliport: ${err?.message || String(err)}\n`);
  process.exitCode = 1;
});
