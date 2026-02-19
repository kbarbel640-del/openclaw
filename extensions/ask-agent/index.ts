import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { Agent } from "../../src/ai-fabric/types.js";
import { normalizeAgentStatus } from "../../src/ai-fabric/agent-status.js";
import { CloudruA2AClient, A2AError } from "../../src/ai-fabric/cloudru-a2a-client.js";
import { CloudruAuthError } from "../../src/ai-fabric/cloudru-auth.js";
import { CloudruSimpleClient } from "../../src/ai-fabric/cloudru-client-simple.js";
import { resolveIamSecret } from "../../src/ai-fabric/resolve-iam-secret.js";

// ---------------------------------------------------------------------------
// Agent resolution — modular, reusable
// ---------------------------------------------------------------------------

export type ResolvedAgent = { ok: true; agent: Agent } | { ok: false; error: string };

export function resolveAgent(agents: Agent[], query: string): ResolvedAgent {
  // Exact ID match
  const byId = agents.find((a) => a.id === query);
  if (byId) {
    return { ok: true, agent: byId };
  }

  // Exact name match (case-insensitive)
  const lowerQuery = query.toLowerCase();
  const byName = agents.find((a) => a.name.toLowerCase() === lowerQuery);
  if (byName) {
    return { ok: true, agent: byName };
  }

  // Substring match
  const matches = agents.filter((a) => a.name.toLowerCase().includes(lowerQuery));
  if (matches.length === 1) {
    return { ok: true, agent: matches[0] };
  }

  if (matches.length > 1) {
    const list = matches
      .map((a) => `  - ${a.name} (${normalizeAgentStatus(a.status)}, ID: ${a.id.slice(0, 8)})`)
      .join("\n");
    return {
      ok: false,
      error: `Multiple agents match "${query}":\n${list}\n\nPlease specify the exact agent name or ID.`,
    };
  }

  // No match — show available agents
  const list = agents.map((a) => `  - ${a.name} (${normalizeAgentStatus(a.status)})`).join("\n");
  return {
    ok: false,
    error:
      agents.length > 0
        ? `Agent "${query}" not found. Available agents:\n${list}`
        : `No agents found in this project.`,
  };
}

// ---------------------------------------------------------------------------
// Response formatting — modular, reusable
// ---------------------------------------------------------------------------

export function formatAgentResponse(
  agentName: string,
  result: { ok: boolean; text: string; taskId?: string; sessionId?: string },
): string {
  const lines: string[] = [];

  if (!result.ok) {
    lines.push(`\u26A0 Agent "${agentName}" returned an error:`);
    lines.push("");
  } else {
    lines.push(`Agent: ${agentName}`);
    lines.push("");
  }

  lines.push(result.text);

  if (result.taskId || result.sessionId) {
    lines.push("");
    const meta: string[] = [];
    if (result.taskId) {
      meta.push(`Task: ${result.taskId.slice(0, 8)}`);
    }
    if (result.sessionId) {
      meta.push(`Session: ${result.sessionId.slice(0, 8)}`);
    }
    lines.push(meta.join(" | "));
  }

  return lines.join("\n");
}

export function formatA2AError(agentName: string, endpoint: string, err: A2AError): string {
  if (err.status === 401 || err.status === 403) {
    return `Access denied to agent "${agentName}". Your IAM credentials may lack permission for this agent.\n\nRun /status_agents to check agent statuses.`;
  }
  if (err.status === 404) {
    return `Agent "${agentName}" not found at ${endpoint}. It may have been deleted.\n\nRun /status_agents to check agent statuses.`;
  }
  if (err.status === 502 || err.status === 503) {
    return `Agent "${agentName}" is temporarily unavailable (HTTP ${err.status}). It may be starting up (cold start). Try again in a minute.\n\nRun /status_agents to check agent statuses.`;
  }
  if (err.message.includes("timed out")) {
    return `Agent "${agentName}" did not respond within the timeout. The agent may be starting up or overloaded.\n\nRun /status_agents to check agent statuses.`;
  }
  if (err.code) {
    return `Agent "${agentName}" returned an RPC error (code ${err.code}): ${err.message}\n\nRun /status_agents to check agent statuses.`;
  }
  return `Cannot reach agent "${agentName}" at ${endpoint}. Check your network connection.\n\nRun /status_agents to check agent statuses.`;
}

