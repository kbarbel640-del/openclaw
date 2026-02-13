/**
 * Message Hooks for OpenClaw
 *
 * Enables pre-message and post-message hooks that run external commands
 * before/after agent processing. Useful for memory systems, logging,
 * context injection, and integrations.
 *
 * SECURITY NOTES:
 * - Commands are executed via shell with the same privileges as OpenClaw
 * - Only configure hooks you trust completely
 * - Hook stdout (when inject=true) is inserted into the AI's system prompt
 * - User message content is passed via environment variables - do not log/expose
 * - Consider using allowedCommands to restrict which commands can run
 *
 * @example Config:
 * ```yaml
 * messageHooks:
 *   enabled: true
 *   maxHooks: 5           # Limit total hooks (default: 10)
 *   aggregateTimeoutMs: 10000  # Total time budget (default: 15000)
 *   preMessage:
 *     - command: "python3 /path/to/recall.py"
 *       timeout: 5000
 *       inject: true
 *   postMessage:
 *     - command: "python3 /path/to/capture.py"
 *       passContext: true
 * ```
 */

import { spawn } from "node:child_process";
import type { FinalizedMsgContext } from "./templating.js";

// ============================================================================
// Constants & Limits
// ============================================================================

/** Default timeout per hook (ms) */
const DEFAULT_TIMEOUT_MS = 5000;

/** Maximum timeout per hook (ms) */
const MAX_TIMEOUT_MS = 30000;

/** Default aggregate timeout for all hooks (ms) */
const DEFAULT_AGGREGATE_TIMEOUT_MS = 15000;

/** Maximum aggregate timeout (ms) */
const MAX_AGGREGATE_TIMEOUT_MS = 60000;

/** Maximum stdout to capture (bytes) - protects against memory exhaustion */
const MAX_STDOUT_BYTES = 64 * 1024; // 64KB

/** Maximum stderr to capture (bytes) - protects against memory exhaustion */
const MAX_STDERR_BYTES = 16 * 1024; // 16KB

/** Maximum number of hooks allowed */
const MAX_HOOKS = 10;

/** Default max hooks if not specified */
const DEFAULT_MAX_HOOKS = 10;

// ============================================================================
// Types
// ============================================================================

export type MessageHookConfig = {
  /** Shell command to execute. SECURITY: Only use trusted commands. */
  command: string;
  /** Timeout in milliseconds (default: 5000, max: 30000) */
  timeout?: number;
  /** For preMessage: inject stdout into system prompt. SECURITY: Output becomes AI context. */
  inject?: boolean;
  /** Pass message context as JSON via stdin */
  passContext?: boolean;
  /** Additional environment variables (merged with OPENCLAW_* vars) */
  env?: Record<string, string>;
  /** Only run for specific session key prefixes (case-insensitive) */
  sessionKeyPrefixes?: string[];
  /** Only run for specific channels (case-insensitive) */
  channels?: string[];
};

export type MessageHooksConfig = {
  /** Enable message hooks */
  enabled?: boolean;
  /** Maximum number of hooks to run (default: 10) */
  maxHooks?: number;
  /** Aggregate timeout for all hooks in ms (default: 15000) */
  aggregateTimeoutMs?: number;
  /** Optional allowlist of command prefixes (security hardening) */
  allowedCommandPrefixes?: string[];
  /** Hooks to run before agent processing */
  preMessage?: MessageHookConfig[];
  /** Hooks to run after agent processing */
  postMessage?: MessageHookConfig[];
};

export type PreMessageHookResult = {
  injectedContent?: string;
  hookResults: HookExecutionResult[];
  truncated?: boolean;
  aggregateTimeoutHit?: boolean;
};

export type PostMessageHookResult = {
  hookResults: HookExecutionResult[];
  truncated?: boolean;
  aggregateTimeoutHit?: boolean;
};

export type HookExecutionResult = {
  command: string;
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
  durationMs: number;
  stdoutTruncated?: boolean;
  stderrTruncated?: boolean;
};

