/**
 * PersonaPlex S2S (Speech-to-Speech) integration.
 *
 * NVIDIA PersonaPlex-7B-v1 provides end-to-end speech processing
 * without intermediate text conversion.
 *
 * This module is EXPERIMENTAL and requires:
 * - GPU with MPS support (Apple Silicon) or CUDA
 * - ~16GB memory
 * - HuggingFace token with model access
 *
 * Feature flag: config.voice.personaplex.enabled
 */

import { execFile, spawn, type ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import http from "node:http";
import https from "node:https";
import { tmpdir } from "node:os";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type { PersonaPlexConfig } from "../config/types.voice.js";
import { prepareAudioForWhisper } from "./local-stt.js";

const DEFAULT_INSTALL_PATH = path.join(process.env.HOME ?? "/tmp", ".openclaw", "personaplex");
const DEFAULT_PORT = 8765;
const DEFAULT_TIMEOUT_MS = 300_000;
const DEFAULT_VOICE_PROMPT = "NATF2.pt";
const DEFAULT_SEED = 42_424_242;
const DEFAULT_CPU_OFFLOAD_THRESHOLD_GB = 40;

const execFileAsync = promisify(execFile);

export type PersonaPlexResult = {
  success: boolean;
  audioPath?: string;
  audioBuffer?: Buffer;
  error?: string;
  latencyMs?: number;
};

export type ResolvedPersonaPlexConfig = Required<PersonaPlexConfig>;

export type PersonaPlexDependencies = {
  opus: boolean;
  moshi: boolean;
  accelerate: boolean;
};

let serverProcess: ChildProcess | null = null;
let serverSslDir: string | null = null;

export function resolvePersonaPlexConfig(config?: PersonaPlexConfig): ResolvedPersonaPlexConfig {
  const totalMemGb = os.totalmem() / 1024 ** 3;
  const defaultCpuOffload =
    process.platform === "darwin" && totalMemGb < DEFAULT_CPU_OFFLOAD_THRESHOLD_GB;

  const defaultDevice = (() => {
    if (config?.device?.trim()) return config.device.trim();
    if (config?.useGpu === false) return "cpu";
    if (process.platform === "darwin") return "mps";
    return "cuda";
  })();

  return {
    enabled: config?.enabled ?? false,
    installPath: config?.installPath?.trim() || DEFAULT_INSTALL_PATH,
    port: config?.port ?? DEFAULT_PORT,
    useSsl: config?.useSsl ?? true,

    useLocalAssets: config?.useLocalAssets ?? true,

    hfToken: config?.hfToken ?? "",
    useGpu: config?.useGpu ?? true,
    device: defaultDevice,

    dtype: config?.dtype ?? (process.platform === "darwin" ? "fp16" : "bf16"),
    context: config?.context ?? 1024,

    cpuOffload: config?.cpuOffload ?? defaultCpuOffload,
    singleMimi: config?.singleMimi ?? false,

    timeoutMs: config?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    autoStart: config?.autoStart ?? false,
    voicePrompt: config?.voicePrompt?.trim() || "",
    textPrompt: config?.textPrompt?.trim() || "",
    seed: config?.seed ?? DEFAULT_SEED,
  };
}

/**
 * Check if PersonaPlex is installed.
 * Looks for the moshi library and model weights in the install path.
 */
export function isPersonaPlexInstalled(config: ResolvedPersonaPlexConfig): boolean {
  const moshiPath = path.join(config.installPath, "moshi");
  const moshiProject = path.join(moshiPath, "pyproject.toml");
  const venvPython = resolveVenvPython(config);

  // Model weights are downloaded on first run, so only check repo + venv.
  return (
    existsSync(moshiPath) &&
    (existsSync(moshiProject) || existsSync(path.join(moshiPath, "setup.py"))) &&
    existsSync(venvPython)
  );
}

function resolveVenvPython(config: ResolvedPersonaPlexConfig): string {
  return path.join(config.installPath, ".venv", "bin", "python");
}

function isOpusInstalled(): boolean {
  const candidates = [
    "/opt/homebrew/lib/libopus.dylib",
    "/usr/local/lib/libopus.dylib",
    "/usr/lib/libopus.dylib",
    "/usr/lib/x86_64-linux-gnu/libopus.so",
    "/usr/lib/aarch64-linux-gnu/libopus.so",
    "/usr/lib64/libopus.so",
  ];
  return candidates.some((candidate) => existsSync(candidate));
}

async function checkPythonModule(pythonPath: string, moduleName: string): Promise<boolean> {
  if (!existsSync(pythonPath)) return false;
  try {
    await execFileAsync(pythonPath, ["-c", `import ${moduleName}`], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function checkPersonaPlexDependencies(
  config: ResolvedPersonaPlexConfig,
): Promise<PersonaPlexDependencies> {
  const pythonPath = resolveVenvPython(config);
  const [moshi, accelerate] = await Promise.all([
    checkPythonModule(pythonPath, "moshi"),
    checkPythonModule(pythonPath, "accelerate"),
  ]);
  return {
    opus: isOpusInstalled(),
    moshi,
    accelerate,
  };
}

function buildPersonaPlexUrl(config: ResolvedPersonaPlexConfig, pathSuffix: string): URL {
  const protocol = config.useSsl ? "https" : "http";
  return new URL(`${protocol}://localhost:${config.port}${pathSuffix}`);
}

async function requestJson<T>(
  url: URL,
  opts: { method: "GET" | "POST"; body?: string; timeoutMs: number },
): Promise<{ ok: boolean; status: number; data?: T }> {
  return new Promise((resolve, reject) => {
    const baseOptions = {
      method: opts.method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: opts.body
        ? {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(opts.body),
          }
        : undefined,
      timeout: opts.timeoutMs,
    };

    const request = (url.protocol === "https:" ? https : http).request(
      url.protocol === "https:" ? { ...baseOptions, rejectUnauthorized: false } : baseOptions,
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          if (!raw) {
            resolve({ ok: res.statusCode === 200, status: res.statusCode ?? 0 });
            return;
          }
          try {
            const parsed = JSON.parse(raw) as T;
            resolve({ ok: res.statusCode === 200, status: res.statusCode ?? 0, data: parsed });
          } catch (err) {
            reject(err);
          }
        });
      },
    );

    request.on("error", reject);
    request.on("timeout", () => {
      request.destroy(new Error("Request timed out"));
    });
    if (opts.body) {
      request.write(opts.body);
    }
    request.end();
  });
}

/**
 * Check if PersonaPlex server is running.
 */
export async function isPersonaPlexRunning(config: ResolvedPersonaPlexConfig): Promise<boolean> {
  try {
    // moshi.server does not expose a /health endpoint upstream.
    // We use GET / as a lightweight readiness probe.
    const url = buildPersonaPlexUrl(config, "/");
    const result = await requestJson(url, { method: "GET", timeoutMs: 2000 });
    return result.ok;
  } catch {
    return false;
  }
}

/**
 * Get HuggingFace token from environment or keychain.
 */
export async function getHfToken(config: ResolvedPersonaPlexConfig): Promise<string | null> {
  // First check config
  if (config.hfToken) {
    return config.hfToken;
  }

  // Then check environment
  const envToken = process.env.HF_TOKEN?.trim();
  if (envToken) {
    return envToken;
  }

  // Try macOS keychain
  try {
    const { execSync } = await import("node:child_process");
    const token = execSync(
      "security find-generic-password -s openclaw -a HF_TOKEN -w 2>/dev/null",
      { encoding: "utf-8" },
    ).trim();
    if (token) {
      return token;
    }
  } catch {
    // Keychain lookup failed
  }

  return null;
}

/**
 * Start the PersonaPlex server.
 */
export async function startPersonaPlexServer(
  config: ResolvedPersonaPlexConfig,
): Promise<{ success: boolean; error?: string }> {
  if (await isPersonaPlexRunning(config)) {
    return { success: true };
  }

  if (!isPersonaPlexInstalled(config)) {
    return { success: false, error: "PersonaPlex not installed" };
  }

  const deps = await checkPersonaPlexDependencies(config);
  if (!deps.opus) {
    return { success: false, error: "Opus codec not installed (libopus)" };
  }
  if (!deps.moshi) {
    return { success: false, error: "moshi package not installed in PersonaPlex venv" };
  }
  if (config.cpuOffload && !deps.accelerate) {
    return { success: false, error: "accelerate package required for cpuOffload" };
  }

  const hfToken = await getHfToken(config);
  if (!hfToken && !config.useLocalAssets) {
    return { success: false, error: "HuggingFace token not found" };
  }

  const venvPython = resolveVenvPython(config);
  if (!existsSync(venvPython)) {
    return { success: false, error: "PersonaPlex venv not found (missing .venv/bin/python)" };
  }

  // If the port is already bound (stale process), try to free it.
  // This avoids EADDRINUSE when OpenClaw restarts.
  try {
    const { stdout } = await execFileAsync("lsof", ["-ti", `tcp:${config.port}`], {
      timeout: 2000,
    });
    const pids = stdout
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const pidStr of pids) {
      const pid = Number(pidStr);
      if (!Number.isFinite(pid) || pid <= 1) continue;
      try {
        process.kill(pid);
      } catch {
        // ignore
      }
    }
  } catch {
    // lsof not available or no listeners
  }

  if (serverSslDir) {
    try {
      rmSync(serverSslDir, { recursive: true, force: true });
    } catch {
      // Ignore stale SSL dir cleanup
    }
    serverSslDir = null;
  }

  if (config.useSsl) {
    serverSslDir = mkdtempSync(path.join(tmpdir(), "openclaw-personaplex-ssl-"));
  }

  const args = ["-m", "moshi.server", "--port", String(config.port)];
  if (config.useSsl && serverSslDir) {
    args.push("--ssl", serverSslDir);
  }

  // Device selection (avoid upstream default of cuda)
  if (config.device) {
    args.push("--device", config.device);
  }

  // Local assets (avoid HF downloads)
  const modelDir = path.join(config.installPath, "models", "personaplex-7b-v1");
  const localMoshi = path.join(modelDir, "model.safetensors");
  const localMimi = path.join(modelDir, "tokenizer-e351c8d8-checkpoint125.safetensors");
  const localTokenizer = path.join(modelDir, "tokenizer_spm_32k_3.model");
  const localVoices = path.join(modelDir, "voices");
  const localStatic = path.join(modelDir, "dist");
  const hasLocalAssets =
    config.useLocalAssets &&
    existsSync(localMoshi) &&
    existsSync(localMimi) &&
    existsSync(localTokenizer) &&
    existsSync(localVoices) &&
    existsSync(localStatic);

  if (hasLocalAssets) {
    args.push(
      "--moshi-weight",
      localMoshi,
      "--mimi-weight",
      localMimi,
      "--tokenizer",
      localTokenizer,
      "--voice-prompt-dir",
      localVoices,
      "--static",
      localStatic,
    );
  }

  if (config.singleMimi) {
    args.push("--single-mimi");
  }

  if (config.cpuOffload) {
    args.push("--cpu-offload");
  }

  const env = {
    ...process.env,
    ...(hfToken ? { HF_TOKEN: hfToken } : {}),

    // Mac profile controls (these are consumed by our patched moshi loader)
    MOSHI_DTYPE: config.dtype,
    MOSHI_CONTEXT: String(config.context),

    // Avoid accidental network pulls if local assets are present
    ...(hasLocalAssets
      ? {
          HF_HUB_OFFLINE: "1",
          TRANSFORMERS_OFFLINE: "1",
          HF_DATASETS_OFFLINE: "1",
        }
      : {}),
  };

  serverProcess = spawn(venvPython, args, {
    cwd: config.installPath,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });

  // Wait for server to be ready
  const maxWait = Math.max(60_000, config.timeoutMs);
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    if (await isPersonaPlexRunning(config)) {
      return { success: true };
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Timeout - kill server
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (serverSslDir) {
    try {
      rmSync(serverSslDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
    serverSslDir = null;
  }

  return { success: false, error: "Server startup timed out" };
}

/**
 * Stop the PersonaPlex server.
 */
export function stopPersonaPlexServer(): void {
  if (serverProcess) {
    try {
      // When spawned with detached:true, kill the whole process group.
      if (serverProcess.pid) {
        try {
          process.kill(-serverProcess.pid);
        } catch {
          serverProcess.kill();
        }
      } else {
        serverProcess.kill();
      }
    } catch {
      // Ignore
    }
    serverProcess = null;
  }
  if (serverSslDir) {
    try {
      rmSync(serverSslDir, { recursive: true, force: true });
    } catch {
      // Ignore SSL cleanup errors
    }
    serverSslDir = null;
  }
}

async function processWithPersonaPlexOffline(
  audioBuffer: Buffer,
  config: ResolvedPersonaPlexConfig,
): Promise<PersonaPlexResult> {
  const startTime = Date.now();
  const venvPython = resolveVenvPython(config);
  if (!existsSync(venvPython)) {
    return { success: false, error: "PersonaPlex venv not found (missing .venv/bin/python)" };
  }

  const deps = await checkPersonaPlexDependencies(config);
  if (!deps.opus) {
    return { success: false, error: "Opus codec not installed (libopus)" };
  }
  if (!deps.moshi) {
    return { success: false, error: "moshi package not installed in PersonaPlex venv" };
  }
  if (config.cpuOffload && !deps.accelerate) {
    return { success: false, error: "accelerate package required for cpuOffload" };
  }

  const hfToken = await getHfToken(config);
  if (!hfToken && !config.useLocalAssets) {
    return { success: false, error: "HuggingFace token not found" };
  }

  const tempDir = path.join(tmpdir(), "openclaw-personaplex");
  mkdirSync(tempDir, { recursive: true });
  const timestamp = Date.now();
  const inputPath = path.join(tempDir, `s2s-in-${timestamp}.wav`);
  const outputPath = path.join(tempDir, `s2s-out-${timestamp}.wav`);
  const outputText = path.join(tempDir, `s2s-out-${timestamp}.json`);

  try {
    const prepared = await prepareAudioForWhisper(audioBuffer);
    if (!prepared.success || !prepared.wav) {
      return {
        success: false,
        error: prepared.error ?? "Audio preparation failed",
        latencyMs: Date.now() - startTime,
      };
    }

    writeFileSync(inputPath, prepared.wav);

    const voicePrompt = config.voicePrompt?.trim() || DEFAULT_VOICE_PROMPT;

    const args = [
      "-m",
      "moshi.offline",
      "--voice-prompt",
      voicePrompt,
      "--input-wav",
      inputPath,
      "--seed",
      String(config.seed),
      "--output-wav",
      outputPath,
      "--output-text",
      outputText,
    ];

    // Device selection (avoid upstream default of cuda)
    if (config.device) {
      args.push("--device", config.device);
    }

    // Prefer local assets for offline as well
    const modelDir = path.join(config.installPath, "models", "personaplex-7b-v1");
    const localMoshi = path.join(modelDir, "model.safetensors");
    const localMimi = path.join(modelDir, "tokenizer-e351c8d8-checkpoint125.safetensors");
    const localTokenizer = path.join(modelDir, "tokenizer_spm_32k_3.model");
    const localVoices = path.join(modelDir, "voices");
    const hasLocalAssets =
      config.useLocalAssets &&
      existsSync(localMoshi) &&
      existsSync(localMimi) &&
      existsSync(localTokenizer) &&
      existsSync(localVoices);

    if (hasLocalAssets) {
      args.push(
        "--moshi-weight",
        localMoshi,
        "--mimi-weight",
        localMimi,
        "--tokenizer",
        localTokenizer,
        "--voice-prompt-dir",
        localVoices,
      );
    }

    if (config.textPrompt) {
      args.push("--text-prompt", config.textPrompt);
    }
    if (config.cpuOffload) {
      args.push("--cpu-offload");
    }

    const env = {
      ...process.env,
      ...(hfToken ? { HF_TOKEN: hfToken } : {}),
      MOSHI_DTYPE: config.dtype,
      MOSHI_CONTEXT: String(config.context),
      ...(hasLocalAssets
        ? {
            HF_HUB_OFFLINE: "1",
            TRANSFORMERS_OFFLINE: "1",
            HF_DATASETS_OFFLINE: "1",
          }
        : {}),
    };

    await execFileAsync(venvPython, args, {
      cwd: config.installPath,
      env,
      timeout: config.timeoutMs,
    });

    const outputBuffer = readFileSync(outputPath);
    return {
      success: true,
      audioPath: outputPath,
      audioBuffer: outputBuffer,
      latencyMs: Date.now() - startTime,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
      latencyMs: Date.now() - startTime,
    };
  } finally {
    try {
      unlinkSync(inputPath);
    } catch {
      // Ignore cleanup errors
    }
    try {
      unlinkSync(outputText);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Process audio through PersonaPlex S2S.
 */
export async function processWithPersonaPlex(
  audioBuffer: Buffer,
  config: ResolvedPersonaPlexConfig,
): Promise<PersonaPlexResult> {
  // Programmatic S2S requests use moshi.offline so we can honor persona prompts.
  // The moshi.server path remains available for interactive sessions.
  return processWithPersonaPlexOffline(audioBuffer, config);
}

/**
 * Get PersonaPlex status.
 */
export async function getPersonaPlexStatus(config: ResolvedPersonaPlexConfig): Promise<{
  installed: boolean;
  running: boolean;
  device?: string;
  hasToken: boolean;
}> {
  const installed = isPersonaPlexInstalled(config);
  const running = await isPersonaPlexRunning(config);
  const hasToken = (await getHfToken(config)) !== null || config.useLocalAssets;

  // moshi.server does not expose a structured health payload upstream.
  // If running, report the configured device.
  const device = running ? config.device : undefined;

  return { installed, running, device, hasToken };
}
