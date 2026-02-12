import { initHttpClient } from "./client/http.js";
import { initCryptoMachine, getCryptoStorePath, closeMachine } from "./crypto/machine.js";
import { runSyncLoop } from "./client/sync.js";
import { sendMatrixMessage } from "./client/send.js";
import { isDmRoom, getRoomName } from "./client/rooms.js";
import { getMatrixRuntime } from "./runtime.js";
import type { MatrixEvent } from "./types.js";
import type { ResolvedMatrixAccount } from "./config.js";

/**
 * Monitor options — passed from gateway.startAccount() context.
 */
export interface MonitorMatrixOpts {
  config: unknown;
  account: ResolvedMatrixAccount;
  accountId: string;
  abortSignal: AbortSignal;
  log?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
  getStatus: () => any;
  setStatus: (next: any) => void;
}

/**
 * Start the Matrix monitor.
 *
 * This is called by gateway.startAccount() in channel.ts.
 * It initializes crypto, starts the sync loop, and dispatches
 * inbound messages to OpenClaw's auto-reply pipeline via MsgContext.
 */
export async function monitorMatrixProvider(
  opts: MonitorMatrixOpts
): Promise<void> {
  const { account, accountId, abortSignal, log, setStatus } = opts;

  if (!account.homeserver || !account.userId || !account.accessToken) {
    log?.error("[matrix] Missing required config (homeserver/userId/accessToken)");
    return;
  }

  log?.info(
    `[matrix] Starting monitor for ${account.userId} on ${account.homeserver}`
  );

  // 1. Initialize HTTP client
  initHttpClient(account.homeserver, account.accessToken);

  // 2. Initialize crypto machine
  const cryptoStorePath = getCryptoStorePath(
    account.homeserver,
    account.userId,
    account.accessToken
  );

  try {
    await initCryptoMachine(
      account.userId,
      account.deviceName,
      cryptoStorePath
    );
    log?.info(`[matrix] Crypto initialized (store: ${cryptoStorePath})`);
  } catch (err: any) {
    log?.error(`[matrix] Failed to initialize crypto: ${err.message}`);
    return;
  }

  // 3. Set up graceful shutdown via abortSignal
  abortSignal.addEventListener("abort", async () => {
    log?.info("[matrix] Shutting down (abortSignal)");
    await closeMachine();
  });

  setStatus({
    running: true,
    connected: false,
    lastStartAt: Date.now(),
  });

  // 4. Get OpenClaw runtime for dispatch
  const core = getMatrixRuntime();

  // 5. Build message handler
  function handleMessage(event: MatrixEvent, roomId: string): void {
    // Skip own messages
    if (event.sender === account.userId) return;

    // Access control
    const chatType = isDmRoom(roomId) ? "dm" : "group";

    if (chatType === "dm") {
      if (account.dm.policy === "disabled") return;
      if (
        account.dm.policy === "allowlist" &&
        !account.dm.allowFrom.includes(event.sender ?? "")
      ) {
        log?.info(
          `[matrix] Dropping DM from ${event.sender} (not in allowlist)`
        );
        return;
      }
    } else {
      if (account.groupPolicy === "disabled") return;
      if (account.groupPolicy === "allowlist") {
        const groupConfig = account.groups[roomId];
        if (!groupConfig?.allow) {
          // Check groupAllowFrom
          if (!account.groupAllowFrom.includes(event.sender ?? "")) {
            return;
          }
        }
      }
    }

    const body =
      typeof event.content?.body === "string" ? event.content.body : "";
    if (!body.trim()) return;

    log?.info(
      `[matrix] Message from ${event.sender} in ${roomId} (${chatType}): ${body.slice(0, 80)}...`
    );

    // Resolve which agent handles this message
    let route: any;
    try {
      route = core.channel.routing.resolveAgentRoute({
        cfg: opts.config,
        channel: "matrix",
        accountId,
        peer: {
          kind: chatType === "dm" ? "direct" : "group",
          id: chatType === "dm" ? event.sender : roomId,
        },
      });
      log?.info(`[matrix] Route resolved: agent=${route?.agentId}, session=${route?.sessionKey}`);
    } catch (routeErr: any) {
      log?.error(`[matrix] resolveAgentRoute failed: ${routeErr.message}`);
      return;
    }

    if (!route || !route.sessionKey) {
      log?.error(`[matrix] No route found for channel=matrix accountId=${accountId} peer=${chatType === "dm" ? event.sender : roomId}`);
      return;
    }

    // Build and finalize MsgContext for OpenClaw dispatch
    let ctxPayload: any;
    try {
      ctxPayload = core.channel.reply.finalizeInboundContext({
      Body: body,
      RawBody: body,
      CommandBody: body,
      From:
        chatType === "dm"
          ? `matrix:${event.sender}`
          : `matrix:room:${roomId}`,
      To: `matrix:${roomId}`,
      SessionKey: route.sessionKey,
      AccountId: accountId,
      ChatType: chatType === "dm" ? "direct" : "group",
      GroupSubject: chatType === "group" ? getRoomName(roomId) : undefined,
      SenderName: event.sender,
      SenderId: event.sender,
      Provider: "matrix",
      Surface: "matrix",
      MessageSid: event.event_id,
      OriginatingChannel: "matrix",
      OriginatingTo: roomId,
      Timestamp: event.origin_server_ts,
      CommandAuthorized: true,
    });

      log?.info(`[matrix] Context finalized, dispatching to agent...`);
    } catch (ctxErr: any) {
      log?.error(`[matrix] finalizeInboundContext failed: ${ctxErr.message}`);
      return;
    }

    // Dispatch to OpenClaw's auto-reply pipeline
    core.channel.reply
      .dispatchReplyWithBufferedBlockDispatcher({
        ctx: ctxPayload,
        cfg: opts.config,
        dispatcherOptions: {
          deliver: async (payload: any) => {
            const text = payload.text ?? "";
            if (!text.trim()) return;
            await sendMatrixMessage({
              roomId,
              text,
              replyToId: undefined,
            });
          },
          onError: (err: any, info: any) => {
            log?.error(
              `[matrix] ${info.kind} reply failed: ${String(err)}`
            );
          },
        },
      })
      .catch((err: any) => {
        log?.error(`[matrix] Dispatch failed: ${err.message}`);
      });
  }

  // 6. Run sync loop
  try {
    await runSyncLoop({
      userId: account.userId,
      cryptoStorePath,
      abortSignal,
      onMessage: handleMessage,
      log,
      setStatus,
      password: account.password,
      deviceName: account.deviceName,
    });
  } catch (err: any) {
    if (!abortSignal.aborted) {
      log?.error(`[matrix] Sync loop crashed: ${err.message}`);
      setStatus({
        connected: false,
        running: false,
        lastError: err.message,
      });
    }
  } finally {
    await closeMachine();
    setStatus({ running: false, connected: false });
    log?.info("[matrix] Monitor stopped");
  }
}