export type HookContext = {
  sessionKey: string;
  channel: string;
  senderId: string;
  senderName: string;
  messageText: string;
  messageId?: string;
  timestamp: number;
  isGroup: boolean;
  groupId?: string;
  groupName?: string;
};

export type PostHookContext = HookContext & {
  responseText?: string;
  responseId?: string;
};

// ============================================================================
// Security Helpers
// ============================================================================

/**
 * Check if command is allowed by prefix allowlist.
 * Returns true if no allowlist configured (permissive mode).
 */
function isCommandAllowed(command: string, allowedPrefixes: string[] | undefined): boolean {
  if (!allowedPrefixes || allowedPrefixes.length === 0) {
    return true; // No allowlist = all allowed
  }
  const trimmed = command.trim();
  return allowedPrefixes.some((prefix) => trimmed.startsWith(prefix.trim()));
}

/**
 * Sanitize timeout to safe bounds.
 */
function sanitizeTimeout(timeout: number | undefined): number {
  if (timeout === undefined) {
    return DEFAULT_TIMEOUT_MS;
  }
  if (timeout <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }
  if (timeout > MAX_TIMEOUT_MS) {
    return MAX_TIMEOUT_MS;
  }
  return Math.floor(timeout);
}

/**
 * Sanitize aggregate timeout to safe bounds.
 */
function sanitizeAggregateTimeout(timeout: number | undefined): number {
  if (timeout === undefined) {
    return DEFAULT_AGGREGATE_TIMEOUT_MS;
  }
  if (timeout <= 0) {
    return DEFAULT_AGGREGATE_TIMEOUT_MS;
  }
  if (timeout > MAX_AGGREGATE_TIMEOUT_MS) {
    return MAX_AGGREGATE_TIMEOUT_MS;
  }
  return Math.floor(timeout);
}

// ============================================================================
// Hook Execution
// ============================================================================

/**
 * Execute a single hook command with resource limits.
 */
