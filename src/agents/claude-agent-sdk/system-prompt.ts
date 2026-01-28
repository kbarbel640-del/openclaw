/**
 * System prompt additions for Claude Code SDK.
 *
 * The SDK builds its own comprehensive system prompt with workspace context,
 * tools, git status, etc. This module provides a small extension point for
 * adding Moltbot-specific context the SDK can't know about.
 *
 * These additions are **prepended** to the SDK's native system prompt.
 */

/**
 * Context available to prompt enrichers.
 */
export type PromptEnricherContext = {
  /** Moltbot agent ID (e.g., "main", "work"). */
  agentId?: string;
  /** Session key for routing. */
  sessionKey?: string;
  /** Agent workspace directory. */
  workspaceDir?: string;
  /** User's timezone (e.g., "America/New_York"). */
  timezone?: string;
  /** Messaging channel (e.g., "telegram", "slack", "whatsapp"). */
  channel?: string;
  /** Channel-specific hints or instructions. */
  channelHints?: string;
  /** Available Moltbot skills. */
  skills?: string[];
  /** Sender identifier. */
  senderId?: string | null;
  /** Sender display name. */
  senderName?: string | null;
  /** Sender username. */
  senderUsername?: string | null;
  /** Sender E.164 phone number. */
  senderE164?: string | null;
  /** Additional custom context. */
  custom?: Record<string, unknown>;
};

/**
 * A prompt enricher adds context to the system prompt.
 *
 * Returns a string to add, or undefined/null to skip.
 */
export type PromptEnricher = (context: PromptEnricherContext) => string | undefined | null;

/**
 * Registry of prompt enrichers.
 */
const enrichers: PromptEnricher[] = [];

/**
 * Register a prompt enricher.
 *
 * Enrichers are called in registration order. Each can add a line or
 * paragraph of context to the system prompt additions.
 */
export function registerPromptEnricher(enricher: PromptEnricher): void {
  enrichers.push(enricher);
}

/**
 * Clear all registered enrichers (for testing).
 */
export function clearPromptEnrichers(): void {
  enrichers.length = 0;
}

/**
 * Get count of registered enrichers (for testing).
 */
export function getEnricherCount(): number {
  return enrichers.length;
}

// ─── Built-in Enrichers ──────────────────────────────────────────────────────

/**
 * Agent identity enricher.
 */
const agentIdentityEnricher: PromptEnricher = (ctx) => {
  if (!ctx.agentId) return null;
  return `You are Moltbot agent "${ctx.agentId}".`;
};

/**
 * Timezone enricher.
 */
const timezoneEnricher: PromptEnricher = (ctx) => {
  if (!ctx.timezone) return null;
  return `User timezone: ${ctx.timezone}`;
};

/**
 * Channel hints enricher.
 */
const channelEnricher: PromptEnricher = (ctx) => {
  if (!ctx.channel && !ctx.channelHints) return null;

  const parts: string[] = [];
  if (ctx.channel) {
    parts.push(`Messaging channel: ${ctx.channel}`);
  }
  if (ctx.channelHints) {
    parts.push(ctx.channelHints);
  }
  return parts.join("\n");
};

/**
 * Skills enricher.
 */
const skillsEnricher: PromptEnricher = (ctx) => {
  if (!ctx.skills?.length) return null;
  return `Available Moltbot skills: ${ctx.skills.join(", ")}`;
};

/**
 * Sender context enricher.
 *
 * Provides sender identity information to help the model understand
 * who is making the request.
 */
const senderEnricher: PromptEnricher = (ctx) => {
  const parts: string[] = [];

  if (ctx.senderName) {
    parts.push(`Sender name: ${ctx.senderName}`);
  }
  if (ctx.senderUsername) {
    parts.push(`Sender username: @${ctx.senderUsername}`);
  }
  if (ctx.senderId && !ctx.senderName && !ctx.senderUsername) {
    // Only include raw ID if no friendly identifier is available
    parts.push(`Sender ID: ${ctx.senderId}`);
  }

  if (parts.length === 0) return null;
  return parts.join("\n");
};

// Register built-in enrichers
registerPromptEnricher(agentIdentityEnricher);
registerPromptEnricher(timezoneEnricher);
registerPromptEnricher(channelEnricher);
registerPromptEnricher(skillsEnricher);
registerPromptEnricher(senderEnricher);

// ─── Main API ────────────────────────────────────────────────────────────────

/**
 * Build system prompt additions for the Claude Code SDK.
 *
 * Runs all registered enrichers and combines their output.
 * Returns undefined if no additions are needed.
 */
export function buildSystemPromptAdditions(context: PromptEnricherContext): string | undefined {
  const parts: string[] = [];

  for (const enricher of enrichers) {
    try {
      const result = enricher(context);
      if (result) {
        parts.push(result.trim());
      }
    } catch {
      // Skip failed enrichers silently
    }
  }

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join("\n\n");
}

/**
 * Build system prompt additions from run parameters.
 *
 * Convenience wrapper that extracts context from common param shapes.
 */
export function buildSystemPromptAdditionsFromParams(params: {
  agentId?: string;
  sessionKey?: string;
  workspaceDir?: string;
  timezone?: string;
  messageChannel?: string;
  channelHints?: string;
  skills?: string[];
  senderId?: string | null;
  senderName?: string | null;
  senderUsername?: string | null;
  senderE164?: string | null;
}): string | undefined {
  return buildSystemPromptAdditions({
    agentId: params.agentId ?? params.sessionKey?.split(":")[0],
    sessionKey: params.sessionKey,
    workspaceDir: params.workspaceDir,
    timezone: params.timezone,
    channel: params.messageChannel,
    channelHints: params.channelHints,
    skills: params.skills,
    senderId: params.senderId,
    senderName: params.senderName,
    senderUsername: params.senderUsername,
    senderE164: params.senderE164,
  });
}
