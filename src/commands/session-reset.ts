import { formatErrorMessage } from "../infra/errors.js";
import type { RuntimeEnv } from "../runtime.js";
import { GatewayChatClient, resolveGatewayConnection } from "../tui/gateway-chat.js";

const DEFAULT_SESSION_KEY = "agent:main:main";

type SessionResetReason = "new" | "reset";

function resolveReason(raw: string | undefined): SessionResetReason | null {
  if (!raw) {
    return "new";
  }
  if (raw === "new" || raw === "reset") {
    return raw;
  }
  return null;
}

function normalizeSessionKey(raw: string | undefined): string {
  const key = raw?.trim();
  return key && key.length > 0 ? key : DEFAULT_SESSION_KEY;
}

function formatSessionResetError(err: unknown): string {
  const message = formatErrorMessage(err);
  const lower = message.toLowerCase();
  if (
    lower.includes("econnrefused") ||
    lower.includes("gateway closed") ||
    lower.includes("connect error")
  ) {
    return `Gateway is not running or unreachable. ${message}`;
  }
  if (lower.includes("session not found")) {
    return `Session not found. ${message}`;
  }
  return `Session reset failed: ${message}`;
}

export async function sessionResetCommand(
  opts: {
    sessionKey?: string;
    reason?: string;
    json?: boolean;
  },
  runtime: RuntimeEnv,
) {
  const reason = resolveReason(opts.reason);
  if (!reason) {
    runtime.error('--reason must be one of: "new", "reset"');
    runtime.exit(1);
    return;
  }

  const key = normalizeSessionKey(opts.sessionKey);
  const connection = resolveGatewayConnection({});
  const client = new GatewayChatClient(connection);

  try {
    client.start();
    await client.waitForReady();
    const result = await client.resetSession(key, reason);
    if (opts.json) {
      runtime.log(
        JSON.stringify(
          {
            ok: true,
            key,
            reason,
            result,
          },
          null,
          2,
        ),
      );
      return;
    }
    runtime.log(`Session reset: ${key} (${reason})`);
  } catch (err) {
    runtime.error(formatSessionResetError(err));
    runtime.exit(1);
  } finally {
    client.stop();
  }
}
