import os from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { runExec } from "../process/exec.js";
import type { RuntimeEnv } from "../runtime.js";
import { ensureBinary } from "./binaries.js";
import {
  __testing,
  cancelScheduledGatewaySigusr1Restart,
  consumeGatewaySigusr1RestartAuthorization,
  emitGatewayRestart,
  isGatewaySigusr1RestartExternallyAllowed,
  markGatewaySigusr1RestartHandled,
  scheduleGatewaySigusr1Restart,
  setGatewaySigusr1RestartPolicy,
  setPreRestartDeferralCheck,
} from "./restart.js";
import { createTelegramRetryRunner } from "./retry-policy.js";
import { getShellPathFromLoginShell, resetShellPathCacheForTests } from "./shell-env.js";
import { listTailnetAddresses } from "./tailnet.js";

describe("infra runtime", () => {
  describe("ensureBinary", () => {
    it("passes through when binary exists", async () => {
      const exec: typeof runExec = vi.fn().mockResolvedValue({
        stdout: "",
        stderr: "",
      });
      const runtime: RuntimeEnv = {
        log: vi.fn(),
        error: vi.fn(),
        exit: vi.fn(),
      };
      await ensureBinary("node", exec, runtime);
      expect(exec).toHaveBeenCalledWith("which", ["node"]);
    });

    it("logs and exits when missing", async () => {
      const exec: typeof runExec = vi.fn().mockRejectedValue(new Error("missing"));
      const error = vi.fn();
      const exit = vi.fn(() => {
        throw new Error("exit");
      });
      await expect(ensureBinary("ghost", exec, { log: vi.fn(), error, exit })).rejects.toThrow(
        "exit",
      );
      expect(error).toHaveBeenCalledWith("Missing required binary: ghost. Please install it.");
      expect(exit).toHaveBeenCalledWith(1);
    });
  });

  describe("createTelegramRetryRunner", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("retries when custom shouldRetry matches non-telegram error", async () => {
      vi.useFakeTimers();
      const runner = createTelegramRetryRunner({
        retry: { attempts: 2, minDelayMs: 0, maxDelayMs: 0, jitter: 0 },
        shouldRetry: (err) => err instanceof Error && err.message === "boom",
      });
      const fn = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue("ok");

      const promise = runner(fn, "request");
      await vi.runAllTimersAsync();

      await expect(promise).resolves.toBe("ok");
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe("restart authorization", () => {
    beforeEach(() => {
      __testing.resetSigusr1State();
      vi.useFakeTimers();
      vi.spyOn(process, "kill").mockImplementation(() => true);
    });

    afterEach(async () => {
      await vi.runOnlyPendingTimersAsync();
      vi.useRealTimers();
      vi.restoreAllMocks();
      __testing.resetSigusr1State();
    });

    it("authorizes exactly once when scheduled restart emits", async () => {
      expect(consumeGatewaySigusr1RestartAuthorization()).toBe(false);

      scheduleGatewaySigusr1Restart({ delayMs: 0 });

      // No pre-authorization before the scheduled emission fires.
      expect(consumeGatewaySigusr1RestartAuthorization()).toBe(false);
      await vi.advanceTimersByTimeAsync(0);

      expect(consumeGatewaySigusr1RestartAuthorization()).toBe(true);
      expect(consumeGatewaySigusr1RestartAuthorization()).toBe(false);

      await vi.runAllTimersAsync();
    });

    it("tracks external restart policy", () => {
      expect(isGatewaySigusr1RestartExternallyAllowed()).toBe(false);
      setGatewaySigusr1RestartPolicy({ allowExternal: true });
      expect(isGatewaySigusr1RestartExternallyAllowed()).toBe(true);
    });

    it("suppresses duplicate emit until the restart cycle is marked handled", () => {
      const emitSpy = vi.spyOn(process, "emit");
      const handler = () => {};
      process.on("SIGUSR1", handler);
      try {
        expect(emitGatewayRestart()).toBe(true);
        expect(emitGatewayRestart()).toBe(false);
        expect(consumeGatewaySigusr1RestartAuthorization()).toBe(true);

        markGatewaySigusr1RestartHandled();

        expect(emitGatewayRestart()).toBe(true);
        const sigusr1Emits = emitSpy.mock.calls.filter((args) => args[0] === "SIGUSR1");
        expect(sigusr1Emits.length).toBe(2);
      } finally {
        process.removeListener("SIGUSR1", handler);
      }
    });
  });

  describe("scheduled restart cancellation", () => {
    beforeEach(() => {
      __testing.resetSigusr1State();
      vi.useFakeTimers();
      vi.spyOn(process, "kill").mockImplementation(() => true);
    });

    afterEach(async () => {
      await vi.runOnlyPendingTimersAsync();
      vi.useRealTimers();
      vi.restoreAllMocks();
      __testing.resetSigusr1State();
    });

    it("cancelScheduledGatewaySigusr1Restart prevents the scheduled SIGUSR1 from firing", async () => {
      const emitSpy = vi.spyOn(process, "emit");
      const handler = () => {};
      process.on("SIGUSR1", handler);
      try {
        scheduleGatewaySigusr1Restart({ delayMs: 2000 });

        // Cancel before it fires
        expect(cancelScheduledGatewaySigusr1Restart()).toBe(true);

        // Advance past the scheduled time
        await vi.advanceTimersByTimeAsync(3000);

        // SIGUSR1 should NOT have been emitted
        const sigusr1Emits = emitSpy.mock.calls.filter((args) => args[0] === "SIGUSR1");
        expect(sigusr1Emits.length).toBe(0);
      } finally {
        process.removeListener("SIGUSR1", handler);
      }
    });

    it("returns false when no restart is scheduled", () => {
      expect(cancelScheduledGatewaySigusr1Restart()).toBe(false);
    });

    it("skips scheduled SIGUSR1 when a restart was already consumed (config watcher race)", async () => {
      // Simulates the race: config.patch schedules a restart at 2s,
      // but the config watcher fires at 300ms and triggers a full restart first.
      const emitSpy = vi.spyOn(process, "emit");
      const handler = () => {};
      process.on("SIGUSR1", handler);
      try {
        // 1. config.patch schedules SIGUSR1 with 2s delay
        scheduleGatewaySigusr1Restart({ delayMs: 2000 });

        // 2. Config watcher fires earlier and emits a restart
        const emitted = emitGatewayRestart();
        expect(emitted).toBe(true);

        // 3. run-loop consumes the restart
        expect(consumeGatewaySigusr1RestartAuthorization()).toBe(true);
        markGatewaySigusr1RestartHandled();

        // 4. Scheduled timer fires at 2s — should see consumedRestartToken > tokenAtSchedule
        await vi.advanceTimersByTimeAsync(2000);

        // Only the config watcher's emit should have fired, not the scheduled one
        const sigusr1Emits = emitSpy.mock.calls.filter((args) => args[0] === "SIGUSR1");
        expect(sigusr1Emits.length).toBe(1);
      } finally {
        process.removeListener("SIGUSR1", handler);
      }
    });
  });

  describe("pre-restart deferral check", () => {
    beforeEach(() => {
      __testing.resetSigusr1State();
      vi.useFakeTimers();
      vi.spyOn(process, "kill").mockImplementation(() => true);
    });

    afterEach(async () => {
      await vi.runOnlyPendingTimersAsync();
      vi.useRealTimers();
      vi.restoreAllMocks();
      __testing.resetSigusr1State();
    });

    it("emits SIGUSR1 immediately when no deferral check is registered", async () => {
      const emitSpy = vi.spyOn(process, "emit");
      const handler = () => {};
      process.on("SIGUSR1", handler);
      try {
        scheduleGatewaySigusr1Restart({ delayMs: 0 });
        await vi.advanceTimersByTimeAsync(0);
        expect(emitSpy).toHaveBeenCalledWith("SIGUSR1");
      } finally {
        process.removeListener("SIGUSR1", handler);
      }
    });

    it("emits SIGUSR1 immediately when deferral check returns 0", async () => {
      const emitSpy = vi.spyOn(process, "emit");
      const handler = () => {};
      process.on("SIGUSR1", handler);
      try {
        setPreRestartDeferralCheck(() => 0);
        scheduleGatewaySigusr1Restart({ delayMs: 0 });
        await vi.advanceTimersByTimeAsync(0);
        expect(emitSpy).toHaveBeenCalledWith("SIGUSR1");
      } finally {
        process.removeListener("SIGUSR1", handler);
      }
    });

    it("defers SIGUSR1 until deferral check returns 0", async () => {
      const emitSpy = vi.spyOn(process, "emit");
      const handler = () => {};
      process.on("SIGUSR1", handler);
      try {
        let pending = 2;
        setPreRestartDeferralCheck(() => pending);
        scheduleGatewaySigusr1Restart({ delayMs: 0 });

        // After initial delay fires, deferral check returns 2 — should NOT emit yet
        await vi.advanceTimersByTimeAsync(0);
        expect(emitSpy).not.toHaveBeenCalledWith("SIGUSR1");

        // After one poll (500ms), still pending
        await vi.advanceTimersByTimeAsync(500);
        expect(emitSpy).not.toHaveBeenCalledWith("SIGUSR1");

        // Drain pending work
        pending = 0;
        await vi.advanceTimersByTimeAsync(500);
        expect(emitSpy).toHaveBeenCalledWith("SIGUSR1");
      } finally {
        process.removeListener("SIGUSR1", handler);
      }
    });

    it("emits SIGUSR1 after deferral timeout even if still pending", async () => {
      const emitSpy = vi.spyOn(process, "emit");
      const handler = () => {};
      process.on("SIGUSR1", handler);
      try {
        setPreRestartDeferralCheck(() => 5); // always pending
        scheduleGatewaySigusr1Restart({ delayMs: 0 });

        // Fire initial timeout
        await vi.advanceTimersByTimeAsync(0);
        expect(emitSpy).not.toHaveBeenCalledWith("SIGUSR1");

        // Advance past the 30s max deferral wait
        await vi.advanceTimersByTimeAsync(30_000);
        expect(emitSpy).toHaveBeenCalledWith("SIGUSR1");
      } finally {
        process.removeListener("SIGUSR1", handler);
      }
    });

    it("emits SIGUSR1 if deferral check throws", async () => {
      const emitSpy = vi.spyOn(process, "emit");
      const handler = () => {};
      process.on("SIGUSR1", handler);
      try {
        setPreRestartDeferralCheck(() => {
          throw new Error("boom");
        });
        scheduleGatewaySigusr1Restart({ delayMs: 0 });
        await vi.advanceTimersByTimeAsync(0);
        expect(emitSpy).toHaveBeenCalledWith("SIGUSR1");
      } finally {
        process.removeListener("SIGUSR1", handler);
      }
    });
  });

  describe("getShellPathFromLoginShell", () => {
    afterEach(() => resetShellPathCacheForTests());

    it("returns PATH from login shell env", () => {
      if (process.platform === "win32") {
        return;
      }
      const exec = vi
        .fn()
        .mockReturnValue(Buffer.from("PATH=/custom/bin\0HOME=/home/user\0", "utf-8"));
      const result = getShellPathFromLoginShell({ env: { SHELL: "/bin/sh" }, exec });
      expect(result).toBe("/custom/bin");
    });

    it("caches the value", () => {
      if (process.platform === "win32") {
        return;
      }
      const exec = vi.fn().mockReturnValue(Buffer.from("PATH=/custom/bin\0", "utf-8"));
      const env = { SHELL: "/bin/sh" } as NodeJS.ProcessEnv;
      expect(getShellPathFromLoginShell({ env, exec })).toBe("/custom/bin");
      expect(getShellPathFromLoginShell({ env, exec })).toBe("/custom/bin");
      expect(exec).toHaveBeenCalledTimes(1);
    });

    it("returns null on exec failure", () => {
      if (process.platform === "win32") {
        return;
      }
      const exec = vi.fn(() => {
        throw new Error("boom");
      });
      const result = getShellPathFromLoginShell({ env: { SHELL: "/bin/sh" }, exec });
      expect(result).toBeNull();
    });
  });

  describe("tailnet address detection", () => {
    it("detects tailscale IPv4 and IPv6 addresses", () => {
      vi.spyOn(os, "networkInterfaces").mockReturnValue({
        lo0: [{ address: "127.0.0.1", family: "IPv4", internal: true, netmask: "" }],
        utun9: [
          {
            address: "100.123.224.76",
            family: "IPv4",
            internal: false,
            netmask: "",
          },
          {
            address: "fd7a:115c:a1e0::8801:e04c",
            family: "IPv6",
            internal: false,
            netmask: "",
          },
        ],
        // oxlint-disable-next-line typescript/no-explicit-any
      } as any);

      const out = listTailnetAddresses();
      expect(out.ipv4).toEqual(["100.123.224.76"]);
      expect(out.ipv6).toEqual(["fd7a:115c:a1e0::8801:e04c"]);
    });
  });
});
