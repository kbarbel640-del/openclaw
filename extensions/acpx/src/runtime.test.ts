import fs from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ResolvedAcpxPluginConfig } from "./config.js";
import { AcpxRuntime, decodeAcpxRuntimeHandleState } from "./runtime.js";

const NOOP_LOGGER = {
  info: (_message: string) => {},
  warn: (_message: string) => {},
  error: (_message: string) => {},
  debug: (_message: string) => {},
};

const MOCK_CLI_SCRIPT = String.raw`#!/usr/bin/env node
const fs = require("node:fs");

const args = process.argv.slice(2);
const logPath = process.env.MOCK_ACPX_LOG;
const writeLog = (entry) => {
  if (!logPath) return;
  fs.appendFileSync(logPath, JSON.stringify(entry) + "\n");
};

if (args.includes("--version") || args.includes("--help")) {
  process.stdout.write("mock-acpx 0.0.0\n");
  process.exit(0);
}

const commandIndex = args.findIndex((arg) => arg === "prompt" || arg === "cancel" || arg === "sessions");
const command = commandIndex >= 0 ? args[commandIndex] : "";
const agent = commandIndex > 0 ? args[commandIndex - 1] : "unknown";

const readFlag = (flag) => {
  const idx = args.indexOf(flag);
  if (idx < 0) return "";
  return String(args[idx + 1] || "");
};

const sessionFromOption = readFlag("--session");
const ensureName = readFlag("--name");
const closeName = command === "sessions" && args[commandIndex + 1] === "close" ? String(args[commandIndex + 2] || "") : "";

if (command === "sessions" && args[commandIndex + 1] === "ensure") {
  writeLog({ kind: "ensure", agent, args, sessionName: ensureName });
  process.stdout.write(JSON.stringify({
    type: "session_ensured",
    id: "rec-" + ensureName,
    sessionId: "sid-" + ensureName,
    name: ensureName,
    created: true,
  }) + "\n");
  process.exit(0);
}

if (command === "cancel") {
  writeLog({ kind: "cancel", agent, args, sessionName: sessionFromOption });
  process.stdout.write(JSON.stringify({
    sessionId: "sid-" + sessionFromOption,
    cancelled: true,
  }) + "\n");
  process.exit(0);
}

if (command === "sessions" && args[commandIndex + 1] === "close") {
  writeLog({ kind: "close", agent, args, sessionName: closeName });
  process.stdout.write(JSON.stringify({
    type: "session_closed",
    id: "rec-" + closeName,
    sessionId: "sid-" + closeName,
    name: closeName,
  }) + "\n");
  process.exit(0);
}

if (command === "prompt") {
  const stdinText = fs.readFileSync(0, "utf8");
  writeLog({ kind: "prompt", agent, args, sessionName: sessionFromOption, stdinText });
  const sessionId = "sid-" + sessionFromOption;

  if (stdinText.includes("trigger-error")) {
    process.stdout.write(JSON.stringify({
      eventVersion: 1,
      sessionId,
      requestId: "req-1",
      seq: 0,
      stream: "prompt",
      type: "error",
      code: "RUNTIME",
      message: "mock failure",
    }) + "\n");
    process.exit(1);
  }

  if (stdinText.includes("split-spacing")) {
    process.stdout.write(JSON.stringify({
      eventVersion: 1,
      sessionId,
      requestId: "req-1",
      seq: 0,
      stream: "prompt",
      type: "text",
      content: "alpha",
    }) + "\n");
    process.stdout.write(JSON.stringify({
      eventVersion: 1,
      sessionId,
      requestId: "req-1",
      seq: 1,
      stream: "prompt",
      type: "text",
      content: " beta",
    }) + "\n");
    process.stdout.write(JSON.stringify({
      eventVersion: 1,
      sessionId,
      requestId: "req-1",
      seq: 2,
      stream: "prompt",
      type: "text",
      content: " gamma",
    }) + "\n");
    process.stdout.write(JSON.stringify({
      eventVersion: 1,
      sessionId,
      requestId: "req-1",
      seq: 3,
      stream: "prompt",
      type: "done",
      stopReason: "end_turn",
    }) + "\n");
    process.exit(0);
  }

  process.stdout.write(JSON.stringify({
    eventVersion: 1,
    sessionId,
    requestId: "req-1",
    seq: 0,
    stream: "prompt",
    type: "thought",
    content: "thinking",
  }) + "\n");
  process.stdout.write(JSON.stringify({
    eventVersion: 1,
    sessionId,
    requestId: "req-1",
    seq: 1,
    stream: "prompt",
    type: "tool_call",
    title: "run-tests",
    status: "in_progress",
  }) + "\n");
  process.stdout.write(JSON.stringify({
    eventVersion: 1,
    sessionId,
    requestId: "req-1",
    seq: 2,
    stream: "prompt",
    type: "text",
    content: "echo:" + stdinText.trim(),
  }) + "\n");
  process.stdout.write(JSON.stringify({
    eventVersion: 1,
    sessionId,
    requestId: "req-1",
    seq: 3,
    stream: "prompt",
    type: "done",
    stopReason: "end_turn",
  }) + "\n");
  process.exit(0);
}

writeLog({ kind: "unknown", args });
process.stdout.write(JSON.stringify({
  eventVersion: 1,
  sessionId: "unknown",
  seq: 0,
  stream: "control",
  type: "error",
  code: "USAGE",
  message: "unknown command",
}) + "\n");
process.exit(2);
`;

const tempDirs: string[] = [];

