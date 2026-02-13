import { describe, expect, it, vi } from "vitest";
import {
  buildEnvDumpCommand,
  loadShellEnvFallback,
  resolveShellEnvFallbackTimeoutMs,
  shouldEnableShellEnvFallback,
} from "./shell-env.js";

describe("shell env fallback", () => {
  it("is disabled by default", () => {
    expect(shouldEnableShellEnvFallback({} as NodeJS.ProcessEnv)).toBe(false);
    expect(shouldEnableShellEnvFallback({ OPENCLAW_LOAD_SHELL_ENV: "0" })).toBe(false);
    expect(shouldEnableShellEnvFallback({ OPENCLAW_LOAD_SHELL_ENV: "1" })).toBe(true);
  });

  it("resolves timeout from env with default fallback", () => {
    expect(resolveShellEnvFallbackTimeoutMs({} as NodeJS.ProcessEnv)).toBe(15000);
    expect(resolveShellEnvFallbackTimeoutMs({ OPENCLAW_SHELL_ENV_TIMEOUT_MS: "42" })).toBe(42);
    expect(
      resolveShellEnvFallbackTimeoutMs({
        OPENCLAW_SHELL_ENV_TIMEOUT_MS: "nope",
      }),
    ).toBe(15000);
  });

  it("skips when already has an expected key", () => {
    const env: NodeJS.ProcessEnv = { OPENAI_API_KEY: "set" };
    const exec = vi.fn(() => Buffer.from(""));

    const res = loadShellEnvFallback({
      enabled: true,
      env,
      expectedKeys: ["OPENAI_API_KEY", "DISCORD_BOT_TOKEN"],
      exec: exec as unknown as Parameters<typeof loadShellEnvFallback>[0]["exec"],
    });

    expect(res.ok).toBe(true);
    expect(res.applied).toEqual([]);
    expect(res.ok && res.skippedReason).toBe("already-has-keys");
    expect(exec).not.toHaveBeenCalled();
  });

  it("imports expected keys without overriding existing env", () => {
    const env: NodeJS.ProcessEnv = {};
    const exec = vi.fn(() => Buffer.from("OPENAI_API_KEY=from-shell\0DISCORD_BOT_TOKEN=discord\0"));

    const res1 = loadShellEnvFallback({
      enabled: true,
      env,
      expectedKeys: ["OPENAI_API_KEY", "DISCORD_BOT_TOKEN"],
      exec: exec as unknown as Parameters<typeof loadShellEnvFallback>[0]["exec"],
    });

    expect(res1.ok).toBe(true);
    expect(env.OPENAI_API_KEY).toBe("from-shell");
    expect(env.DISCORD_BOT_TOKEN).toBe("discord");
    expect(exec).toHaveBeenCalledTimes(1);

    env.OPENAI_API_KEY = "from-parent";
    const exec2 = vi.fn(() =>
      Buffer.from("OPENAI_API_KEY=from-shell\0DISCORD_BOT_TOKEN=discord2\0"),
    );
    const res2 = loadShellEnvFallback({
      enabled: true,
      env,
      expectedKeys: ["OPENAI_API_KEY", "DISCORD_BOT_TOKEN"],
      exec: exec2 as unknown as Parameters<typeof loadShellEnvFallback>[0]["exec"],
    });

    expect(res2.ok).toBe(true);
    expect(env.OPENAI_API_KEY).toBe("from-parent");
    expect(env.DISCORD_BOT_TOKEN).toBe("discord");
    expect(exec2).not.toHaveBeenCalled();
  });
});

describe("buildEnvDumpCommand", () => {
  it("returns zshrc-sourcing command for zsh", () => {
    const cmd = buildEnvDumpCommand("/bin/zsh");
    expect(cmd).toBe('{ . "$HOME/.zshrc"; } >/dev/null 2>&1 || true; env -0');
  });

  it("returns bashrc-sourcing command for bash", () => {
    const cmd = buildEnvDumpCommand("/bin/bash");
    expect(cmd).toBe('{ . "$HOME/.bashrc"; } >/dev/null 2>&1 || true; env -0');
  });

  it("returns plain env -0 for fish (auto-sources config)", () => {
    const cmd = buildEnvDumpCommand("/usr/bin/fish");
    expect(cmd).toBe("env -0");
  });

  it("returns both RC files for unknown shells", () => {
    const cmd = buildEnvDumpCommand("/bin/sh");
    expect(cmd).toBe(
      'for f in "$HOME/.bashrc" "$HOME/.zshrc"; do [ -f "$f" ] && . "$f" >/dev/null 2>&1 || true; done; env -0',
    );
  });

  it("handles full paths with nested directories", () => {
    expect(buildEnvDumpCommand("/usr/local/bin/zsh")).toBe(
      '{ . "$HOME/.zshrc"; } >/dev/null 2>&1 || true; env -0',
    );
    expect(buildEnvDumpCommand("/opt/homebrew/bin/bash")).toBe(
      '{ . "$HOME/.bashrc"; } >/dev/null 2>&1 || true; env -0',
    );
  });
});

describe("loadShellEnvFallback sources RC files", () => {
  it("passes zshrc-sourcing command to exec for zsh shell", () => {
    const env: NodeJS.ProcessEnv = { SHELL: "/bin/zsh" };
    const exec = vi.fn(() => Buffer.from("MY_KEY=val\0"));

    loadShellEnvFallback({
      enabled: true,
      env,
      expectedKeys: ["MY_KEY"],
      exec: exec as unknown as Parameters<typeof loadShellEnvFallback>[0]["exec"],
    });

    expect(exec).toHaveBeenCalledTimes(1);
    const args = exec.mock.calls[0];
    expect(args[0]).toBe("/bin/zsh");
    expect(args[1]).toEqual(["-l", "-c", '{ . "$HOME/.zshrc"; } >/dev/null 2>&1 || true; env -0']);
  });

  it("passes bashrc-sourcing command to exec for bash shell", () => {
    const env: NodeJS.ProcessEnv = { SHELL: "/bin/bash" };
    const exec = vi.fn(() => Buffer.from("MY_KEY=val\0"));

    loadShellEnvFallback({
      enabled: true,
      env,
      expectedKeys: ["MY_KEY"],
      exec: exec as unknown as Parameters<typeof loadShellEnvFallback>[0]["exec"],
    });

    expect(exec).toHaveBeenCalledTimes(1);
    const args = exec.mock.calls[0];
    expect(args[0]).toBe("/bin/bash");
    expect(args[1]).toEqual(["-l", "-c", '{ . "$HOME/.bashrc"; } >/dev/null 2>&1 || true; env -0']);
  });
});
