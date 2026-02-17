import { beforeEach, describe, expect, it, vi } from "vitest";
import { installGatewayTestHooks, startGatewayServer } from "./test-helpers.js";

const { initSubagentRegistryMock, initOrchestratorRegistryMock } = vi.hoisted(() => ({
  initSubagentRegistryMock: vi.fn(),
  initOrchestratorRegistryMock: vi.fn(),
}));

vi.mock("../agents/subagent-registry.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../agents/subagent-registry.js")>();
  return {
    ...actual,
    initSubagentRegistry: (...args: unknown[]) => initSubagentRegistryMock(...args),
  };
});

vi.mock("../agents/orchestrator-request-registry.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../agents/orchestrator-request-registry.js")>();
  return {
    ...actual,
    initOrchestratorRegistry: (...args: unknown[]) => initOrchestratorRegistryMock(...args),
  };
});

installGatewayTestHooks();

beforeEach(() => {
  initSubagentRegistryMock.mockReset();
  initOrchestratorRegistryMock.mockReset();
});

describe("gateway startup registry initialization", () => {
  it("initializes orchestrator registry after subagent registry", async () => {
    const result = await startGatewayServer(18789, { controlUiEnabled: false })
      .then((server) => ({ server }))
      .catch((error: unknown) => ({ error }));

    if (result.server) {
      await result.server.close();
    } else {
      expect(String(result.error)).toMatch(/listen|EACCES|EPERM|already listening/i);
    }

    expect(initSubagentRegistryMock).toHaveBeenCalledTimes(1);
    expect(initOrchestratorRegistryMock).toHaveBeenCalledTimes(1);
    expect(initSubagentRegistryMock.mock.invocationCallOrder[0]).toBeLessThan(
      initOrchestratorRegistryMock.mock.invocationCallOrder[0],
    );
  });
});
