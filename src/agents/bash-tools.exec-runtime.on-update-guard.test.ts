import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { afterEach, expect, test, vi } from "vitest";
import type { ExecToolDetails } from "./bash-tools.exec-types.js";
import { resetProcessRegistryForTests } from "./bash-process-registry.js";
import { runExecProcess } from "./bash-tools.exec-runtime.js";

const { supervisorSpawnMock } = vi.hoisted(() => ({
  supervisorSpawnMock: vi.fn(),
}));

vi.mock("../process/supervisor/index.js", () => ({
  getProcessSupervisor: () => ({
    spawn: (...args: unknown[]) => supervisorSpawnMock(...args),
    cancel: vi.fn(),
    cancelScope: vi.fn(),
    reconcileOrphans: vi.fn(),
    getRecord: vi.fn(),
  }),
}));

afterEach(() => {
  resetProcessRegistryForTests();
  vi.clearAllMocks();
});

test("runExecProcess ignores truthy non-function onUpdate values", async () => {
  supervisorSpawnMock.mockImplementation(async (input: { onStdout?: (chunk: string) => void }) => {
    input.onStdout?.("streamed output");
    return {
      runId: "run-1",
      pid: 1234,
      startedAtMs: Date.now(),
      wait: async () => ({
        reason: "exit" as const,
        exitCode: 0,
        exitSignal: null,
        durationMs: 1,
        stdout: "",
        stderr: "",
        timedOut: false,
        noOutputTimedOut: false,
      }),
      cancel: vi.fn(),
    };
  });

  const handle = await runExecProcess({
    command: "echo ok",
    workdir: "/tmp",
    env: {},
    usePty: false,
    warnings: [],
    maxOutput: 200_000,
    pendingMaxOutput: 30_000,
    notifyOnExit: false,
    timeoutSec: 5,
    onUpdate: true as unknown as (partialResult: AgentToolResult<ExecToolDetails>) => void,
  });

  const outcome = await handle.promise;
  expect(outcome.status).toBe("completed");
  expect(outcome.aggregated).toContain("streamed output");
});
