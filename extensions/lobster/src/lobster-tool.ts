import { Type } from "@sinclair/typebox";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { OpenClawPluginApi } from "../../../src/plugins/types.js";

type LobsterEnvelope =
  | {
      ok: true;
      status: "ok" | "needs_approval" | "cancelled";
      output: unknown[];
      requiresApproval: null | {
        type: "approval_request";
        prompt: string;
        items: unknown[];
        resumeToken?: string;
      };
    }
  | {
      ok: false;
      error: { type?: string; message: string };
    };

function resolveExecutablePath(lobsterPathRaw: string | undefined) {
  const lobsterPath = lobsterPathRaw?.trim() || "lobster";

  // SECURITY:
  // Never allow arbitrary executables (e.g. /bin/bash). If the caller overrides
  // the path, it must still be the lobster binary (by name) and be absolute.
  if (lobsterPath !== "lobster") {
    if (!path.isAbsolute(lobsterPath)) {
      throw new Error("lobsterPath must be an absolute path (or omit to use PATH)");
    }
    const base = path.basename(lobsterPath).toLowerCase();
    const allowed =
      process.platform === "win32" ? ["lobster.exe", "lobster.cmd", "lobster.bat"] : ["lobster"];
    if (!allowed.includes(base)) {
      throw new Error("lobsterPath must point to the lobster executable");
    }
    let stat: fs.Stats;
    try {
      stat = fs.statSync(lobsterPath);
    } catch {
      throw new Error("lobsterPath must exist");
    }
    if (!stat.isFile()) {
      throw new Error("lobsterPath must point to a file");
    }
    if (process.platform !== "win32") {
      try {
        fs.accessSync(lobsterPath, fs.constants.X_OK);
      } catch {
        throw new Error("lobsterPath must be executable");
      }
    }
  }

  return lobsterPath;
}

function normalizeForCwdSandbox(p: string): string {
  const normalized = path.normalize(p);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function resolveCwd(cwdRaw: unknown): string {
  if (typeof cwdRaw !== "string" || !cwdRaw.trim()) {
    return process.cwd();
  }
  const cwd = cwdRaw.trim();
  if (path.isAbsolute(cwd)) {
    throw new Error("cwd must be a relative path");
  }
  const base = process.cwd();
  const resolved = path.resolve(base, cwd);

  const rel = path.relative(normalizeForCwdSandbox(base), normalizeForCwdSandbox(resolved));
  if (rel === "" || rel === ".") {
    return resolved;
  }
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("cwd must stay within the gateway working directory");
  }
  return resolved;
}

function isWindowsSpawnErrorThatCanUseShell(err: unknown) {
  if (!err || typeof err !== "object") {
    return false;
  }
  const code = (err as { code?: unknown }).code;

  // On Windows, spawning scripts discovered on PATH (e.g. lobster.cmd) can fail
  // with EINVAL, and PATH discovery itself can fail with ENOENT when the binary
  // is only available via PATHEXT/script wrappers.
  return code === "EINVAL" || code === "ENOENT";
}

async function runLobsterSubprocessOnce(
  params: {
    execPath: string;
    argv: string[];
    cwd: string;
    timeoutMs: number;
    maxStdoutBytes: number;
  },
  useShell: boolean,
) {
  const { execPath, argv, cwd } = params;
  const timeoutMs = Math.max(200, params.timeoutMs);
  const maxStdoutBytes = Math.max(1024, params.maxStdoutBytes);

  const env = { ...process.env, LOBSTER_MODE: "tool" } as Record<string, string | undefined>;
  const nodeOptions = env.NODE_OPTIONS ?? "";
  if (nodeOptions.includes("--inspect")) {
    delete env.NODE_OPTIONS;
  }

  return await new Promise<{ stdout: string }>((resolve, reject) => {
    const child = spawn(execPath, argv, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env,
      shell: useShell,
      windowsHide: useShell ? true : undefined,
    });

    let stdout = "";
    let stdoutBytes = 0;
    let stderr = "";
    let settled = false;

    const settleReject = (err: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(err);
    };

    const settleResolve = (value: { stdout: string }) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");

    child.stdout?.on("data", (chunk) => {
      const str = String(chunk);
      stdoutBytes += Buffer.byteLength(str, "utf8");
      if (stdoutBytes > maxStdoutBytes) {
        try {
          child.kill("SIGKILL");
        } finally {
          settleReject(new Error("lobster output exceeded maxStdoutBytes"));
        }
        return;
      }
      stdout += str;
    });

    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });

    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } finally {
        settleReject(new Error("lobster subprocess timed out"));
      }
    }, timeoutMs);

    child.once("error", (err) => {
      clearTimeout(timer);
      settleReject(err);
    });

    child.once("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        settleReject(
          new Error(`lobster failed (${code ?? "?"}): ${stderr.trim() || stdout.trim()}`),
        );
        return;
      }
      settleResolve({ stdout: stdout || stderr });
    });
  });
}

async function runLobsterSubprocess(params: {
  execPath: string;
  argv: string[];
  cwd: string;
  timeoutMs: number;
  maxStdoutBytes: number;
}) {
  try {
    return await runLobsterSubprocessOnce(params, false);
  } catch (err) {
    if (process.platform === "win32" && isWindowsSpawnErrorThatCanUseShell(err)) {
      return await runLobsterSubprocessOnce(params, true);
    }
    throw err;
  }
}

