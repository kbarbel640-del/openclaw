/**
 * Fetch user's agents and build dynamic prompt section.
 *
 * This module calls the Identity Service API to get the user's available agents
 * and builds a prompt section describing them. This allows the LLM to match
 * user requests against agent descriptions and route to wexa-service tools.
 */

import type { WexaServiceConfig } from "./config.js";
import { makeIdentityServiceRequest } from "./http.js";

interface UserProject {
  agentKey: string;
  projectId: string;
  projectName: string;
  description: string;
  coworkerRole: string;
}

interface UserProjectsResponse {
  projects: UserProject[];
  total: number;
}

/**
 * Fetch user's agents and build a dynamic prompt describing them.
 *
 * @param config - Wexa service configuration with Identity Service URL
 * @param userId - The user's ID to fetch agents for
 * @returns Dynamic prompt section or null if no agents found
 */
export async function fetchUserAgentsPrompt(
  config: WexaServiceConfig,
  userId: string,
): Promise<string | null> {
  if (!userId) {
    return null;
  }

  try {
    const result = await makeIdentityServiceRequest(
      `/system/user-projects?userId=${encodeURIComponent(userId)}`,
      { method: "GET", config },
    );

    if (!result.success) {
      console.warn("[wexa-service] Failed to fetch user agents:", result.error);
      return null;
    }

    const data = result.data as UserProjectsResponse;
    const projects = data?.projects || [];

    if (projects.length === 0) {
      return null;
    }

    return buildAgentsPrompt(projects);
  } catch (err) {
    console.error("[wexa-service] Error fetching user agents:", err);
    return null;
  }
}

/**
 * Build the dynamic prompt section describing available agents.
 */
function buildAgentsPrompt(projects: UserProject[]): string {
  const rows = projects
    .map(
      (p) =>
        `| @${p.agentKey} | ${p.coworkerRole || "—"} | ${p.description || p.projectName} | ${p.projectId} |`,
    )
    .join("\n");

  return `## Your Available Agents

If the user's request matches an agent's description, use wexa-service tools.

| Agent | Role | Description | Project ID |
|-------|------|-------------|------------|
${rows}`;
}
