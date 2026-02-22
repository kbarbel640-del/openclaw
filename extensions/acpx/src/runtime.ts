import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import type {
  AcpRuntime,
  AcpRuntimeEnsureInput,
  AcpRuntimeErrorCode,
  AcpRuntimeEvent,
  AcpRuntimeHandle,
  AcpRuntimeTurnInput,
  PluginLogger,
} from "openclaw/plugin-sdk";
import { AcpRuntimeError } from "openclaw/plugin-sdk";
import type { ResolvedAcpxPluginConfig } from "./config.js";

export const ACPX_BACKEND_ID = "acpx";

const ACPX_RUNTIME_HANDLE_PREFIX = "acpx:v1:";
const DEFAULT_AGENT_FALLBACK = "codex";

type AcpxHandleState = {
  name: string;
  agent: string;
  cwd: string;
  mode: "persistent" | "oneshot";
};

type AcpxJsonObject = Record<string, unknown>;

type AcpxErrorEvent = {
  message: string;
  code?: string;
  retryable?: boolean;
};

type SpawnExit = {
  code: number | null;
  signal: NodeJS.Signals | null;
  error: Error | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalString(value: unknown): string | undefined {
  const text = asTrimmedString(value);
  return text || undefined;
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function deriveAgentFromSessionKey(sessionKey: string): string {
  const match = sessionKey.match(/^agent:([^:]+):/i);
  const candidate = match?.[1] ? asTrimmedString(match[1]) : "";
  return candidate || DEFAULT_AGENT_FALLBACK;
}

function toAcpxErrorEvent(value: unknown): AcpxErrorEvent | null {
  if (!isRecord(value)) {
    return null;
  }
  if (asTrimmedString(value.type) !== "error") {
    return null;
  }
  return {
    message: asTrimmedString(value.message) || "acpx reported an error",
    code: asOptionalString(value.code),
    retryable: asOptionalBoolean(value.retryable),
  };
}

function parseJsonLines(value: string): AcpxJsonObject[] {
  const events: AcpxJsonObject[] = [];
  for (const line of value.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (isRecord(parsed)) {
        events.push(parsed);
      }
    } catch {
      // Ignore malformed lines; callers handle missing typed events via exit code.
    }
  }
  return events;
}

function buildPermissionArgs(mode: ResolvedAcpxPluginConfig["permissionMode"]): string[] {
  if (mode === "approve-all") {
    return ["--approve-all"];
  }
  if (mode === "deny-all") {
    return ["--deny-all"];
  }
  return ["--approve-reads"];
}

export function encodeAcpxRuntimeHandleState(state: AcpxHandleState): string {
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  return `${ACPX_RUNTIME_HANDLE_PREFIX}${payload}`;
}

export function decodeAcpxRuntimeHandleState(runtimeSessionName: string): AcpxHandleState | null {
  const trimmed = runtimeSessionName.trim();
  if (!trimmed.startsWith(ACPX_RUNTIME_HANDLE_PREFIX)) {
    return null;
  }
  const encoded = trimmed.slice(ACPX_RUNTIME_HANDLE_PREFIX.length);
  if (!encoded) {
    return null;
  }
  try {
    const raw = Buffer.from(encoded, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }
    const name = asTrimmedString(parsed.name);
    const agent = asTrimmedString(parsed.agent);
    const cwd = asTrimmedString(parsed.cwd);
    const mode = asTrimmedString(parsed.mode);
    if (!name || !agent || !cwd) {
      return null;
    }
    if (mode !== "persistent" && mode !== "oneshot") {
      return null;
    }
    return { name, agent, cwd, mode };
  } catch {
    return null;
  }
}

export class AcpxRuntime implements AcpRuntime {
  private healthy = true;
  private readonly logger?: PluginLogger;
  private readonly ttlSeconds?: number;

  constructor(
    private readonly config: ResolvedAcpxPluginConfig,
    opts?: {
      logger?: PluginLogger;
      ttlSeconds?: number;
    },
  ) {
    this.logger = opts?.logger;
    this.ttlSeconds = opts?.ttlSeconds;
  }

  isHealthy(): boolean {
    return this.healthy;
  }

  async probeAvailability(): Promise<void> {
    try {
      const args = [...this.config.commandArgs, "--version"];
      const result = await this.spawnAndCollect({
        args,
        cwd: this.config.cwd,
      });
      this.healthy = result.error == null && (result.code ?? 0) === 0;
    } catch {
      this.healthy = false;
    }
  }

  async ensureSession(input: AcpRuntimeEnsureInput): Promise<AcpRuntimeHandle> {
    const sessionName = asTrimmedString(input.sessionKey);
    if (!sessionName) {
      throw new AcpRuntimeError("ACP_SESSION_INIT_FAILED", "ACP session key is required.");
    }
    const agent = asTrimmedString(input.agent);
    if (!agent) {
      throw new AcpRuntimeError("ACP_SESSION_INIT_FAILED", "ACP agent id is required.");
    }
    const cwd = asTrimmedString(input.cwd) || this.config.cwd;
    const mode = input.mode;

    await this.runControlCommand({
      args: this.buildControlArgs({
        cwd,
        command: [agent, "sessions", "ensure", "--name", sessionName],
      }),
      cwd,
      fallbackCode: "ACP_SESSION_INIT_FAILED",
    });

    return {
      sessionKey: input.sessionKey,
      backend: ACPX_BACKEND_ID,
      runtimeSessionName: encodeAcpxRuntimeHandleState({
        name: sessionName,
        agent,
        cwd,
        mode,
      }),
    };
  }

  async *runTurn(input: AcpRuntimeTurnInput): AsyncIterable<AcpRuntimeEvent> {
    const state = this.resolveHandleState(input.handle);
    const args = this.buildPromptArgs({
      agent: state.agent,
      sessionName: state.name,
      cwd: state.cwd,
    });

    const child = spawn(this.config.command, args, {
      cwd: state.cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin.on("error", () => {
      // Ignore EPIPE when the child exits before stdin flush completes.
    });

    const onAbort = () => {
      void this.cancel({
        handle: input.handle,
        reason: "abort-signal",
      }).catch((err) => {
        this.logger?.warn?.(`acpx runtime abort-cancel failed: ${String(err)}`);
      });
    };

    if (input.signal?.aborted) {
      onAbort();
    } else if (input.signal) {
      input.signal.addEventListener("abort", onAbort, { once: true });
    }

    child.stdin.end(input.text);

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    let sawDone = false;
    let sawError = false;
    const lines = createInterface({ input: child.stdout });
    try {
      for await (const line of lines) {
        const parsed = this.parsePromptEventLine(line);
        if (!parsed) {
          continue;
        }
        if (parsed.type === "done") {
          sawDone = true;
        }
        if (parsed.type === "error") {
          sawError = true;
        }
        yield parsed;
      }

      const exit = await this.waitForExit(child);
      if (exit.error) {
        if (this.isCommandMissing(exit.error)) {
          this.healthy = false;
          throw new AcpRuntimeError(
            "ACP_BACKEND_UNAVAILABLE",
            `acpx command not found: ${this.config.command}`,
            { cause: exit.error },
          );
        }
        throw new AcpRuntimeError("ACP_TURN_FAILED", exit.error.message, { cause: exit.error });
      }

      if ((exit.code ?? 0) !== 0 && !sawError) {
        yield {
          type: "error",
          message: stderr.trim() || `acpx exited with code ${exit.code ?? "unknown"}`,
        };
        return;
      }

      if (!sawDone && !sawError) {
        yield { type: "done" };
      }
    } finally {
      lines.close();
      if (input.signal) {
        input.signal.removeEventListener("abort", onAbort);
      }
    }
  }

  async cancel(input: { handle: AcpRuntimeHandle; reason?: string }): Promise<void> {
    const state = this.resolveHandleState(input.handle);
    await this.runControlCommand({
      args: this.buildControlArgs({
        cwd: state.cwd,
        command: [state.agent, "cancel", "--session", state.name],
      }),
      cwd: state.cwd,
      fallbackCode: "ACP_TURN_FAILED",
      ignoreNoSession: true,
    });
  }

  async close(input: { handle: AcpRuntimeHandle; reason: string }): Promise<void> {
    const state = this.resolveHandleState(input.handle);
    await this.runControlCommand({
      args: this.buildControlArgs({
        cwd: state.cwd,
        command: [state.agent, "sessions", "close", state.name],
      }),
      cwd: state.cwd,
      fallbackCode: "ACP_TURN_FAILED",
      ignoreNoSession: true,
    });
  }

  private resolveHandleState(handle: AcpRuntimeHandle): AcpxHandleState {
    const decoded = decodeAcpxRuntimeHandleState(handle.runtimeSessionName);
    if (decoded) {
      return decoded;
    }

    const legacyName = asTrimmedString(handle.runtimeSessionName);
    if (!legacyName) {
      throw new AcpRuntimeError(
        "ACP_SESSION_INIT_FAILED",
        "Invalid acpx runtime handle: runtimeSessionName is missing.",
      );
    }

    return {
      name: legacyName,
      agent: deriveAgentFromSessionKey(handle.sessionKey),
      cwd: this.config.cwd,
      mode: "persistent",
    };
  }

  private buildControlArgs(params: { cwd: string; command: string[] }): string[] {
    return [
      ...this.config.commandArgs,
      "--format",
      "json",
      "--json-strict",
      "--cwd",
      params.cwd,
      ...params.command,
    ];
  }

  private buildPromptArgs(params: { agent: string; sessionName: string; cwd: string }): string[] {
    const args = [
      ...this.config.commandArgs,
      "--format",
      "json",
      "--json-strict",
      "--cwd",
      params.cwd,
      ...buildPermissionArgs(this.config.permissionMode),
      "--non-interactive-permissions",
      this.config.nonInteractivePermissions,
    ];
    if (this.config.timeoutSeconds) {
      args.push("--timeout", String(this.config.timeoutSeconds));
    }
    if (typeof this.ttlSeconds === "number") {
      args.push("--ttl", String(this.ttlSeconds));
    }
    args.push(params.agent, "prompt", "--session", params.sessionName, "--file", "-");
    return args;
  }

  private async runControlCommand(params: {
    args: string[];
    cwd: string;
    fallbackCode: AcpRuntimeErrorCode;
    ignoreNoSession?: boolean;
  }): Promise<void> {
    const result = await this.spawnAndCollect({
      args: params.args,
      cwd: params.cwd,
    });

    if (result.error) {
      if (this.isCommandMissing(result.error)) {
        this.healthy = false;
        throw new AcpRuntimeError(
          "ACP_BACKEND_UNAVAILABLE",
          `acpx command not found: ${this.config.command}`,
          { cause: result.error },
        );
      }
      throw new AcpRuntimeError(params.fallbackCode, result.error.message, { cause: result.error });
    }

    const events = parseJsonLines(result.stdout);
    const errorEvent = events.map((event) => toAcpxErrorEvent(event)).find(Boolean) ?? null;
    if (errorEvent) {
      if (params.ignoreNoSession && errorEvent.code === "NO_SESSION") {
        return;
      }
      throw new AcpRuntimeError(
        params.fallbackCode,
        errorEvent.code ? `${errorEvent.code}: ${errorEvent.message}` : errorEvent.message,
      );
    }

    if ((result.code ?? 0) !== 0) {
      throw new AcpRuntimeError(
        params.fallbackCode,
        result.stderr.trim() || `acpx exited with code ${result.code ?? "unknown"}`,
      );
    }
  }

  private async spawnAndCollect(params: { args: string[]; cwd: string }): Promise<{
    stdout: string;
    stderr: string;
    code: number | null;
    error: Error | null;
  }> {
    const child = spawn(this.config.command, params.args, {
      cwd: params.cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin.end();

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    const exit = await this.waitForExit(child);
    return {
      stdout,
      stderr,
      code: exit.code,
      error: exit.error,
    };
  }

  private async waitForExit(child: ChildProcessWithoutNullStreams): Promise<SpawnExit> {
    return await new Promise<SpawnExit>((resolve) => {
      let settled = false;
      const finish = (result: SpawnExit) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(result);
      };

      child.once("error", (err) => {
        finish({ code: null, signal: null, error: err });
      });

      child.once("close", (code, signal) => {
        finish({ code, signal, error: null });
      });
    });
  }

  private parsePromptEventLine(line: string): AcpRuntimeEvent | null {
    const trimmed = line.trim();
    if (!trimmed) {
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return {
        type: "status",
        text: trimmed,
      };
    }

    if (!isRecord(parsed)) {
      return null;
    }

    const type = asTrimmedString(parsed.type);
    switch (type) {
      case "text": {
        const content = asTrimmedString(parsed.content);
        if (!content) {
          return null;
        }
        return {
          type: "text_delta",
          text: content,
          stream: "output",
        };
      }
      case "thought": {
        const content = asTrimmedString(parsed.content);
        if (!content) {
          return null;
        }
        return {
          type: "text_delta",
          text: content,
          stream: "thought",
        };
      }
      case "tool_call": {
        const title = asTrimmedString(parsed.title) || asTrimmedString(parsed.toolCallId) || "tool";
        const status = asTrimmedString(parsed.status);
        return {
          type: "tool_call",
          text: status ? `${title} (${status})` : title,
        };
      }
      case "client_operation": {
        const method = asTrimmedString(parsed.method) || "operation";
        const status = asTrimmedString(parsed.status);
        const summary = asTrimmedString(parsed.summary);
        const text = [method, status, summary].filter(Boolean).join(" ");
        if (!text) {
          return null;
        }
        return { type: "status", text };
      }
      case "plan": {
        const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
        const first = entries.find((entry) => isRecord(entry)) as
          | Record<string, unknown>
          | undefined;
        const content = asTrimmedString(first?.content);
        if (!content) {
          return null;
        }
        return { type: "status", text: `plan: ${content}` };
      }
      case "update": {
        const update = asTrimmedString(parsed.update);
        if (!update) {
          return null;
        }
        return { type: "status", text: update };
      }
      case "done": {
        return {
          type: "done",
          stopReason: asOptionalString(parsed.stopReason),
        };
      }
      case "error": {
        const message = asTrimmedString(parsed.message) || "acpx runtime error";
        return {
          type: "error",
          message,
          code: asOptionalString(parsed.code),
          retryable: asOptionalBoolean(parsed.retryable),
        };
      }
      default:
        return null;
    }
  }

  private isCommandMissing(err: unknown): boolean {
    if (!err || typeof err !== "object") {
      return false;
    }
    const code = (err as NodeJS.ErrnoException).code;
    return code === "ENOENT";
  }
}
