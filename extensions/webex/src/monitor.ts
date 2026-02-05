import type { IncomingMessage, ServerResponse } from "node:http";
import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { logInboundDrop } from "openclaw/plugin-sdk";
import type { ResolvedWebexAccount, WebexWebhookEvent, WebexMessage, WebexPerson } from "./types.js";
import { getWebexRuntime } from "./runtime.js";
import { sendWebexMessage } from "./send.js";

/**
 * Runtime environment for Webex monitoring
 */
export interface WebexRuntimeEnv {
  /** Log function for informational messages */
  log?: (message: string) => void;
  /** Error function for error messages */
  error?: (message: string) => void;
}

/**
 * Options for monitoring Webex webhooks
 */
export interface WebexMonitorOptions {
  /** Resolved Webex account */
  account: ResolvedWebexAccount;
  /** OpenClaw configuration */
  config: OpenClawConfig;
  /** Runtime environment */
  runtime: WebexRuntimeEnv;
  /** Abort signal for cancellation */
  abortSignal: AbortSignal;
  /** Status update sink */
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
  /** Custom webhook path */
  webhookPath?: string;
  /** Webhook URL */
  webhookUrl?: string;
  /** Webhook secret for validation */
  webhookSecret?: string;
}

const DEFAULT_WEBHOOK_PATH = "/webex-webhook";

/**
 * Internal webhook target configuration
 */
interface WebhookTarget {
  /** Resolved account configuration */
  account: ResolvedWebexAccount;
  /** OpenClaw configuration */
  config: OpenClawConfig;
  /** Runtime environment */
  runtime: WebexRuntimeEnv;
  /** Status update sink */
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
  /** Webhook secret */
  webhookSecret?: string;
}

/**
 * Map of webhook paths to their handlers
 */
const webhookTargets = new Map<string, WebhookTarget>();

/**
 * Normalize webhook path by removing trailing slashes
 * 
 * @param path - Raw webhook path
 * @returns Normalized path
 */
function normalizeWebhookPath(path: string): string {
  return path.replace(/\/+$/, "") || "/";
}

/**
 * Top-level HTTP handler registered at plugin load time
 * 
 * This function is called for all HTTP requests and determines
 * if they should be handled by the Webex webhook processor.
 * 
 * @param req - Incoming HTTP request
 * @param res - HTTP response object
 * @returns Promise resolving to true if handled, false to pass through
 */
export async function handleWebexWebhookRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = normalizeWebhookPath(url.pathname);
  const target = webhookTargets.get(path);

  if (!target) {
    return false; // Not our path, let other handlers try
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end("Method Not Allowed");
    return true;
  }

  try {
    await handleWebexWebhook(req, res, target);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    target.runtime.error?.(`webhook error: ${errorMessage}`);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  }
  return true;
}

/**
 * Start monitoring for a Webex account
 * 
 * This function registers the webhook target and sets up the webhook
 * with Webex API. It resolves when the monitoring is aborted.
 * 
 * @param options - Monitor options
 * @returns Promise that resolves when monitoring stops
 */
export async function monitorWebexProvider(options: WebexMonitorOptions): Promise<void> {
  const { account, config, runtime, abortSignal, statusSink, webhookPath, webhookUrl, webhookSecret } = options;

  const resolvedWebhookPath = normalizeWebhookPath(
    webhookPath || account.config.webhookPath || DEFAULT_WEBHOOK_PATH
  );
  const resolvedWebhookUrl = webhookUrl || account.config.webhookUrl;
  const resolvedWebhookSecret = webhookSecret || account.config.webhookSecret;

  if (!resolvedWebhookUrl) {
    throw new Error("webhookUrl is required. Configure channels.webex.webhookUrl with your public URL.");
  }

  // Register this account as a webhook target
  webhookTargets.set(resolvedWebhookPath, {
    account,
    config,
    runtime,
    statusSink,
    webhookSecret: resolvedWebhookSecret,
  });
  runtime.log?.(`[${account.accountId}] webhook target registered at ${resolvedWebhookPath}`);

  // Register/update webhook with Webex API
  const fullWebhookUrl = resolvedWebhookUrl.replace(/\/+$/, "") + resolvedWebhookPath;
  await registerWebexWebhook(account.token, fullWebhookUrl, resolvedWebhookSecret);
  runtime.log?.(`[${account.accountId}] registered webhook with Webex: ${fullWebhookUrl}`);

  // Keep alive until aborted
  return new Promise<void>((resolve) => {
    const cleanup = () => {
      webhookTargets.delete(resolvedWebhookPath);
      runtime.log?.(`[${account.accountId}] webhook monitor stopped`);
      resolve();
    };
    if (abortSignal.aborted) {
      cleanup();
      return;
    }
    abortSignal.addEventListener("abort", cleanup, { once: true });
  });
}