async function createMockRuntime(params?: {
  permissionMode?: ResolvedAcpxPluginConfig["permissionMode"];
  ttlSeconds?: number;
}): Promise<{
  runtime: AcpxRuntime;
  logPath: string;
  config: ResolvedAcpxPluginConfig;
}> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "openclaw-acpx-runtime-test-"));
  tempDirs.push(dir);
  const scriptPath = path.join(dir, "mock-acpx.cjs");
  const logPath = path.join(dir, "calls.log");
  await writeFile(scriptPath, MOCK_CLI_SCRIPT, "utf8");
  process.env.MOCK_ACPX_LOG = logPath;

  const config: ResolvedAcpxPluginConfig = {
    command: process.execPath,
    commandArgs: [scriptPath],
    cwd: dir,
    permissionMode: params?.permissionMode ?? "approve-all",
    nonInteractivePermissions: "fail",
  };

  return {
    runtime: new AcpxRuntime(config, {
      ttlSeconds: params?.ttlSeconds,
      logger: NOOP_LOGGER,
    }),
    logPath,
    config,
  };
}

async function readLogEntries(logPath: string): Promise<Array<Record<string, unknown>>> {
  if (!fs.existsSync(logPath)) {
    return [];
  }
  const raw = await readFile(logPath, "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

afterEach(async () => {
  delete process.env.MOCK_ACPX_LOG;
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) {
      continue;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

describe("AcpxRuntime", () => {
  it("ensures sessions and streams prompt events", async () => {
    const { runtime, logPath } = await createMockRuntime({ ttlSeconds: 180 });

    const handle = await runtime.ensureSession({
      sessionKey: "agent:codex:acp:123",
      agent: "codex",
      mode: "persistent",
    });
    expect(handle.backend).toBe("acpx");

    const events = [];
    for await (const event of runtime.runTurn({
      handle,
      text: "hello world",
      mode: "prompt",
      requestId: "req-test",
    })) {
      events.push(event);
    }

    expect(events).toContainEqual({
      type: "text_delta",
      text: "thinking",
      stream: "thought",
    });
    expect(events).toContainEqual({
      type: "tool_call",
      text: "run-tests (in_progress)",
    });
    expect(events).toContainEqual({
      type: "text_delta",
      text: "echo:hello world",
      stream: "output",
    });
    expect(events).toContainEqual({
      type: "done",
      stopReason: "end_turn",
    });

    const logs = await readLogEntries(logPath);
    const ensure = logs.find((entry) => entry.kind === "ensure");
    const prompt = logs.find((entry) => entry.kind === "prompt");
    expect(ensure).toBeDefined();
    expect(prompt).toBeDefined();
    expect(Array.isArray(prompt?.args)).toBe(true);
    const promptArgs = (prompt?.args as string[]) ?? [];
    expect(promptArgs).toContain("--ttl");
    expect(promptArgs).toContain("180");
    expect(promptArgs).toContain("--approve-all");
  });

  it("preserves leading spaces across streamed text deltas", async () => {
    const { runtime } = await createMockRuntime();
    const handle = await runtime.ensureSession({
      sessionKey: "agent:codex:acp:space",
      agent: "codex",
      mode: "persistent",
    });

    const textDeltas: string[] = [];
    for await (const event of runtime.runTurn({
      handle,
      text: "split-spacing",
      mode: "prompt",
      requestId: "req-space",
    })) {
      if (event.type === "text_delta" && event.stream === "output") {
        textDeltas.push(event.text);
      }
    }

    expect(textDeltas).toEqual(["alpha", " beta", " gamma"]);
    expect(textDeltas.join("")).toBe("alpha beta gamma");
  });

  it("maps acpx error events into ACP runtime error events", async () => {
    const { runtime } = await createMockRuntime();
    const handle = await runtime.ensureSession({
      sessionKey: "agent:codex:acp:456",
      agent: "codex",
      mode: "persistent",
    });

    const events = [];
    for await (const event of runtime.runTurn({
      handle,
      text: "trigger-error",
      mode: "prompt",
      requestId: "req-err",
    })) {
      events.push(event);
    }

    expect(events).toContainEqual({
      type: "error",
      message: "mock failure",
      code: "RUNTIME",
      retryable: undefined,
    });
  });

  it("supports cancel and close using encoded runtime handle state", async () => {
    const { runtime, logPath, config } = await createMockRuntime();
    const handle = await runtime.ensureSession({
      sessionKey: "agent:claude:acp:789",
      agent: "claude",
      mode: "persistent",
    });

    const decoded = decodeAcpxRuntimeHandleState(handle.runtimeSessionName);
    expect(decoded?.name).toBe("agent:claude:acp:789");

    const secondRuntime = new AcpxRuntime(config, { logger: NOOP_LOGGER });

    await secondRuntime.cancel({ handle, reason: "test" });
    await secondRuntime.close({ handle, reason: "test" });

    const logs = await readLogEntries(logPath);
    const cancel = logs.find((entry) => entry.kind === "cancel");
    const close = logs.find((entry) => entry.kind === "close");
    expect(cancel?.sessionName).toBe("agent:claude:acp:789");
    expect(close?.sessionName).toBe("agent:claude:acp:789");
  });

  it("marks runtime unhealthy when command is missing", async () => {
    const runtime = new AcpxRuntime(
      {
        command: "/definitely/missing/acpx",
        commandArgs: [],
        cwd: process.cwd(),
        permissionMode: "approve-reads",
        nonInteractivePermissions: "fail",
      },
      { logger: NOOP_LOGGER },
    );

    await runtime.probeAvailability();
    expect(runtime.isHealthy()).toBe(false);
  });

  it("marks runtime healthy when command is available", async () => {
    const { runtime } = await createMockRuntime();
    await runtime.probeAvailability();
    expect(runtime.isHealthy()).toBe(true);
  });
});
