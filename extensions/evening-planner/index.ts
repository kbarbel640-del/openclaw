import { randomUUID } from "node:crypto";
import { Type } from "@sinclair/typebox";
import type { GatewayRequestHandlerOptions, OpenClawPluginApi } from "openclaw/plugin-sdk";
import {
  applyShubhamReply,
  applyTimeoutFallback,
  createPlannerSession,
  isSessionActive,
  markPromptSent,
  recommendedSeats,
} from "./src/state-machine.js";
import { readPlannerSessions, writePlannerSessions } from "./src/store.js";
import {
  bookDineoutTable,
  checkDineoutSlots,
  searchDineout,
  type SwiggyConfig,
} from "./src/swiggy.js";
import type { EveningPlannerConfig, PlannerSessionState } from "./src/types.js";

const EveningPlannerToolSchema = Type.Object({
  action: Type.String({
    description:
      "Action: start_session | list_sessions | status | cancel_session | ingest_reply | search_venues | check_slots | prepare_booking | book_table",
  }),
  sessionId: Type.Optional(Type.String()),
  conversationId: Type.Optional(Type.String()),
  query: Type.Optional(Type.String()),
  location: Type.Optional(Type.String()),
  restaurantId: Type.Optional(Type.String()),
  restaurantName: Type.Optional(Type.String()),
  date: Type.Optional(Type.String()),
  time: Type.Optional(Type.String()),
  guests: Type.Optional(Type.Number({ minimum: 1 })),
  confirm: Type.Optional(Type.Boolean()),
  timeoutSec: Type.Optional(Type.Number({ minimum: 15 })),
  maxTurns: Type.Optional(Type.Number({ minimum: 1 })),
  text: Type.Optional(Type.String()),
  shubhamSenderId: Type.Optional(Type.String()),
  shubhamUsername: Type.Optional(Type.String()),
  shubhamDisplayName: Type.Optional(Type.String()),
  sendInitialPrompt: Type.Optional(Type.Boolean()),
  initialPrompt: Type.Optional(Type.String()),
  userDisplayName: Type.Optional(Type.String()),
});

type EveningPlannerPluginConfig = {
  enabled?: boolean;
  deterministicDemo?: boolean;
  telegramAccountId?: string;
  timeoutSec?: number;
  maxTurns?: number;
  pollingIntervalSec?: number;
  fixtureMode?: boolean;
  swiggyCommand?: string;
  swiggyTimeoutMs?: number;
  shubham?: {
    senderId?: string;
    username?: string;
    displayName?: string;
  };
};

const DEFAULT_POLLING_INTERVAL_SEC = 5;
const DEFAULT_TIMEOUT_SEC = 120;
const DEFAULT_MAX_TURNS = 3;