// ── Webhook Processing ──────────────────────────────────────────────

/**
 * Handle an incoming Webex webhook request
 * 
 * @param req - HTTP request
 * @param res - HTTP response
 * @param context - Webhook context
 */
async function handleWebexWebhook(
  req: IncomingMessage,
  res: ServerResponse,
  context: WebhookTarget,
): Promise<void> {
  const { account, config, runtime, statusSink, webhookSecret } = context;

  // Read request body
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString("utf-8");

  // Validate webhook secret if configured
  // Note: Webex uses simple shared secret validation via X-Webex-Secret header
  if (webhookSecret) {
    const providedSecret = req.headers["x-webex-secret"] as string;
    if (providedSecret !== webhookSecret) {
      runtime.error?.(`[${account.accountId}] webhook secret mismatch`);
      res.statusCode = 401;
      res.end("Unauthorized");
      return;
    }
  }

  // Parse webhook event
  let event: WebexWebhookEvent;
  try {
    event = JSON.parse(body);
  } catch {
    runtime.error?.(`[${account.accountId}] invalid JSON in webhook body`);
    res.statusCode = 400;
    res.end("Bad Request");
    return;
  }

  // Only handle new message events
  if (event.resource !== "messages" || event.event !== "created") {
    res.statusCode = 200;
    res.end("OK");
    return;
  }

  const messageId = event.data?.id;
  if (!messageId) {
    runtime.error?.(`[${account.accountId}] missing message ID in webhook`);
    res.statusCode = 400;
    res.end("Bad Request");
    return;
  }

  // Respond immediately (Webex expects fast 200 responses)
  res.statusCode = 200;
  res.end("OK");

  // Process the message asynchronously
  try {
    // Fetch full message details
    const message = await fetchWebexMessage(account.token, messageId);
    if (!message) {
      runtime.error?.(`[${account.accountId}] failed to fetch message ${messageId}`);
      return;
    }

    // Skip messages from the bot itself
    const botInfo = await getBotInfo(account.token);
    if (botInfo && message.personId === botInfo.id) {
      return;
    }

    if (statusSink) {
      statusSink({ lastInboundAt: Date.now() });
    }

    await processWebexMessage(message, { config, account, runtime, statusSink });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    runtime.error?.(`[${account.accountId}] message processing error: ${errorMessage}`);
  }
}

// ── Message Processing ──────────────────────────────────────────────

/**
 * Log a verbose message with consistent formatting
 * 
 * @param runtime - Runtime environment
 * @param msg - Message to log
 */
function logVerbose(runtime: WebexRuntimeEnv, msg: string): void {
  runtime.log?.(`[webex] ${msg}`);
}

/**
 * Process an incoming Webex message
 * 
 * @param message - Webex message object
 * @param context - Processing context
 */
