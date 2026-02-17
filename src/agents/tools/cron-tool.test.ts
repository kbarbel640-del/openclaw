import { beforeEach, describe, expect, it, vi } from "vitest";

const callGatewayMock = vi.fn();
vi.mock("../../gateway/call.js", () => ({
  callGateway: (opts: unknown) => callGatewayMock(opts),
}));

import { createCronTool } from "./cron-tool.js";

describe("cron tool (timeouts)", () => {
  beforeEach(() => {
    callGatewayMock.mockReset();
    callGatewayMock.mockResolvedValue({ ok: true });
  });

  it("uses a higher default gateway timeout for cron.run/runs", async () => {
    const tool = createCronTool();

    await tool.execute("call-run", { action: "run", jobId: "job-1" });
    const runCall = callGatewayMock.mock.calls.at(-1)?.[0] as { timeoutMs?: number };
    expect(runCall.timeoutMs).toBe(180_000);

    callGatewayMock.mockReset();
    callGatewayMock.mockResolvedValue({ ok: true });

    await tool.execute("call-runs", { action: "runs", jobId: "job-1" });
    const runsCall = callGatewayMock.mock.calls.at(-1)?.[0] as { timeoutMs?: number };
    expect(runsCall.timeoutMs).toBe(180_000);

    callGatewayMock.mockReset();
    callGatewayMock.mockResolvedValue({ ok: true });

    await tool.execute("call-list", { action: "list" });
    const listCall = callGatewayMock.mock.calls.at(-1)?.[0] as { timeoutMs?: number };
    expect(listCall.timeoutMs).toBe(60_000);
  });
});