async function executeHook(
  config: MessageHookConfig,
  context: HookContext | PostHookContext,
  options: { passContext: boolean; abortSignal?: AbortSignal },
): Promise<HookExecutionResult> {
  const startTime = Date.now();
  const timeout = sanitizeTimeout(config.timeout);

  // Check for pre-abort
  if (options.abortSignal?.aborted) {
    return {
      command: config.command,
      success: false,
      error: "Aborted before execution (aggregate timeout)",
      durationMs: 0,
    };
  }

  return new Promise((resolve) => {
    // Build environment - SECURITY: User content in env vars
    // Document that hook scripts should not log/expose these
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      ...config.env,
      // Namespaced env vars for hook scripts
      OPENCLAW_SESSION_KEY: context.sessionKey,
      OPENCLAW_CHANNEL: context.channel,
      OPENCLAW_SENDER_ID: context.senderId,
      OPENCLAW_SENDER_NAME: context.senderName,
      OPENCLAW_MESSAGE_TEXT: context.messageText,
      OPENCLAW_IS_GROUP: context.isGroup ? "1" : "0",
    };

    const proc = spawn("sh", ["-c", config.command], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Use arrays for efficient concatenation
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let killed = false;
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        if (abortHandler) {
          options.abortSignal?.removeEventListener("abort", abortHandler);
        }
      }
    };

    // Timeout handler
    const timer = setTimeout(() => {
      if (!resolved) {
        killed = true;
        proc.kill("SIGKILL");
      }
    }, timeout);

    // Aggregate abort handler
    const abortHandler = () => {
      if (!resolved) {
        killed = true;
        proc.kill("SIGKILL");
      }
    };
    options.abortSignal?.addEventListener("abort", abortHandler);

    // Capture stdout with limit
    proc.stdout?.on("data", (data: Buffer) => {
      if (stdoutBytes < MAX_STDOUT_BYTES) {
        const remaining = MAX_STDOUT_BYTES - stdoutBytes;
        if (data.length <= remaining) {
          stdoutChunks.push(data);
          stdoutBytes += data.length;
        } else {
          stdoutChunks.push(data.subarray(0, remaining));
          stdoutBytes = MAX_STDOUT_BYTES;
          stdoutTruncated = true;
        }
      } else {
        stdoutTruncated = true;
      }
    });

    // Capture stderr with limit
    proc.stderr?.on("data", (data: Buffer) => {
      if (stderrBytes < MAX_STDERR_BYTES) {
        const remaining = MAX_STDERR_BYTES - stderrBytes;
        if (data.length <= remaining) {
          stderrChunks.push(data);
          stderrBytes += data.length;
        } else {
          stderrChunks.push(data.subarray(0, remaining));
          stderrBytes = MAX_STDERR_BYTES;
          stderrTruncated = true;
        }
      } else {
        stderrTruncated = true;
      }
    });

    // Pass context via stdin if configured
    if (options.passContext || config.passContext) {
      try {
        proc.stdin?.write(JSON.stringify(context));
      } catch {
        // Ignore write errors (process may have exited)
      }
    }
    proc.stdin?.end();

    proc.on("close", (code) => {
      cleanup();
      const durationMs = Date.now() - startTime;
      const stdout = Buffer.concat(stdoutChunks).toString("utf-8").trim();
      const stderr = Buffer.concat(stderrChunks).toString("utf-8").trim();

      if (killed) {
        resolve({
          command: config.command,
          success: false,
          error: options.abortSignal?.aborted
            ? "Aborted (aggregate timeout)"
            : `Hook timed out after ${timeout}ms`,
          stdout: stdout || undefined,
          stderr: stderr || undefined,
          stdoutTruncated,
          stderrTruncated,
          durationMs,
        });
        return;
      }

      resolve({
        command: config.command,
        success: code === 0,
        stdout: stdout || undefined,
        stderr: stderr || undefined,
        error: code !== 0 ? `Exit code ${code}` : undefined,
        stdoutTruncated,
        stderrTruncated,
        durationMs,
      });
    });

    proc.on("error", (err) => {
      cleanup();
      resolve({
        command: config.command,
        success: false,
        error: String(err),
        durationMs: Date.now() - startTime,
      });
    });
  });
}

/**
 * Check if hook should run for this context (filtering).
 */
