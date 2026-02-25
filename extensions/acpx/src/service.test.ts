import type { AcpRuntime, OpenClawPluginServiceContext } from "openclaw/plugin-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AcpRuntimeError } from "../../../src/acp/runtime/errors.js";
import {
  __testing,
  getAcpRuntimeBackend,
  requireAcpRuntimeBackend,
} from "../../../src/acp/runtime/registry.js";
import { createAcpxRuntimeService } from "./service.js";

type RuntimeStub = AcpRuntime & {
  probeAvailability(): Promise<void>;
  isHealthy(): boolean;
};

function createRuntimeStub(healthy: boolean): {
  runtime: RuntimeStub;
  probeAvailabilitySpy: ReturnType<typeof vi.fn>;
  isHealthySpy: ReturnType<typeof vi.fn>;
} {
  const probeAvailabilitySpy = vi.fn(async () => {});
  const isHealthySpy = vi.fn(() => healthy);
  return {
    runtime: {
      ensureSession: vi.fn(async (input) => ({
        sessionKey: input.sessionKey,
        backend: "acpx",
        runtimeSessionName: input.sessionKey,
      })),
      runTurn: vi.fn(async function* () {
        yield { type: "done" as const };
      }),
      cancel: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      async probeAvailability() {
        await probeAvailabilitySpy();
      },
      isHealthy() {
        return isHealthySpy();
      },
    },
    probeAvailabilitySpy,
    isHealthySpy,
  };
}

function createServiceContext(
  overrides: Partial<OpenClawPluginServiceContext> = {},
): OpenClawPluginServiceContext {
  return {
    config: {},
    workspaceDir: "/tmp/workspace",
    stateDir: "/tmp/state",
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    ...overrides,
  };
}

describe("createAcpxRuntimeService", () => {
  beforeEach(() => {
    __testing.resetAcpRuntimeBackendsForTests();
  });

  it("registers and unregisters the acpx backend", async () => {
    const { runtime, probeAvailabilitySpy } = createRuntimeStub(true);
    const service = createAcpxRuntimeService({
      runtimeFactory: () => runtime,
    });
    const context = createServiceContext();

    await service.start(context);
    expect(probeAvailabilitySpy).toHaveBeenCalledOnce();
    expect(getAcpRuntimeBackend("acpx")?.runtime).toBe(runtime);

    await service.stop?.(context);
    expect(getAcpRuntimeBackend("acpx")).toBeNull();
  });

  it("marks backend unavailable when runtime health check fails", async () => {
    const { runtime } = createRuntimeStub(false);
    const service = createAcpxRuntimeService({
      runtimeFactory: () => runtime,
    });
    const context = createServiceContext();

    await service.start(context);

    expect(() => requireAcpRuntimeBackend("acpx")).toThrowError(AcpRuntimeError);
    try {
      requireAcpRuntimeBackend("acpx");
      throw new Error("expected ACP backend lookup to fail");
    } catch (error) {
      expect((error as AcpRuntimeError).code).toBe("ACP_BACKEND_UNAVAILABLE");
    }
  });

  it("passes queue-owner TTL from plugin config", async () => {
    const { runtime } = createRuntimeStub(true);
    const runtimeFactory = vi.fn(() => runtime);
    const service = createAcpxRuntimeService({
      runtimeFactory,
      pluginConfig: {
        command: "acpx-custom",
        queueOwnerTtlSeconds: 0.25,
      },
    });
    const context = createServiceContext();

    await service.start(context);

    expect(runtimeFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        queueOwnerTtlSeconds: 0.25,
        pluginConfig: expect.objectContaining({
          command: "acpx-custom",
        }),
      }),
    );
  });

  it("uses a short default queue-owner TTL", async () => {
    const { runtime } = createRuntimeStub(true);
    const runtimeFactory = vi.fn(() => runtime);
    const service = createAcpxRuntimeService({
      runtimeFactory,
    });
    const context = createServiceContext();

    await service.start(context);

    expect(runtimeFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        queueOwnerTtlSeconds: 0.1,
      }),
    );
  });
});