async function processWebexMessage(
  message: WebexMessage,
  context: {
    config: OpenClawConfig;
    account: ResolvedWebexAccount;
    runtime: WebexRuntimeEnv;
    statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
  },
): Promise<void> {
  const { config, account, runtime, statusSink } = context;
  const core = getWebexRuntime();

  // Skip empty messages
  const text = (message.text ?? "").trim();
  if (!text) {
    logVerbose(runtime, `drop: empty text sender=${message.personEmail}`);
    return;
  }

  const isGroup = message.roomType !== "direct";
  const chatType = isGroup ? "group" : "direct";
  const senderId = message.personEmail ?? message.personId ?? "unknown";

  // Apply DM policy
  const dmPolicy = account.config.dmPolicy || "pairing";
  const configAllowFrom = (account.config.allowFrom ?? []).map(String);
  
  let storeAllowFrom: string[] = [];
  try {
    storeAllowFrom = await core.channel.pairing.readAllowFromStore("webex");
  } catch {
    // If pairing store read fails, continue with empty array
  }
  
  const effectiveAllowFrom = [...configAllowFrom, ...storeAllowFrom]
    .map((entry) => String(entry).trim().toLowerCase())
    .filter(Boolean);

  if (!isGroup) {
    if (dmPolicy === "disabled") {
      logInboundDrop({
        log: (msg: string) => logVerbose(runtime, msg),
        channel: "webex",
        reason: "dm-disabled",
        target: senderId,
      });
      return;
    }

    if (dmPolicy !== "open") {
      const normalizedSender = senderId.toLowerCase();
      const isAllowed = effectiveAllowFrom.some(
        (entry) =>
          entry === normalizedSender ||
          entry === (message.personId ?? "").toLowerCase(),
      );

      if (!isAllowed) {
        if (dmPolicy === "pairing") {
          const { code, created } = await core.channel.pairing.upsertPairingRequest({
            channel: "webex",
            id: senderId,
            meta: { name: message.personEmail },
          });
          runtime.log?.(`[webex] pairing request sender=${senderId} created=${created}`);
          if (created) {
            try {
              await sendWebexMessage(senderId, core.channel.pairing.buildPairingReply({
                channel: "webex",
                idLine: `Your Webex email: ${senderId}`,
                code,
              }), { accountId: account.accountId });
              statusSink?.({ lastOutboundAt: Date.now() });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              runtime.error?.(`[webex] pairing reply failed sender=${senderId}: ${errorMessage}`);
            }
          }
        } else {
          logInboundDrop({
            log: (msg: string) => logVerbose(runtime, msg),
            channel: "webex",
            reason: `dm-unauthorized (dmPolicy=${dmPolicy})`,
            target: senderId,
          });
        }
        return;
      }
    }
  }

  // Resolve routing
  const peerId = isGroup ? (message.roomId ?? "group") : senderId;
  const outboundTarget = isGroup ? message.roomId! : senderId;

  const route = core.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: "webex",
    accountId: account.accountId,
    peer: {
      kind: isGroup ? "group" : "dm",
      id: peerId,
    },
  });

  // Handle mentions in groups
  const mentionRegexes = core.channel.mentions.buildMentionRegexes(config, route.agentId);
  const wasMentioned = isGroup
    ? core.channel.mentions.matchesMentionPatterns(text, mentionRegexes)
    : true;

  // In groups, skip if not mentioned (unless it's a command)
  if (isGroup && !wasMentioned && mentionRegexes.length > 0) {
    logVerbose(runtime, `drop: group message without mention sender=${senderId}`);
    return;
  }

  // Resolve session storage
  const storePath = core.channel.session.resolveStorePath(
    config.session?.store,
    { agentId: route.agentId },
  );

  // Build agent envelope
  const fromLabel = message.personEmail ?? senderId;
  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(config);
  const previousTimestamp = core.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey,
  });
  const body = core.channel.reply.formatAgentEnvelope({
    channel: "Webex",
    from: fromLabel,
    timestamp: new Date(message.created).getTime(),
    previousTimestamp,
    envelope: envelopeOptions,
    body: text,
  });

  // Record session metadata
  try {
    await core.channel.session.recordInboundSession({
      storePath,
      sessionKey: route.sessionKey,
      ctx: {
        channel: "webex",
        accountId: account.accountId,
        chatType,
        peer: peerId,
        sender: senderId,
      },
      updateLastRoute: {
        sessionKey: route.sessionKey,
        channel: "webex",
        to: `webex:${outboundTarget}`,
        accountId: account.accountId,
      },
      onRecordError: (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        runtime.error?.(`[webex] session record error: ${errorMessage}`);
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    runtime.error?.(`[webex] session record error: ${errorMessage}`);
  }

  // Build context payload for the agent
  const ctxPayload = {
    Body: body,
    BodyForAgent: body,
    RawBody: text,
    CommandBody: text,
    BodyForCommands: text,
    From: isGroup ? `group:${peerId}` : `webex:${senderId}`,
    To: `webex:${outboundTarget}`,
    SessionKey: route.sessionKey,
    AccountId: account.accountId,
    ChatType: chatType,
    ConversationLabel: fromLabel,
    SenderName: message.personEmail ?? undefined,
    SenderId: senderId,
    Provider: "webex",
    Surface: "webex",
    MessageSid: message.id,
    Timestamp: new Date(message.created).getTime(),
    OriginatingChannel: "webex",
    OriginatingTo: `webex:${outboundTarget}`,
    WasMentioned: wasMentioned,
    CommandAuthorized: !isGroup || wasMentioned,
  };

  // Dispatch to agent
  try {
    await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
      ctx: ctxPayload,
      cfg: config,
      dispatcherOptions: {
        deliver: async (payload: any) => {
          const replyText = payload.text ?? "";
          if (!replyText.trim()) return;

          const tableMode = core.channel.text.resolveMarkdownTableMode({
            cfg: config,
            channel: "webex",
            accountId: account.accountId,
          });
          const formattedText = core.channel.text.convertMarkdownTables(replyText, tableMode);

          // Handle media attachments
          const mediaList = payload.mediaUrls?.length
            ? payload.mediaUrls
            : payload.mediaUrl
              ? [payload.mediaUrl]
              : [];

          if (mediaList.length > 0) {
            let first = true;
            for (const mediaUrl of mediaList) {
              const caption = first ? formattedText : undefined;
              first = false;
              await sendWebexMessage(outboundTarget, caption ?? "", {
                accountId: account.accountId,
                markdown: caption,
                files: [mediaUrl],
              });
              statusSink?.({ lastOutboundAt: Date.now() });
            }
          } else {
            await sendWebexMessage(outboundTarget, formattedText, {
              accountId: account.accountId,
              markdown: formattedText,
            });
            statusSink?.({ lastOutboundAt: Date.now() });
          }
        },
        onError: (error: any) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          runtime.error?.(`[webex] reply delivery failed: ${errorMessage}`);
        },
      },
      replyOptions: {},
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    runtime.error?.(`[${account.accountId}] message processing error: ${errorMessage}`);
  }
}

// ── Webex API Helpers ───────────────────────────────────────────────

/**
 * Fetch a Webex message by ID
 * 
 * @param token - Webex bot token
 * @param messageId - Message ID to fetch
 * @returns Promise resolving to message or null if not found
 */
async function fetchWebexMessage(token: string, messageId: string): Promise<WebexMessage | null> {
  try {
    const response = await fetch(`https://webexapis.com/v1/messages/${messageId}`, {
      headers: { 
        "Authorization": `Bearer ${token}`, 
        "Content-Type": "application/json" 
      },
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

/**
 * Bot information cache
 */
let cachedBotInfo: { id: string; email: string } | null = null;

/**
 * Get bot information from Webex API
 * 
 * @param token - Webex bot token
 * @returns Promise resolving to bot info or null
 */
async function getBotInfo(token: string): Promise<{ id: string; email: string } | null> {
  if (cachedBotInfo) return cachedBotInfo;
  
  try {
    const response = await fetch("https://webexapis.com/v1/people/me", {
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (!response.ok) return null;
    
    const data = await response.json();
    cachedBotInfo = { 
      id: data.id, 
      email: data.emails?.[0] 
    };
    return cachedBotInfo;
  } catch {
    return null;
  }
}

/**
 * Register or update a webhook with Webex API
 * 
 * @param token - Webex bot token
 * @param webhookUrl - Full webhook URL
 * @param secret - Optional webhook secret
 */
async function registerWebexWebhook(token: string, webhookUrl: string, secret?: string): Promise<void> {
  try {
    // List existing webhooks to avoid duplicates
    const listResponse = await fetch("https://webexapis.com/v1/webhooks", {
      headers: { "Authorization": `Bearer ${token}` },
    });
    
    if (listResponse.ok) {
      const { items } = await listResponse.json();
      
      // Find existing OpenClaw webhook
      const existing = items?.find(
        (webhook: any) => 
          webhook.resource === "messages" && 
          webhook.event === "created" && 
          webhook.name === "OpenClaw Webex Bot",
      );
      
      if (existing) {
        if (existing.targetUrl === webhookUrl) {
          // Webhook already exists with correct URL
          return;
        }
        
        // Update existing webhook
        const updateResponse = await fetch(`https://webexapis.com/v1/webhooks/${existing.id}`, {
          method: "PUT",
          headers: { 
            "Authorization": `Bearer ${token}`, 
            "Content-Type": "application/json" 
          },
          body: JSON.stringify({
            name: "OpenClaw Webex Bot",
            targetUrl: webhookUrl,
            ...(secret ? { secret } : {}),
          }),
        });
        
        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          throw new Error(`Failed to update webhook: HTTP ${updateResponse.status}: ${errorText}`);
        }
        
        return;
      }
    }

    // Create new webhook
    const createResponse = await fetch("https://webexapis.com/v1/webhooks", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${token}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        name: "OpenClaw Webex Bot",
        targetUrl: webhookUrl,
        resource: "messages",
        event: "created",
        ...(secret ? { secret } : {}),
      }),
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create webhook: HTTP ${createResponse.status}: ${errorText}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Webhook registration failed: ${errorMessage}`);
  }
}