function shouldRunHook(config: MessageHookConfig, context: HookContext): boolean {
  // Check session key prefix filter
  if (config.sessionKeyPrefixes && config.sessionKeyPrefixes.length > 0) {
    const sessionKey = context.sessionKey.toLowerCase();
    const matches = config.sessionKeyPrefixes.some((prefix) =>
      sessionKey.startsWith(prefix.toLowerCase().trim()),
    );
    if (!matches) {
      return false;
    }
  }

  // Check channel filter
  if (config.channels && config.channels.length > 0) {
    const channel = context.channel.toLowerCase();
    const matches = config.channels.some((ch) => ch.toLowerCase().trim() === channel);
    if (!matches) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Run pre-message hooks before agent processing.
 *
 * SECURITY: Hook stdout (when inject=true) is inserted into the AI's system prompt.
 * Only configure hooks from trusted sources.
 *
 * @returns Injected content for system prompt and execution results
 */
export async function runPreMessageHooks(params: {
  config: MessageHooksConfig | undefined;
  ctx: FinalizedMsgContext;
}): Promise<PreMessageHookResult> {
  const { config, ctx } = params;

  if (!config?.enabled || !config.preMessage || config.preMessage.length === 0) {
    return { hookResults: [] };
  }

  const hookContext: HookContext = {
    sessionKey: ctx.SessionKey ?? "unknown",
    channel: ctx.Surface ?? ctx.Provider ?? "unknown",
    senderId: ctx.SenderId ?? ctx.From ?? "unknown",
    senderName: ctx.SenderName ?? "Unknown",
    messageText: ctx.RawBody ?? ctx.Body ?? "",
    messageId: ctx.MessageSid,
    timestamp: Date.now(),
    isGroup: Boolean(ctx.GroupSubject || ctx.ChatType === "group"),
    groupId: ctx.GroupChannel,
    groupName: ctx.GroupSubject,
  };

  // Apply limits
  const maxHooks = Math.min(config.maxHooks ?? DEFAULT_MAX_HOOKS, MAX_HOOKS);
  const aggregateTimeout = sanitizeAggregateTimeout(config.aggregateTimeoutMs);

  // Filter and limit hooks
  let hooksToRun = config.preMessage.filter((hookConfig) => {
    // Check context filters
    if (!shouldRunHook(hookConfig, hookContext)) {
      return false;
    }
    // Check command allowlist
    if (!isCommandAllowed(hookConfig.command, config.allowedCommandPrefixes)) {
      return false;
    }
    return true;
  });

  const truncated = hooksToRun.length > maxHooks;
  if (truncated) {
    hooksToRun = hooksToRun.slice(0, maxHooks);
  }

  if (hooksToRun.length === 0) {
    return { hookResults: [], truncated };
  }

  // Create aggregate abort controller
  const abortController = new AbortController();
  const aggregateTimer = setTimeout(() => {
    abortController.abort();
  }, aggregateTimeout);

  const hookResults: HookExecutionResult[] = [];
  const injectedParts: string[] = [];

  try {
    // Run hooks in parallel with abort signal
    const promises = hooksToRun.map(async (hookConfig) => {
      const result = await executeHook(hookConfig, hookContext, {
        passContext: false,
        abortSignal: abortController.signal,
      });
      hookResults.push(result);

      if (hookConfig.inject && result.success && result.stdout) {
        injectedParts.push(result.stdout);
      }
    });

    await Promise.all(promises);
  } finally {
    clearTimeout(aggregateTimer);
  }

  return {
    injectedContent: injectedParts.length > 0 ? injectedParts.join("\n\n") : undefined,
    hookResults,
    truncated,
    aggregateTimeoutHit: abortController.signal.aborted,
  };
}

/**
 * Run post-message hooks after agent processing.
 *
 * SECURITY: Message content and response are passed to hooks.
 * Only configure hooks from trusted sources.
 *
 * @returns Execution results (hooks run fire-and-forget, don't block response)
 */
export async function runPostMessageHooks(params: {
  config: MessageHooksConfig | undefined;
  ctx: FinalizedMsgContext;
  responseText?: string;
  responseId?: string;
}): Promise<PostMessageHookResult> {
  const { config, ctx, responseText, responseId } = params;

  if (!config?.enabled || !config.postMessage || config.postMessage.length === 0) {
    return { hookResults: [] };
  }

  const hookContext: PostHookContext = {
    sessionKey: ctx.SessionKey ?? "unknown",
    channel: ctx.Surface ?? ctx.Provider ?? "unknown",
    senderId: ctx.SenderId ?? ctx.From ?? "unknown",
    senderName: ctx.SenderName ?? "Unknown",
    messageText: ctx.RawBody ?? ctx.Body ?? "",
    messageId: ctx.MessageSid,
    timestamp: Date.now(),
    isGroup: Boolean(ctx.GroupSubject || ctx.ChatType === "group"),
    groupId: ctx.GroupChannel,
    groupName: ctx.GroupSubject,
    responseText,
    responseId,
  };

  // Apply limits
  const maxHooks = Math.min(config.maxHooks ?? DEFAULT_MAX_HOOKS, MAX_HOOKS);
  const aggregateTimeout = sanitizeAggregateTimeout(config.aggregateTimeoutMs);

  // Filter and limit hooks
  let hooksToRun = config.postMessage.filter((hookConfig) => {
    if (!shouldRunHook(hookConfig, hookContext)) {
      return false;
    }
    if (!isCommandAllowed(hookConfig.command, config.allowedCommandPrefixes)) {
      return false;
    }
    return true;
  });

  const truncated = hooksToRun.length > maxHooks;
  if (truncated) {
    hooksToRun = hooksToRun.slice(0, maxHooks);
  }

  if (hooksToRun.length === 0) {
    return { hookResults: [], truncated };
  }

  // Create aggregate abort controller
  const abortController = new AbortController();
  const aggregateTimer = setTimeout(() => {
    abortController.abort();
  }, aggregateTimeout);

  const hookResults: HookExecutionResult[] = [];

  try {
    const promises = hooksToRun.map(async (hookConfig) => {
      const result = await executeHook(hookConfig, hookContext, {
        passContext: true,
        abortSignal: abortController.signal,
      });
      hookResults.push(result);
    });

    await Promise.all(promises);
  } finally {
    clearTimeout(aggregateTimer);
  }

  return {
    hookResults,
    truncated,
    aggregateTimeoutHit: abortController.signal.aborted,
  };
}

/**
 * Validate message hooks config structure.
 */
export function validateMessageHooksConfig(config: unknown): config is MessageHooksConfig {
  if (config === undefined || config === null) {
    return true;
  }
  if (typeof config !== "object" || Array.isArray(config)) {
    return false;
  }

  const cfg = config as Record<string, unknown>;

  // Validate boolean fields
  if (cfg.enabled !== undefined && typeof cfg.enabled !== "boolean") {
    return false;
  }

  // Validate numeric fields
  if (cfg.maxHooks !== undefined) {
    if (typeof cfg.maxHooks !== "number" || cfg.maxHooks < 1) {
      return false;
    }
  }
  if (cfg.aggregateTimeoutMs !== undefined) {
    if (typeof cfg.aggregateTimeoutMs !== "number" || cfg.aggregateTimeoutMs < 100) {
      return false;
    }
  }

  // Validate allowedCommandPrefixes
  if (cfg.allowedCommandPrefixes !== undefined) {
    if (!Array.isArray(cfg.allowedCommandPrefixes)) {
      return false;
    }
    if (!cfg.allowedCommandPrefixes.every((p) => typeof p === "string")) {
      return false;
    }
  }

  // Validate hook arrays
  const validateHookArray = (arr: unknown): boolean => {
    if (arr === undefined) {
      return true;
    }
    if (!Array.isArray(arr)) {
      return false;
    }
    return arr.every((item) => {
      if (typeof item !== "object" || item === null) {
        return false;
      }
      const hook = item as Record<string, unknown>;
      // command is required and must be non-empty string
      if (typeof hook.command !== "string" || !hook.command.trim()) {
        return false;
      }
      // timeout must be positive number if present
      if (hook.timeout !== undefined) {
        if (typeof hook.timeout !== "number" || hook.timeout <= 0) {
          return false;
        }
      }
      // boolean fields
      if (hook.inject !== undefined && typeof hook.inject !== "boolean") {
        return false;
      }
      if (hook.passContext !== undefined && typeof hook.passContext !== "boolean") {
        return false;
      }
      // env must be string->string record if present
      if (hook.env !== undefined) {
        if (typeof hook.env !== "object" || hook.env === null) {
          return false;
        }
        const env = hook.env as Record<string, unknown>;
        if (!Object.values(env).every((v) => typeof v === "string")) {
          return false;
        }
      }
      // array fields
      if (hook.sessionKeyPrefixes !== undefined) {
        if (!Array.isArray(hook.sessionKeyPrefixes)) {
          return false;
        }
        if (!hook.sessionKeyPrefixes.every((p) => typeof p === "string")) {
          return false;
        }
      }
      if (hook.channels !== undefined) {
        if (!Array.isArray(hook.channels)) {
          return false;
        }
        if (!hook.channels.every((c) => typeof c === "string")) {
          return false;
        }
      }
      return true;
    });
  };

  if (!validateHookArray(cfg.preMessage)) {
    return false;
  }
  if (!validateHookArray(cfg.postMessage)) {
    return false;
  }

  return true;
}