function parseEnvelope(stdout: string): LobsterEnvelope {
  const trimmed = stdout.trim();

  const tryParse = (input: string) => {
    try {
      return JSON.parse(input) as unknown;
    } catch {
      return undefined;
    }
  };

  const extractJsonCandidates = (input: string): string[] => {
    const candidates: string[] = [];
    let start = -1;
    const stack: string[] = [];
    let inString = false;
    let escaping = false;

    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];

      if (inString) {
        if (escaping) {
          escaping = false;
          continue;
        }
        if (ch === "\\") {
          escaping = true;
          continue;
        }
        if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (stack.length === 0 && (ch === "{" || ch === "[")) {
        start = i;
      }

      if (ch === "{" || ch === "[") {
        stack.push(ch);
        continue;
      }

      if (ch !== "}" && ch !== "]") {
        continue;
      }

      const open = stack.pop();
      if (!open) {
        continue;
      }

      const isValidPair = (open === "{" && ch === "}") || (open === "[" && ch === "]");
      if (!isValidPair) {
        stack.length = 0;
        start = -1;
        continue;
      }

      if (stack.length === 0 && start >= 0) {
        candidates.push(input.slice(start, i + 1));
        start = -1;
      }
    }

    return candidates;
  };

  let parsed: unknown = tryParse(trimmed);
  if (parsed === undefined) {
    const candidates = extractJsonCandidates(trimmed);
    for (let i = candidates.length - 1; i >= 0; i -= 1) {
      parsed = tryParse(candidates[i]);
      if (parsed !== undefined) {
        break;
      }
    }
  }

  if (parsed === undefined) {
    throw new Error("lobster returned invalid JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("lobster returned invalid JSON envelope");
  }

  const ok = (parsed as { ok?: unknown }).ok;
  if (ok === true || ok === false) {
    return parsed as LobsterEnvelope;
  }

  throw new Error("lobster returned invalid JSON envelope");
}

export function createLobsterTool(api: OpenClawPluginApi) {
  return {
    name: "lobster",
    label: "Lobster Workflow",
    description:
      "Run Lobster pipelines as a local-first workflow runtime (typed JSON envelope + resumable approvals).",
    parameters: Type.Object({
      // NOTE: Prefer string enums in tool schemas; some providers reject unions/anyOf.
      action: Type.Unsafe<"run" | "resume">({ type: "string", enum: ["run", "resume"] }),
      pipeline: Type.Optional(Type.String()),
      argsJson: Type.Optional(Type.String()),
      token: Type.Optional(Type.String()),
      approve: Type.Optional(Type.Boolean()),
      // SECURITY: Do not allow the agent to choose an executable path.
      // Host can configure the lobster binary via plugin config.
      lobsterPath: Type.Optional(
        Type.String({ description: "(deprecated) Use plugin config instead." }),
      ),
      cwd: Type.Optional(
        Type.String({
          description:
            "Relative working directory (optional). Must stay within the gateway working directory.",
        }),
      ),
      timeoutMs: Type.Optional(Type.Number()),
      maxStdoutBytes: Type.Optional(Type.Number()),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const action = typeof params.action === "string" ? params.action.trim() : "";
      if (!action) {
        throw new Error("action required");
      }

      // SECURITY: never allow tool callers (agent/user) to select executables.
      // If a host needs to override the binary, it must do so via plugin config.
      // We still validate the parameter shape to prevent reintroducing an RCE footgun.
      if (typeof params.lobsterPath === "string" && params.lobsterPath.trim()) {
        resolveExecutablePath(params.lobsterPath);
      }

      const execPath = resolveExecutablePath(
        typeof api.pluginConfig?.lobsterPath === "string"
          ? api.pluginConfig.lobsterPath
          : undefined,
      );
      const cwd = resolveCwd(params.cwd);
      const timeoutMs = typeof params.timeoutMs === "number" ? params.timeoutMs : 20_000;
      const maxStdoutBytes =
        typeof params.maxStdoutBytes === "number" ? params.maxStdoutBytes : 512_000;

      const argv = (() => {
        if (action === "run") {
          const pipeline = typeof params.pipeline === "string" ? params.pipeline : "";
          if (!pipeline.trim()) {
            throw new Error("pipeline required");
          }
          const argv = ["run", "--mode", "tool", pipeline];
          const argsJson = typeof params.argsJson === "string" ? params.argsJson : "";
          if (argsJson.trim()) {
            argv.push("--args-json", argsJson);
          }
          return argv;
        }
        if (action === "resume") {
          const token = typeof params.token === "string" ? params.token : "";
          if (!token.trim()) {
            throw new Error("token required");
          }
          const approve = params.approve;
          if (typeof approve !== "boolean") {
            throw new Error("approve required");
          }
          return ["resume", "--token", token, "--approve", approve ? "yes" : "no"];
        }
        throw new Error(`Unknown action: ${action}`);
      })();

      if (api.runtime?.version && api.logger?.debug) {
        api.logger.debug(`lobster plugin runtime=${api.runtime.version}`);
      }

      const { stdout } = await runLobsterSubprocess({
        execPath,
        argv,
        cwd,
        timeoutMs,
        maxStdoutBytes,
      });

      const envelope = parseEnvelope(stdout);

      return {
        content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }],
        details: envelope,
      };
    },
  };
}
