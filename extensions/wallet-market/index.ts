import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

type WalletMarketConfig = {
  defaultFaucetAmount?: number;
  maxTaskReward?: number;
};

type TaskStatus = "open" | "in_progress" | "completed" | "cancelled";

type WalletTask = {
  id: string;
  title: string;
  reward: number;
  owner: string;
  worker?: string;
  status: TaskStatus;
  createdAt: string;
  completedAt?: string;
};

type WalletState = {
  version: 1;
  balances: Record<string, number>;
  tasks: WalletTask[];
};

type WalletCommandContext = {
  senderId?: string;
  from?: string;
  accountId?: string;
  channel: string;
};

const STATE_VERSION = 1;
const STATE_FILE = "wallet-market-state.json";
const ESCROW_ACCOUNT = "__market_escrow__";

function resolveActorId(ctx: WalletCommandContext): string | null {
  const raw = ctx.senderId?.trim() || ctx.from?.trim() || "";
  if (!raw) {
    return null;
  }
  const account = ctx.accountId ? `:${ctx.accountId}` : "";
  return `${ctx.channel}${account}:${raw}`;
}

function parsePositiveAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 1_0000) / 1_0000;
}

function toShortActor(actor: string): string {
  const parts = actor.split(":");
  return parts.length >= 2 ? `${parts[0]}:${parts.at(-1)}` : actor;
}

function findTask(state: WalletState, taskId: string): WalletTask | null {
  const task = state.tasks.find((item) => item.id === taskId);
  return task ?? null;
}

function setBalance(state: WalletState, actor: string, amount: number): void {
  state.balances[actor] = Math.round(amount * 1_0000) / 1_0000;
}

function getBalance(state: WalletState, actor: string): number {
  return state.balances[actor] ?? 0;
}

function transfer(
  state: WalletState,
  from: string,
  to: string,
  amount: number,
): { ok: boolean; reason?: string } {
  if (from !== ESCROW_ACCOUNT && getBalance(state, from) < amount) {
    return { ok: false, reason: "余额不足" };
  }
  if (from !== ESCROW_ACCOUNT) {
    setBalance(state, from, getBalance(state, from) - amount);
  }
  setBalance(state, to, getBalance(state, to) + amount);
  return { ok: true };
}

