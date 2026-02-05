import { getWebexRuntime } from "./runtime.js";
import type { ResolvedWebexAccount, WebexConfig } from "./types.js";

/**
 * Options for sending a Webex message
 */
export interface WebexSendOptions {
  /** Account ID to use for sending (defaults to "default") */
  accountId?: string;
  /** Markdown-formatted message text */
  markdown?: string;
  /** List of file URLs to attach */
  files?: string[];
}

/**
 * Result of sending a Webex message
 */
export interface WebexSendResult {
  /** Whether the message was sent successfully */
  ok: boolean;
  /** Webex message ID if successful */
  messageId?: string;
  /** Error message if unsuccessful */
  error?: string;
}

/**
 * Send a message via Webex API
 * 
 * @param target - Email address, person ID, or room ID to send to
 * @param text - Plain text message content
 * @param options - Additional send options
 * @returns Promise resolving to send result
 */
export async function sendWebexMessage(
  target: string,
  text: string,
  options: WebexSendOptions = {},
): Promise<WebexSendResult> {
  if (!target?.trim()) {
    return {
      ok: false,
      error: "Target is required",
    };
  }

  const account = await resolveWebexAccount(options.accountId);

  if (!account || !account.token) {
    return {
      ok: false,
      error: "Webex token not configured",
    };
  }

  try {
    const payload: Record<string, unknown> = {
      text: text || "",
    };

    // Add markdown if provided and different from text
    if (options.markdown && options.markdown !== text) {
      payload.markdown = options.markdown;
    }

    // Determine target type and set appropriate field
    if (target.includes("@") && target.includes(".")) {
      // Email address - direct message
      payload.toPersonEmail = target;
    } else if (target.startsWith("Y2lzY29zcGFyazovL3VzL1BFT1BMRS8")) {
      // Person ID - direct message
      payload.toPersonId = target;
    } else if (target.startsWith("Y2lzY29zcGFyazovL3VzL1JPT00v")) {
      // Room ID
      payload.roomId = target;
    } else {
      // Fallback: assume it's a room ID or try as-is
      payload.roomId = target;
    }

    // Add files if provided
    if (options.files && options.files.length > 0) {
      payload.files = options.files;
    }

    const response = await fetch("https://webexapis.com/v1/messages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${account.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const result = await response.json();
    return {
      ok: true,
      messageId: result.id,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Resolve Webex account configuration from OpenClaw config
 * 
 * @param accountId - Account ID to resolve (defaults to "default")
 * @returns Promise resolving to account or null if not found
 */
async function resolveWebexAccount(
  accountId?: string,
): Promise<ResolvedWebexAccount | null> {
  try {
    const runtime = getWebexRuntime();
    const cfg = runtime.config.loadConfig();

    const webexConfig = cfg.channels?.webex as WebexConfig | undefined;
    if (!webexConfig) {
      return null;
    }

    const resolvedAccountId = accountId || "default";
    let token = "";
    let tokenSource: "config" | "file" | "env" | "none" = "none";

    // Try account-specific config first
    const accountConfig = webexConfig.accounts?.[resolvedAccountId];
    if (accountConfig) {
      if (accountConfig.botToken) {
        token = accountConfig.botToken;
        tokenSource = "config";
      } else if (accountConfig.tokenFile) {
        try {
          const fs = await import("node:fs/promises");
          token = (await fs.readFile(accountConfig.tokenFile, "utf-8")).trim();
          tokenSource = "file";
        } catch {
          // File read failed, keep token empty
        }
      }
    }

    // Fall back to main config if no account-specific token
    if (!token && resolvedAccountId === "default") {
      if (webexConfig.botToken) {
        token = webexConfig.botToken;
        tokenSource = "config";
      } else if (webexConfig.tokenFile) {
        try {
          const fs = await import("node:fs/promises");
          token = (await fs.readFile(webexConfig.tokenFile, "utf-8")).trim();
          tokenSource = "file";
        } catch {
          // File read failed, keep token empty
        }
      }
    }

    // Try environment variable for default account
    if (!token && resolvedAccountId === "default") {
      const envToken = process.env.WEBEX_BOT_TOKEN?.trim();
      if (envToken) {
        token = envToken;
        tokenSource = "env";
      }
    }

    return {
      accountId: resolvedAccountId,
      enabled: accountConfig?.enabled ?? webexConfig.enabled ?? false,
      token,
      tokenSource,
      config: accountConfig || webexConfig,
      name: accountConfig?.name || webexConfig.name,
    };
  } catch {
    return null;
  }
}