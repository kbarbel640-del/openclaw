import type { ChannelAgentTool } from "clawdbot/plugin-sdk";
import { AgentMailToolkit } from "agentmail-toolkit/clawdbot";

import { getResolvedCredentials } from "./client.js";
import { AgentMailClient } from "agentmail";

/**
 * Returns all AgentMail agent tools.
 * Returns empty array if AgentMail is not configured (no token).
 */
export function createAgentMailTools(): ChannelAgentTool[] {
  const { apiKey } = getResolvedCredentials();
  if (!apiKey) return [];

  const client = new AgentMailClient({ apiKey });
  const toolkit = new AgentMailToolkit(client);
  return toolkit.getTools();
}