// ---------------------------------------------------------------------------
// Plugin registration
// ---------------------------------------------------------------------------

export default function register(api: OpenClawPluginApi) {
  api.registerCommand({
    name: "ask_agent",
    description: "Send a message to a Cloud.ru AI Fabric agent.",
    acceptsArgs: true,
    handler: async (ctx) => {
      const aiFabric = ctx.config.aiFabric;

      if (!aiFabric?.enabled) {
        return { text: "AI Fabric is not enabled. Run `openclaw onboard` to configure." };
      }

      const projectId = aiFabric.projectId ?? "";
      const keyId = aiFabric.keyId ?? "";
      const secret = resolveIamSecret();

      if (!projectId || !keyId || !secret) {
        return {
          text: "AI Fabric credentials incomplete. Ensure aiFabric.projectId, aiFabric.keyId, and CLOUDRU_IAM_SECRET are set.",
        };
      }

      // Parse args: first token = agent query, rest = message
      const raw = ctx.args?.trim() ?? "";
      const spaceIdx = raw.indexOf(" ");
      if (!raw || spaceIdx === -1) {
        return {
          text: "Usage: /ask_agent <agent-name> <message>\n\nExample: /ask_agent weather-agent What is the weather in Moscow?",
        };
      }

      const agentQuery = raw.slice(0, spaceIdx);
      const userMessage = raw.slice(spaceIdx + 1).trim();
      if (!userMessage) {
        return {
          text: "Please provide a message after the agent name.\n\nUsage: /ask_agent <agent-name> <message>",
        };
      }

      const authParams = { keyId, secret };

      // Discover agents from API
      let agents: Agent[];
      try {
        const client = new CloudruSimpleClient({
          projectId,
          auth: authParams,
        });
        const result = await client.listAgents({ limit: 100 });
        // Filter deleted agents, normalize status
        agents = result.data.filter((a) => {
          const s = normalizeAgentStatus(a.status);
          return s !== "DELETED" && s !== "ON_DELETION";
        });
      } catch (err) {
        if (err instanceof CloudruAuthError) {
          return {
            text: `Could not authenticate with Cloud.ru IAM. Check your keyId and CLOUDRU_IAM_SECRET.`,
          };
        }
        return { text: `Failed to list agents: ${(err as Error).message}` };
      }

      // Resolve agent
      const resolved = resolveAgent(agents, agentQuery);
      if (!resolved.ok) {
        return { text: resolved.error };
      }

      const agent = resolved.agent;
      const endpoint =
        (agent as Agent & { publicUrl?: string }).publicUrl ??
        `https://${agent.id}-agent.ai-agent.inference.cloud.ru`;

      // Send message via A2A
      try {
        const a2aClient = new CloudruA2AClient({ auth: authParams });
        const result = await a2aClient.sendMessage({
          endpoint,
          message: userMessage,
        });

        return { text: formatAgentResponse(agent.name, result) };
      } catch (err) {
        if (err instanceof A2AError) {
          return { text: formatA2AError(agent.name, endpoint, err) };
        }
        if (err instanceof CloudruAuthError) {
          return {
            text: `Could not authenticate with Cloud.ru IAM. Check your keyId and CLOUDRU_IAM_SECRET.\n\nRun /status_agents to check agent statuses.`,
          };
        }
        return {
          text: `Unexpected error: ${(err as Error).message}\n\nRun /status_agents to check agent statuses.`,
        };
      }
    },
  });
}
