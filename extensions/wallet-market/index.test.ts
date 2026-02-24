import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import register from "./index.js";

type CmdHandler = (ctx: Record<string, unknown>) => Promise<{ text: string }>;

function buildCtx(params: {
  commandBody: string;
  args?: string;
  senderId?: string;
  channel?: string;
}): Record<string, unknown> {
  return {
    channel: params.channel ?? "telegram",
    senderId: params.senderId ?? "u1",
    commandBody: params.commandBody,
    args: params.args ?? "",
    isAuthorizedSender: true,
    config: {},
  };
}

describe("wallet-market plugin", () => {
  const commands = new Map<string, CmdHandler>();
  let stateDir = "";

  beforeEach(async () => {
    commands.clear();
    stateDir = await mkdtemp(path.join(tmpdir(), "wallet-market-"));

    const api = {
      pluginConfig: { defaultFaucetAmount: 50, maxTaskReward: 5000 },
      runtime: {
        state: {
          resolveStateDir: () => stateDir,
        },
      },
      registerCommand: vi.fn((cmd: { name: string; handler: CmdHandler }) => {
        commands.set(cmd.name, cmd.handler);
      }),
    };

    register(api as never);
  });

  afterEach(async () => {
    await rm(stateDir, { recursive: true, force: true });
  });

  it("registers wallet and task commands", () => {
    expect(commands.has("wallet")).toBe(true);
    expect(commands.has("task-post")).toBe(true);
    expect(commands.has("task-list")).toBe(true);
    expect(commands.has("task-take")).toBe(true);
    expect(commands.has("task-done")).toBe(true);
    expect(commands.has("task-cancel")).toBe(true);
  });

  it("supports faucet and balance", async () => {
    const wallet = commands.get("wallet");
    expect(wallet).toBeDefined();

    const faucetReply = await wallet!(
      buildCtx({ commandBody: "/wallet faucet", args: "faucet", senderId: "alice" }),
    );
    expect(faucetReply.text).toContain("50.0000 CLC");

    const balanceReply = await wallet!(
      buildCtx({ commandBody: "/wallet balance", args: "balance", senderId: "alice" }),
    );
    expect(balanceReply.text).toContain("50.0000 CLC");
    expect(balanceReply.text).toContain("telegram:alice");
  });

  it("completes task market lifecycle with escrow payout", async () => {
    const wallet = commands.get("wallet");
    const taskPost = commands.get("task-post");
    const taskList = commands.get("task-list");
    const taskTake = commands.get("task-take");
    const taskDone = commands.get("task-done");

    expect(wallet && taskPost && taskList && taskTake && taskDone).toBeTruthy();

    await wallet!(buildCtx({ commandBody: "/wallet faucet", args: "faucet", senderId: "owner" }));

    const postReply = await taskPost!(
      buildCtx({
        commandBody: "/task-post 10 write unit tests",
        args: "10 write unit tests",
        senderId: "owner",
      }),
    );
    expect(postReply.text).toContain("任务已发布");
    const taskIdMatch = postReply.text.match(/任务已发布:\s*(\S+)/);
    expect(taskIdMatch).toBeTruthy();
    const taskId = taskIdMatch?.[1] ?? "";

    const takeReply = await taskTake!(
      buildCtx({
        commandBody: `/task-take ${taskId}`,
        args: taskId,
        senderId: "worker",
      }),
    );
    expect(takeReply.text).toContain("接单成功");

    const doneReply = await taskDone!(
      buildCtx({
        commandBody: `/task-done ${taskId}`,
        args: taskId,
        senderId: "owner",
      }),
    );
    expect(doneReply.text).toContain("任务已完成并结算");
    expect(doneReply.text).toContain("10.0000 CLC");

    const workerBalance = await wallet!(
      buildCtx({
        commandBody: "/wallet balance",
        args: "balance",
        senderId: "worker",
      }),
    );
    expect(workerBalance.text).toContain("10.0000 CLC");

    const listReply = await taskList!(
      buildCtx({
        commandBody: "/task-list all",
        args: "all",
        senderId: "owner",
      }),
    );
    expect(listReply.text).toContain("completed");
  });

  it("writes persistent state file", async () => {
    const wallet = commands.get("wallet");
    await wallet!(
      buildCtx({ commandBody: "/wallet faucet 12", args: "faucet 12", senderId: "persist-user" }),
    );

    const statePath = path.join(stateDir, "wallet-market-state.json");
    const raw = await readFile(statePath, "utf8");
    const parsed = JSON.parse(raw) as { balances: Record<string, number> };
    expect(parsed.balances["telegram:persist-user"]).toBe(12);
  });
});