async function readState(statePath: string): Promise<WalletState> {
  try {
    const raw = await readFile(statePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<WalletState>;
    if (parsed.version !== STATE_VERSION || !parsed.balances || !Array.isArray(parsed.tasks)) {
      return { version: STATE_VERSION, balances: {}, tasks: [] };
    }
    return {
      version: STATE_VERSION,
      balances: parsed.balances,
      tasks: parsed.tasks,
    };
  } catch {
    return { version: STATE_VERSION, balances: {}, tasks: [] };
  }
}

async function writeState(statePath: string, state: WalletState): Promise<void> {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
}

async function mutateState<T>(statePath: string, mutate: (state: WalletState) => T): Promise<T> {
  const state = await readState(statePath);
  const result = mutate(state);
  await writeState(statePath, state);
  return result;
}

function helpText(): string {
  return [
    "Wallet & Task Market commands:",
    "/wallet balance",
    "/wallet faucet [amount]",
    "/wallet send <toActorId> <amount> [memo]",
    "/task-post <reward> <title>",
    "/task-list [open|mine|all]",
    "/task-take <taskId>",
    "/task-done <taskId>",
    "/task-cancel <taskId>",
    "",
    "提示: toActorId 可以在 /task-list 里看到。",
  ].join("\n");
}

export default function register(api: OpenClawPluginApi) {
  const pluginCfg = (api.pluginConfig ?? {}) as WalletMarketConfig;
  const defaultFaucetAmount = Number.isFinite(pluginCfg.defaultFaucetAmount)
    ? Math.max(0.01, Number(pluginCfg.defaultFaucetAmount))
    : 20;
  const maxTaskReward = Number.isFinite(pluginCfg.maxTaskReward)
    ? Math.max(1, Number(pluginCfg.maxTaskReward))
    : 10_000;
  const statePath = path.join(api.runtime.state.resolveStateDir(), STATE_FILE);
  let mutationQueue: Promise<unknown> = Promise.resolve();

  async function mutateStateSerialized<T>(mutate: (state: WalletState) => T): Promise<T> {
    const run = mutationQueue.then(() => mutateState(statePath, mutate));
    mutationQueue = run.catch(() => undefined);
    return run;
  }

  api.registerCommand({
    name: "wallet",
    description: "Wallet operations: balance, faucet, send.",
    acceptsArgs: true,
    handler: async (ctx) => {
      const actor = resolveActorId(ctx);
      if (!actor) return { text: "无法识别你的账户，无法使用钱包功能。" };

      const args = ctx.args?.trim() ?? "";
      const [actionRaw, ...rest] = args.split(/\s+/).filter(Boolean);
      const action = (actionRaw ?? "help").toLowerCase();

      if (action === "help" || !actionRaw) {
        return { text: helpText() };
      }

      if (action === "balance") {
        const state = await readState(statePath);
        const amount = getBalance(state, actor);
        return {
          text: `钱包账户: ${actor}\n余额: ${amount.toFixed(4)} CLC`,
        };
      }

      if (action === "faucet") {
        const amount = parsePositiveAmount(rest[0]) ?? defaultFaucetAmount;
        const next = await mutateStateSerialized((state) => {
          setBalance(state, actor, getBalance(state, actor) + amount);
          return getBalance(state, actor);
        });
        return {
          text: `已领取测试资金 ${amount.toFixed(4)} CLC\n当前余额: ${next.toFixed(4)} CLC`,
        };
      }

      if (action === "send") {
        const to = rest[0]?.trim();
        const amount = parsePositiveAmount(rest[1]);
        if (!to || !amount) {
          return { text: "用法: /wallet send <toActorId> <amount> [memo]" };
        }
        const transferResult = await mutateStateSerialized((state) => {
          const result = transfer(state, actor, to, amount);
          if (!result.ok) return { ok: false as const, reason: result.reason };
          return { ok: true, balance: getBalance(state, actor) } as const;
        });
        if (!transferResult.ok) {
          return { text: `转账失败: ${transferResult.reason}` };
        }
        return {
          text:
            `转账成功: ${amount.toFixed(4)} CLC -> ${to}\n` +
            `你的余额: ${transferResult.balance.toFixed(4)} CLC`,
        };
      }

      return { text: helpText() };
    },
  });

  api.registerCommand({
    name: "task-post",
    description: "Post a paid task. Escrows reward from your wallet.",
    acceptsArgs: true,
    handler: async (ctx) => {
      const actor = resolveActorId(ctx);
      if (!actor) return { text: "无法识别你的账户，无法发布任务。" };

      const args = ctx.args?.trim() ?? "";
      const tokens = args.split(/\s+/).filter(Boolean);
      const reward = parsePositiveAmount(tokens[0]);
      const title = tokens.slice(1).join(" ").trim();
      if (!reward || !title) {
        return { text: "用法: /task-post <reward> <title>" };
      }
      if (reward > maxTaskReward) {
        return { text: `任务赏金过高，当前上限是 ${maxTaskReward} CLC` };
      }

      const outcome = await mutateStateSerialized((state) => {
        const result = transfer(state, actor, ESCROW_ACCOUNT, reward);
        if (!result.ok) return { ok: false, reason: result.reason } as const;
        const id = `T${Date.now().toString(36)}${Math.floor(Math.random() * 1000).toString(36)}`;
        state.tasks.unshift({
          id,
          title,
          reward,
          owner: actor,
          status: "open",
          createdAt: new Date().toISOString(),
        });
        return { ok: true, taskId: id, balance: getBalance(state, actor) } as const;
      });

      if (!outcome.ok) {
        return { text: `发布失败: ${outcome.reason}` };
      }
      return {
        text:
          `任务已发布: ${outcome.taskId}\n` +
          `标题: ${title}\n赏金: ${reward.toFixed(4)} CLC（已托管）\n` +
          `你的余额: ${outcome.balance.toFixed(4)} CLC`,
      };
    },
  });

  api.registerCommand({
    name: "task-list",
    description: "List market tasks.",
    acceptsArgs: true,
    requireAuth: false,
    handler: async (ctx) => {
      const actor = resolveActorId(ctx);
      const mode = (ctx.args?.trim().toLowerCase() || "open") as "open" | "mine" | "all";
      const state = await readState(statePath);
      const filtered = state.tasks.filter((task) => {
        if (mode === "all") return true;
        if (mode === "mine") return actor ? task.owner === actor || task.worker === actor : false;
        return task.status === "open" || task.status === "in_progress";
      });
      if (filtered.length === 0) {
        return { text: `暂无任务（模式: ${mode}）` };
      }
      const rows = filtered.slice(0, 30).map((task) => {
        const worker = task.worker ? ` -> ${toShortActor(task.worker)}` : "";
        return `${task.id} | ${task.status} | ${task.reward.toFixed(4)} CLC | ${task.title} | ${toShortActor(task.owner)}${worker}`;
      });
      return {
        text: [`任务列表（${mode}）:`, ...rows].join("\n"),
      };
    },
  });

  api.registerCommand({
    name: "task-take",
    description: "Accept an open task.",
    acceptsArgs: true,
    handler: async (ctx) => {
      const actor = resolveActorId(ctx);
      if (!actor) return { text: "无法识别你的账户，无法接单。" };
      const taskId = ctx.args?.trim();
      if (!taskId) return { text: "用法: /task-take <taskId>" };

      const result = await mutateStateSerialized((state) => {
        const task = findTask(state, taskId);
        if (!task) return { ok: false, reason: "任务不存在" } as const;
        if (task.status !== "open") return { ok: false, reason: "任务不可接" } as const;
        if (task.owner === actor) return { ok: false, reason: "不能接自己发布的任务" } as const;
        task.status = "in_progress";
        task.worker = actor;
        return { ok: true, task } as const;
      });

      if (!result.ok) {
        return { text: `接单失败: ${result.reason}` };
      }
      return {
        text: `接单成功: ${result.task.id}\n标题: ${result.task.title}\n赏金: ${result.task.reward.toFixed(4)} CLC`,
      };
    },
  });

  api.registerCommand({
    name: "task-done",
    description: "Mark task complete and release escrow to worker.",
    acceptsArgs: true,
    handler: async (ctx) => {
      const actor = resolveActorId(ctx);
      if (!actor) return { text: "无法识别你的账户，无法操作任务。" };
      const taskId = ctx.args?.trim();
      if (!taskId) return { text: "用法: /task-done <taskId>" };

      const result = await mutateStateSerialized((state) => {
        const task = findTask(state, taskId);
        if (!task) return { ok: false, reason: "任务不存在" } as const;
        if (task.owner !== actor)
          return { ok: false, reason: "只有任务发布者可以确认完成" } as const;
        if (task.status !== "in_progress" || !task.worker) {
          return { ok: false, reason: "任务尚未被接单或已结束" } as const;
        }
        const payout = transfer(state, ESCROW_ACCOUNT, task.worker, task.reward);
        if (!payout.ok) return { ok: false, reason: "托管账户异常" } as const;
        task.status = "completed";
        task.completedAt = new Date().toISOString();
        return { ok: true, task, workerBalance: getBalance(state, task.worker) } as const;
      });

      if (!result.ok) {
        return { text: `完成失败: ${result.reason}` };
      }
      return {
        text:
          `任务已完成并结算: ${result.task.id}\n` +
          `收款方: ${result.task.worker}\n` +
          `金额: ${result.task.reward.toFixed(4)} CLC\n` +
          `收款方余额: ${result.workerBalance.toFixed(4)} CLC`,
      };
    },
  });

  api.registerCommand({
    name: "task-cancel",
    description: "Cancel open task and refund escrow.",
    acceptsArgs: true,
    handler: async (ctx) => {
      const actor = resolveActorId(ctx);
      if (!actor) return { text: "无法识别你的账户，无法取消任务。" };
      const taskId = ctx.args?.trim();
      if (!taskId) return { text: "用法: /task-cancel <taskId>" };

      const result = await mutateStateSerialized((state) => {
        const task = findTask(state, taskId);
        if (!task) return { ok: false, reason: "任务不存在" } as const;
        if (task.owner !== actor) return { ok: false, reason: "只有任务发布者可以取消" } as const;
        if (task.status !== "open") return { ok: false, reason: "只有未接单任务可取消" } as const;
        const refund = transfer(state, ESCROW_ACCOUNT, actor, task.reward);
        if (!refund.ok) return { ok: false, reason: "托管账户异常" } as const;
        task.status = "cancelled";
        return { ok: true, balance: getBalance(state, actor) } as const;
      });

      if (!result.ok) {
        return { text: `取消失败: ${result.reason}` };
      }
      return { text: `任务已取消并退款。\n你的余额: ${result.balance.toFixed(4)} CLC` };
    },
  });
}
