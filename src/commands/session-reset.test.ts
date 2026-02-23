import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "../runtime.js";
import type { GatewayConnectionOptions } from "../tui/gateway-chat.js";

const resolveGatewayConnection = vi.fn((_opts: GatewayConnectionOptions) => ({
  url: "ws://127.0.0.1:18789",
  token: "token",
  password: undefined,
}));
const start = vi.fn();
const waitForReady = vi.fn();
const resetSession = vi.fn();
const stop = vi.fn();
const clientCtor = vi.fn();

vi.mock("../tui/gateway-chat.js", () => ({
  resolveGatewayConnection: (opts: GatewayConnectionOptions) => resolveGatewayConnection(opts),
  GatewayChatClient: class {
    constructor(opts: unknown) {
      clientCtor(opts);
    }
    start = start;
    waitForReady = waitForReady;
    resetSession = resetSession;
    stop = stop;
  },
}));

import { sessionResetCommand } from "./session-reset.js";

const runtime = {
  log: vi.fn(),
  error: vi.fn(),
  exit: vi.fn(),
} satisfies RuntimeEnv;

describe("sessionResetCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    waitForReady.mockResolvedValue(undefined);
    resetSession.mockResolvedValue({ ok: true, key: "agent:main:main" });
  });

  it("resets the default session with default reason", async () => {
    await sessionResetCommand({}, runtime);

    expect(resolveGatewayConnection).toHaveBeenCalledWith({});
    expect(clientCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "ws://127.0.0.1:18789",
      }),
    );
    expect(start).toHaveBeenCalledTimes(1);
    expect(waitForReady).toHaveBeenCalledTimes(1);
    expect(resetSession).toHaveBeenCalledWith("agent:main:main", "new");
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("writes JSON output when --json is enabled", async () => {
    resetSession.mockResolvedValueOnce({ ok: true, key: "agent:work:main" });

    await sessionResetCommand(
      { sessionKey: "agent:work:main", reason: "reset", json: true },
      runtime,
    );

    const payload = runtime.log.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(payload)) as { ok: boolean; key: string; reason: string };
    expect(parsed.ok).toBe(true);
    expect(parsed.key).toBe("agent:work:main");
    expect(parsed.reason).toBe("reset");
  });

  it("rejects invalid reason", async () => {
    await sessionResetCommand({ reason: "wrong" }, runtime);

    expect(runtime.error).toHaveBeenCalledWith('--reason must be one of: "new", "reset"');
    expect(runtime.exit).toHaveBeenCalledWith(1);
    expect(clientCtor).not.toHaveBeenCalled();
  });
});