function json(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

function readString(params: Record<string, unknown>, key: string): string | undefined {
  const value = params[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readBoolean(params: Record<string, unknown>, key: string): boolean | undefined {
  const value = params[key];
  return typeof value === "boolean" ? value : undefined;
}

function readNumber(params: Record<string, unknown>, key: string): number | undefined {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeUsername(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.replace(/^@+/, "").trim().toLowerCase() || undefined;
}

function resolveConfig(raw: unknown): EveningPlannerConfig & { enabled: boolean } {
  const cfg = (raw ?? {}) as EveningPlannerPluginConfig;
  return {
    enabled: cfg.enabled !== false,
    deterministicDemo: cfg.deterministicDemo !== false,
    telegramAccountId: cfg.telegramAccountId?.trim() || undefined,
    timeoutSec:
      typeof cfg.timeoutSec === "number" && Number.isFinite(cfg.timeoutSec)
        ? Math.max(15, Math.floor(cfg.timeoutSec))
        : DEFAULT_TIMEOUT_SEC,
    maxTurns:
      typeof cfg.maxTurns === "number" && Number.isFinite(cfg.maxTurns)
        ? Math.max(1, Math.floor(cfg.maxTurns))
        : DEFAULT_MAX_TURNS,
    pollingIntervalSec:
      typeof cfg.pollingIntervalSec === "number" && Number.isFinite(cfg.pollingIntervalSec)
        ? Math.max(2, Math.floor(cfg.pollingIntervalSec))
        : DEFAULT_POLLING_INTERVAL_SEC,
    swiggy: {
      fixtureMode: cfg.fixtureMode !== false,
      command: cfg.swiggyCommand?.trim() || "swiggy",
      timeoutMs:
        typeof cfg.swiggyTimeoutMs === "number" && Number.isFinite(cfg.swiggyTimeoutMs)
          ? Math.max(1000, Math.floor(cfg.swiggyTimeoutMs))
          : 15_000,
    },
    shubhamDefaults: {
      senderId: cfg.shubham?.senderId?.trim() || undefined,
      username: normalizeUsername(cfg.shubham?.username),
      displayName: cfg.shubham?.displayName?.trim() || "Shubham",
    },
  };
}

function summarizeSession(session: PlannerSessionState) {
  return {
    id: session.id,
    conversationId: session.conversationId,
    status: session.status,
    shubhamAvailability: session.shubham.availability,
    etaMinutes: session.shubham.etaMinutes,
    followUpsAsked: session.shubham.followUpsAsked,
    timeoutAtMs: session.negotiation.timeoutAtMs,
    bookingDraft: session.bookingDraft,
    bookingResult: session.bookingResult,
    updatedAtMs: session.updatedAtMs,
  };
}

function normalizeSenderId(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function canonicalSenderId(value: string | undefined): string | undefined {
  const normalized = normalizeSenderId(value);
  if (!normalized) {
    return undefined;
  }
  const parts = normalized.split(":").map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) ?? normalized;
}

function senderMatches(session: PlannerSessionState, senderId?: string, senderUsername?: string): boolean {
  const expectedId = session.shubham.senderId?.trim();
  const expectedUsername = normalizeUsername(session.shubham.username);
  const incomingId = normalizeSenderId(senderId);
  const incomingUsername = normalizeUsername(senderUsername);
  const expectedCanonicalId = canonicalSenderId(expectedId);
  const incomingCanonicalId = canonicalSenderId(incomingId);

  if (expectedId) {
    return incomingId === expectedId || incomingCanonicalId === expectedCanonicalId;
  }
  if (expectedUsername) {
    return incomingUsername === expectedUsername;
  }
  return Boolean(incomingId || incomingUsername);
}

function lockSenderIfNeeded(
  session: PlannerSessionState,
  senderId?: string,
  senderUsername?: string,
): void {
  if (!session.shubham.senderId) {
    session.shubham.senderId = normalizeSenderId(senderId);
  }
  if (!session.shubham.username) {
    session.shubham.username = normalizeUsername(senderUsername);
  }
}

export default function register(api: OpenClawPluginApi) {
  const cfg = resolveConfig(api.pluginConfig);
  const stateDir = api.runtime.state.resolveStateDir();
  const swiggyCfg: SwiggyConfig = cfg.swiggy;

  let sessions = new Map<string, PlannerSessionState>();
  let loaded = false;
  let timeoutTimer: ReturnType<typeof setInterval> | null = null;

  async function ensureLoaded() {
    if (loaded) {
      return;
    }
    sessions = await readPlannerSessions(stateDir);
    loaded = true;
  }

  async function persist() {
    await writePlannerSessions(stateDir, sessions.values());
  }

  async function sendTelegramMessage(
    conversationId: string,
    text: string,
    threadId?: number,
  ): Promise<void> {
    if (!cfg.enabled) {
      return;
    }
    try {
      await api.runtime.channel.telegram.sendMessageTelegram(conversationId, text, {
        accountId: cfg.telegramAccountId,
        messageThreadId: threadId,
      });
    } catch (err) {
      api.logger.warn(`evening-planner: telegram send failed: ${String(err)}`);
    }
  }

  function getSessionOrThrow(sessionId: string): PlannerSessionState {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error(`session_not_found: ${sessionId}`);
    }
    return session;
  }

  async function startSession(params: Record<string, unknown>) {
    const conversationId = readString(params, "conversationId");
    if (!conversationId) {
      throw new Error("conversationId required");
    }
    const nowMs = Date.now();
    const session = createPlannerSession({
      id: randomUUID(),
      conversationId,
      nowMs,
      timeoutSec: readNumber(params, "timeoutSec") ?? cfg.timeoutSec,
      maxTurns: readNumber(params, "maxTurns") ?? cfg.maxTurns,
      userDisplayName: readString(params, "userDisplayName"),
      shubham: {
        senderId: readString(params, "shubhamSenderId") ?? cfg.shubhamDefaults.senderId,
        username:
          normalizeUsername(readString(params, "shubhamUsername")) ?? cfg.shubhamDefaults.username,
        displayName: readString(params, "shubhamDisplayName") ?? cfg.shubhamDefaults.displayName,
      },
    });

    sessions.set(session.id, session);

    const sendInitialPrompt = readBoolean(params, "sendInitialPrompt") ?? true;
    if (sendInitialPrompt) {
      const initialPrompt =
        readString(params, "initialPrompt") ??
        `${session.shubham.displayName}, aa rahe ho aaj raat? Agar aa rahe ho to ETA bhi bata do.`;
      const updated = markPromptSent(session, initialPrompt, nowMs, false);
      sessions.set(updated.id, updated);
      await sendTelegramMessage(updated.conversationId, initialPrompt);
    }

    await persist();
    return summarizeSession(sessions.get(session.id) ?? session);
  }

  async function ingestReply(params: {
    session: PlannerSessionState;
    text: string;
    threadId?: number;
  }) {
    const nowMs = Date.now();
    const result = applyShubhamReply(params.session, params.text, nowMs);
    let next = result.state;
    if (result.nextPrompt) {
      next = markPromptSent(next, result.nextPrompt, nowMs);
      await sendTelegramMessage(next.conversationId, result.nextPrompt, params.threadId);
    } else if (result.resolved) {
      await sendTelegramMessage(
        next.conversationId,
        `Update: ${result.summary}\nFinal booking ke liye user confirmation pending.`,
        params.threadId,
      );
    }
    sessions.set(next.id, next);
    await persist();
    return {
      summary: result.summary,
      nextPrompt: result.nextPrompt,
      session: summarizeSession(next),
    };
  }

  async function sweepTimeouts() {
    if (!cfg.enabled) {
      return;
    }
    await ensureLoaded();
    let changed = false;
    for (const [id, session] of sessions.entries()) {
      if (!isSessionActive(session)) {
        continue;
      }
      const timeout = applyTimeoutFallback(session, Date.now());
      if (!timeout.changed) {
        continue;
      }
      sessions.set(id, timeout.state);
      changed = true;
      if (timeout.summary) {
        await sendTelegramMessage(
          timeout.state.conversationId,
          `Update: ${timeout.summary}\nFinal booking ke liye user confirmation pending.`,
        );
      }
    }
    if (changed) {
      await persist();
    }
  }

  api.registerService({
    id: "evening-planner-timeout",
    start: async () => {
      await ensureLoaded();
      timeoutTimer = setInterval(() => {
        sweepTimeouts().catch((err) => {
          api.logger.warn(`evening-planner: timeout sweep failed: ${String(err)}`);
        });
      }, cfg.pollingIntervalSec * 1000);
      timeoutTimer.unref?.();
    },
    stop: async () => {
      if (timeoutTimer) {
        clearInterval(timeoutTimer);
        timeoutTimer = null;
      }
    },
  });

  api.on("message_received", async (event, ctx) => {
    if (!cfg.enabled || ctx.channelId !== "telegram") {
      return;
    }
    await ensureLoaded();
    const senderIdFromMetadata =
      event.metadata && typeof event.metadata.senderId === "string"
        ? event.metadata.senderId
        : undefined;
    const senderId =
      senderIdFromMetadata ??
      (typeof event.from === "string" && event.from.trim() ? event.from : undefined);
    const senderUsername =
      event.metadata && typeof event.metadata.senderUsername === "string"
        ? event.metadata.senderUsername
        : undefined;
    const threadIdRaw = event.metadata?.threadId;
    const threadId =
      typeof threadIdRaw === "number"
        ? threadIdRaw
        : typeof threadIdRaw === "string" && threadIdRaw.trim()
          ? Number.parseInt(threadIdRaw, 10)
          : undefined;

    for (const session of sessions.values()) {
      if (!isSessionActive(session)) {
        continue;
      }
      if (!ctx.conversationId || ctx.conversationId !== session.conversationId) {
        continue;
      }
      if (!senderMatches(session, senderId, senderUsername)) {
        continue;
      }
      lockSenderIfNeeded(session, senderId, senderUsername);
      await ingestReply({
        session,
        text: event.content,
        threadId: Number.isFinite(threadId) ? threadId : undefined,
      });
    }
  });

  api.registerGatewayMethod("eveningplanner.list", async ({ respond }: GatewayRequestHandlerOptions) => {
    try {
      await ensureLoaded();
      respond(true, { sessions: Array.from(sessions.values()).map(summarizeSession) });
    } catch (err) {
      respond(false, { error: err instanceof Error ? err.message : String(err) });
    }
  });

  api.registerGatewayMethod(
    "eveningplanner.status",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        await ensureLoaded();
        const sessionId = typeof params?.sessionId === "string" ? params.sessionId.trim() : "";
        if (!sessionId) {
          respond(false, { error: "sessionId required" });
          return;
        }
        const session = sessions.get(sessionId);
        if (!session) {
          respond(false, { error: "session_not_found" });
          return;
        }
        respond(true, { session: summarizeSession(session) });
      } catch (err) {
        respond(false, { error: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  api.registerTool({
    name: "evening_planner",
    label: "Evening Planner",
    description:
      "Runs evening-planner orchestration: Shubham multi-turn coordination + Swiggy booking workflow.",
    parameters: EveningPlannerToolSchema,
    async execute(_toolCallId, args) {
      const params = args as Record<string, unknown>;
      const action = (readString(params, "action") ?? "").toLowerCase();
      if (!action) {
        return json({ ok: false, error: "action required" });
      }

      try {
        await ensureLoaded();

        if (!cfg.enabled) {
          return json({
            ok: false,
            error: "plugin_disabled",
            hint: "Enable via plugins.entries.evening-planner.enabled=true",
          });
        }

        if (action === "start_session") {
          return json({
            ok: true,
            session: await startSession(params),
          });
        }

        if (action === "list_sessions") {
          return json({
            ok: true,
            sessions: Array.from(sessions.values()).map(summarizeSession),
          });
        }

        if (action === "status") {
          const sessionId = readString(params, "sessionId");
          if (!sessionId) {
            throw new Error("sessionId required");
          }
          return json({
            ok: true,
            session: summarizeSession(getSessionOrThrow(sessionId)),
          });
        }

        if (action === "cancel_session") {
          const sessionId = readString(params, "sessionId");
          if (!sessionId) {
            throw new Error("sessionId required");
          }
          const session = getSessionOrThrow(sessionId);
          session.status = "cancelled";
          session.updatedAtMs = Date.now();
          session.timeline.push({
            ts: Date.now(),
            step: "coordinate_with_shubham",
            state: "blocked",
            note: "cancelled_by_user",
          });
          sessions.set(session.id, session);
          await persist();
          return json({
            ok: true,
            session: summarizeSession(session),
          });
        }

        if (action === "ingest_reply") {
          const sessionId = readString(params, "sessionId");
          const text = readString(params, "text");
          if (!sessionId || !text) {
            throw new Error("sessionId and text required");
          }
          const session = getSessionOrThrow(sessionId);
          return json({
            ok: true,
            ...(await ingestReply({ session, text })),
          });
        }

        if (action === "search_venues") {
          const query = readString(params, "query");
          if (!query) {
            throw new Error("query required");
          }
          const result = await searchDineout({
            cfg: swiggyCfg,
            runner: api.runtime.system.runCommandWithTimeout,
            input: {
              query,
              location: readString(params, "location"),
            },
          });
          return json({ ok: result.ok, result });
        }

        if (action === "check_slots") {
          const restaurantId = readString(params, "restaurantId");
          const date = readString(params, "date");
          if (!restaurantId || !date) {
            throw new Error("restaurantId and date required");
          }
          const result = await checkDineoutSlots({
            cfg: swiggyCfg,
            runner: api.runtime.system.runCommandWithTimeout,
            input: { restaurantId, date },
          });
          return json({ ok: result.ok, result });
        }

        if (action === "prepare_booking") {
          const sessionId = readString(params, "sessionId");
          const restaurantId = readString(params, "restaurantId");
          const date = readString(params, "date");
          const time = readString(params, "time");
          if (!sessionId || !restaurantId || !date || !time) {
            throw new Error("sessionId, restaurantId, date, time required");
          }
          const session = getSessionOrThrow(sessionId);
          const seats = Math.max(
            1,
            Math.floor(readNumber(params, "guests") ?? recommendedSeats(session)),
          );
          session.bookingDraft = {
            restaurantId,
            restaurantName: readString(params, "restaurantName"),
            date,
            time,
            seats,
            preparedAtMs: Date.now(),
            command: [
              swiggyCfg.command,
              "dineout",
              "book",
              restaurantId,
              "--date",
              date,
              "--time",
              time,
              "--guests",
              String(seats),
              "--confirm",
            ],
          };
          session.bookingResult = { status: "prepared" };
          session.timeline.push({
            ts: Date.now(),
            step: "booking_confirmation",
            state: "running",
            note: "prepared_waiting_for_confirm",
          });
          session.updatedAtMs = Date.now();
          sessions.set(session.id, session);
          await persist();
          return json({
            ok: true,
            requiresFinalConfirmation: true,
            session: summarizeSession(session),
          });
        }

        if (action === "book_table") {
          const sessionId = readString(params, "sessionId");
          if (!sessionId) {
            throw new Error("sessionId required");
          }
          const confirm = readBoolean(params, "confirm") === true;
          const session = getSessionOrThrow(sessionId);
          if (!confirm) {
            return json({
              ok: false,
              error: "booking_confirm_required",
              session: summarizeSession(session),
            });
          }
          if (!session.bookingDraft) {
            throw new Error("prepare_booking required before book_table");
          }
          const result = await bookDineoutTable({
            cfg: swiggyCfg,
            runner: api.runtime.system.runCommandWithTimeout,
            input: {
              restaurantId: session.bookingDraft.restaurantId,
              date: session.bookingDraft.date,
              time: session.bookingDraft.time,
              guests: session.bookingDraft.seats,
              confirm: true,
            },
          });
          session.bookingResult = result.ok
            ? {
                status: "booked",
                mode: result.mode,
                details: result.payload,
                bookedAtMs: Date.now(),
              }
            : {
                status: "failed",
                mode: result.mode,
                details: result.payload,
                error: result.error,
              };
          session.status = result.ok ? "completed" : session.status;
          session.timeline.push({
            ts: Date.now(),
            step: "booking_execution",
            state: result.ok ? "done" : "blocked",
            note: result.ok ? "booked" : "booking_failed",
          });
          session.updatedAtMs = Date.now();
          sessions.set(session.id, session);
          await persist();
          return json({
            ok: result.ok,
            result,
            session: summarizeSession(session),
          });
        }

        return json({
          ok: false,
          error: `unsupported_action: ${action}`,
        });
      } catch (err) {
        return json({
          ok: false,
          action,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  });
}
