import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { registerMeshCommand } from "./mesh-command.js";

const callGatewayMock = vi.hoisted(() => vi.fn());

vi.mock("../../../src/gateway/call.js", () => ({
  callGateway: callGatewayMock,
}));

type RegisteredCommand = {
  name: string;
  description: string;
  acceptsArgs?: boolean;
  handler: (ctx: {
    senderId?: string;
    channel: string;
    isAuthorizedSender: boolean;
    args?: string;
    commandBody: string;
    config: Record<string, unknown>;
  }) => Promise<{ text?: string }>;
};

function captureCommand(): RegisteredCommand {
  const registered: RegisteredCommand[] = [];
  const api = {
    registerCommand: (def: RegisteredCommand) => {
      registered.push(def);
    },
  } as unknown as OpenClawPluginApi;
  registerMeshCommand(api);
  const command = registered[0];
  if (!command) {
    throw new Error("mesh command was not registered");
  }
  return command;
}

describe("mesh plugin command", () => {
  beforeEach(() => {
    callGatewayMock.mockReset();
  });

  it("registers /mesh command", () => {
    const command = captureCommand();
    expect(command.name).toBe("mesh");
    expect(command.acceptsArgs).toBe(true);
  });

  it("returns usage for bare /mesh", async () => {
    const command = captureCommand();
    const result = await command.handler({
      channel: "whatsapp",
      senderId: "user-1",
      isAuthorizedSender: true,
      commandBody: "/mesh",
      config: {},
    });
    expect(result.text).toContain("Mesh command");
    expect(callGatewayMock).not.toHaveBeenCalled();
  });

  it("runs /mesh plan <goal>", async () => {
    const command = captureCommand();
    callGatewayMock.mockResolvedValueOnce({
      plan: {
        planId: "mesh-plan-1",
        goal: "build animation",
        createdAt: Date.now(),
        steps: [{ id: "s1", prompt: "do thing" }],
      },
      source: "llm",
    });

    const result = await command.handler({
      channel: "whatsapp",
      senderId: "user-1",
      isAuthorizedSender: true,
      commandBody: "/mesh plan build animation",
      config: {},
    });

    expect(result.text).toContain("Run exact plan: /mesh run mesh-plan-1");
    expect(callGatewayMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "mesh.plan.auto",
      }),
    );
  });

  it("runs cached plan id without re-planning", async () => {
    const command = captureCommand();
    callGatewayMock
      .mockResolvedValueOnce({
        plan: {
          planId: "mesh-plan-cache",
          goal: "cached goal",
          createdAt: Date.now(),
          steps: [{ id: "s1", prompt: "do thing" }],
        },
      })
      .mockResolvedValueOnce({
        runId: "mesh-run-1",
        status: "completed",
        stats: { total: 1, succeeded: 1, failed: 0, skipped: 0, running: 0, pending: 0 },
      });

    await command.handler({
      channel: "whatsapp",
      senderId: "user-1",
      isAuthorizedSender: true,
      commandBody: "/mesh plan cached goal",
      config: {},
    });

    callGatewayMock.mockClear();

    const result = await command.handler({
      channel: "whatsapp",
      senderId: "user-1",
      isAuthorizedSender: true,
      commandBody: "/mesh run mesh-plan-cache",
      config: {},
    });

    expect(result.text).toContain("Mesh Run");
    expect(callGatewayMock).toHaveBeenCalledTimes(1);
    expect(callGatewayMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "mesh.run",
      }),
    );
  });

  it("blocks unauthorized sender", async () => {
    const command = captureCommand();
    const result = await command.handler({
      channel: "whatsapp",
      senderId: "user-1",
      isAuthorizedSender: false,
      commandBody: "/mesh status mesh-run-1",
      config: {},
    });
    expect(result.text).toContain("requires authorization");
    expect(callGatewayMock).not.toHaveBeenCalled();
  });
});
