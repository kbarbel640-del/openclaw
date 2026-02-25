import { createSubsystemLogger } from "../logging/subsystem.js";
import { getGlobalDb } from "../infra/db.js";
import { callGateway } from "../gateway/call.js";
import { AGENT_LANE_SUBAGENT } from "../agents/lanes.js";
import { INTERNAL_MESSAGE_CHANNEL } from "../utils/message-channel.js";
import { SystemLogger } from "../infra/system-logger.js";
import { SystemHealth } from "../infra/system-health.js";

const log = createSubsystemLogger("hive/manager");

export interface TeamMember {
  role: string;
  agentId: string;
  specialty: string[];
}

export interface TeamDefinition {
  name: string;
  members: TeamMember[];
}

export class HiveManager {
  private db = getGlobalDb();

  async spawnTeam(params: {
    teamName: string;
    goal: string;
    parentSessionKey: string;
    workspaceId?: string;
  }): Promise<string[]> {
    try {
      log.info(`Spawning team '${params.teamName}' for goal: ${params.goal}`);

      const prompt = `Suggest a team of specialized sub-agents to achieve this goal: ${params.goal}.
Return a JSON array of team members with this structure:
[
  { "role": "Role Name", "agentId": "agent-type-id", "specialty": ["capability1", "capability2"] }
]
Respond ONLY with JSON.`;

      const response = await callGateway<{ text: string }>({
        method: "agent",
        params: {
          message: prompt,
          lane: "main",
          deliver: false,
          timeout: 30
        },
        timeoutMs: 60000
      });

      let teamMembers: TeamMember[] = [];
      try {
          const jsonText = response?.text?.replace(/```json|```/g, "").trim();
          teamMembers = JSON.parse(jsonText || "[]");
      } catch (err) {
          SystemLogger.warn("HIVE", `Failed to parse team composition for ${params.teamName}, using defaults.`);
          // Fallback to defaults
          teamMembers = [
            { role: "Coordinator", agentId: "coordinator-agent", specialty: ["planning"] },
            { role: "Researcher", agentId: "researcher-agent", specialty: ["research"] }
          ];
      }

      const spawnedRunIds: string[] = [];

      for (const member of teamMembers) {
        const runId = await this.spawnMember({
          ...member,
          goal: params.goal,
          parentSessionKey: params.parentSessionKey,
          workspaceId: params.workspaceId
        });
        spawnedRunIds.push(runId);
      }

      SystemHealth.update("hive");
      return spawnedRunIds;
    } catch (err) {
      SystemLogger.error("HIVE", `Critical failure in spawnTeam: ${params.teamName}`, err, params.workspaceId);
      SystemHealth.update("hive", err);
      return [];
    }
  }

  private async spawnMember(params: TeamMember & { goal: string; parentSessionKey: string; workspaceId?: string }): Promise<string> {
    const message = `You are the ${params.role} of the '${params.agentId}' team.
Your goal is: ${params.goal}.
Your specialties are: ${params.specialty.join(", ")}.
Collaborate with your teammates to achieve the goal.`;

    const response = await callGateway<{ runId: string }>({
      method: "agent",
      params: {
        message,
        agentId: params.agentId,
        spawnedBy: params.parentSessionKey,
        lane: AGENT_LANE_SUBAGENT,
        channel: INTERNAL_MESSAGE_CHANNEL,
        workspaceDir: params.workspaceId ? `./workspaces/${params.workspaceId}` : undefined
      },
      timeoutMs: 30000
    });

    if (!response?.runId) {
      throw new Error(`Failed to spawn team member: ${params.agentId}`);
    }

    return response.runId;
  }

  async monitorTeam(runIds: string[]) {
    // Logic to monitor the health and progress of the team agents.
    // Main agent uses this to pull sub-agents out of loops or fix errors.
  }
}
