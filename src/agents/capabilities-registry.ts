/**
 * CAPABILITIES REGISTRY
 *
 * Smart agent routing based on declared capabilities and workload.
 * Enables dynamic agent selection by matching task requirements to agent skills.
 */

import type { OpenClawConfig } from "../config/config.js";
import type { AgentRole } from "../config/types.agents.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { listDelegationsForAgent } from "./delegation-registry.js";
import { listSubagentRunsForRequester } from "./subagent-registry.js";
import { classifyTaskWithScores, type TaskType } from "./task-classifier.js";

export type AgentCapabilityProfile = {
  agentId: string;
  name?: string;
  role?: AgentRole;
  capabilities: string[];
  expertise: string[];
  availability: "auto" | "manual";
};

export type AgentMatch = {
  agentId: string;
  name?: string;
  role?: AgentRole;
  matchedCapabilities: string[];
  confidence: number;
};

export type AgentWorkload = {
  activeTasks: number;
  activeSpawns: number;
  totalLoad: number;
};

export type BestAgentMatch = {
  agentId: string;
  confidence: number;
  reason: string;
  workload?: AgentWorkload;
};

// In-memory registry of agent capabilities
const capabilitiesRegistry = new Map<string, AgentCapabilityProfile>();

/**
 * Task type to capability mappings
 */
const TASK_TYPE_CAPABILITIES: Record<TaskType, string[]> = {
  coding: [
    "code",
    "programming",
    "development",
    "debugging",
    "refactoring",
    "testing",
    "api-design",
    "architecture",
    "typescript",
    "javascript",
    "python",
    "react",
    "node",
    "database",
  ],
  tools: [
    "tool-use",
    "operations",
    "cli",
    "shell",
    "debugging",
    "log-analysis",
    "monitoring",
    "triage",
    "openclaw",
    "gateway",
    "postgres",
    "redis",
    "homebrew",
  ],
  vision: [
    "image-analysis",
    "ui-design",
    "visual-design",
    "screenshot-analysis",
    "diagram-interpretation",
    "ocr",
    "computer-vision",
  ],
  reasoning: [
    "analysis",
    "planning",
    "strategy",
    "decision-making",
    "architecture",
    "design",
    "evaluation",
    "problem-solving",
  ],
  general: [
    "conversation",
    "research",
    "writing",
    "documentation",
    "communication",
    "coordination",
  ],
};

/**
 * Register an agent's capabilities in the registry.
 */
export function registerAgentCapabilities(
  agentId: string,
  profile: Omit<AgentCapabilityProfile, "agentId">,
): void {
  const id = normalizeAgentId(agentId);
  capabilitiesRegistry.set(id, {
    agentId: id,
    ...profile,
  });
}

/**
 * Find agents that have a specific capability.
 */
export function findAgentsByCapability(capability: string): AgentMatch[] {
  const normalizedCapability = capability.toLowerCase().trim();
  const matches: AgentMatch[] = [];

  for (const profile of capabilitiesRegistry.values()) {
    const matchedCapabilities: string[] = [];
    let confidence = 0;

    // Check direct capability matches
    for (const cap of profile.capabilities) {
      if (cap.toLowerCase().includes(normalizedCapability)) {
        matchedCapabilities.push(cap);
        confidence += 1.0;
      }
    }

    // Check expertise matches (weighted slightly lower)
    for (const exp of profile.expertise) {
      if (exp.toLowerCase().includes(normalizedCapability)) {
        matchedCapabilities.push(exp);
        confidence += 0.7;
      }
    }

    if (matchedCapabilities.length > 0) {
      matches.push({
        agentId: profile.agentId,
        name: profile.name,
        role: profile.role,
        matchedCapabilities,
        confidence,
      });
    }
  }

  // Sort by confidence (descending)
  return matches.toSorted((a, b) => b.confidence - a.confidence);
}

/**
 * Get workload for a specific agent.
 */
export function getAgentWorkload(agentId: string): AgentWorkload {
  const id = normalizeAgentId(agentId);

  // Count active spawned subagents (sessions created via sessions_spawn)
  const subagentRuns = listSubagentRunsForRequester(`agent:${id}:main`);
  const activeSpawns = subagentRuns.filter((run) => !run.endedAt && !run.cleanupCompletedAt).length;

  // Count active delegations
  const delegations = listDelegationsForAgent(id);
  const activeTasks = delegations.filter(
    (d) => d.state === "assigned" || d.state === "in_progress" || d.state === "pending_review",
  ).length;

  // Total load is weighted sum
  const totalLoad = activeTasks * 1.0 + activeSpawns * 0.5;

  return {
    activeTasks,
    activeSpawns,
    totalLoad,
  };
}

/**
 * Score an agent for a specific task based on capabilities match.
 */
function scoreAgentForTask(
  profile: AgentCapabilityProfile,
  task: string,
  taskType: TaskType,
  taskScores: ReturnType<typeof classifyTaskWithScores>["scores"],
): number {
  let score = 0;

  // Get relevant capabilities for this task type
  const relevantCapabilities = TASK_TYPE_CAPABILITIES[taskType] || [];

  // Check how many relevant capabilities the agent has
  const taskLower = task.toLowerCase();
  const agentCapabilities = profile.capabilities.map((c) => c.toLowerCase());
  const agentExpertise = profile.expertise.map((e) => e.toLowerCase());

  // Score based on capability matches
  for (const relevantCap of relevantCapabilities) {
    // Direct capability match
    if (agentCapabilities.some((c) => c.includes(relevantCap) || relevantCap.includes(c))) {
      score += 2.0;
    }
    // Expertise match (slightly lower weight)
    if (agentExpertise.some((e) => e.includes(relevantCap) || relevantCap.includes(e))) {
      score += 1.5;
    }
    // Task description mentions this capability
    if (taskLower.includes(relevantCap)) {
      score += 0.5;
    }
  }

  // Boost score based on task type classification confidence
  const taskTypeScore = taskScores[taskType];
  score *= 1 + taskTypeScore * 0.2;

  return score;
}

/**
 * Find the best agent for a given task using task classification and capability matching.
 */
export function findBestAgentForTask(task: string): BestAgentMatch | null {
  if (!task?.trim()) {
    return null;
  }

  // Classify the task
  const classification = classifyTaskWithScores(task);
  const taskType = classification.type;

  const candidates: Array<{
    profile: AgentCapabilityProfile;
    capabilityScore: number;
    workload: AgentWorkload;
    finalScore: number;
  }> = [];

  // Score each registered agent
  for (const profile of capabilitiesRegistry.values()) {
    // Skip agents with manual availability (they must be explicitly selected)
    if (profile.availability === "manual") {
      continue;
    }

    const capabilityScore = scoreAgentForTask(profile, task, taskType, classification.scores);

    // Skip agents with zero capability match
    if (capabilityScore <= 0) {
      continue;
    }

    const workload = getAgentWorkload(profile.agentId);

    // Calculate final score (capability score adjusted by workload)
    // Lower workload = higher score multiplier
    const workloadPenalty = Math.min(1, workload.totalLoad * 0.1);
    const finalScore = capabilityScore * (1 - workloadPenalty);

    candidates.push({
      profile,
      capabilityScore,
      workload,
      finalScore,
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  // Sort by final score (descending)
  const sorted = candidates.toSorted((a, b) => b.finalScore - a.finalScore);

  const best = sorted[0];
  if (!best) {
    return null;
  }

  // Build reason string
  const matchedCaps = best.profile.capabilities
    .filter((cap) => {
      const capLower = cap.toLowerCase();
      const relevantCaps = TASK_TYPE_CAPABILITIES[taskType] || [];
      return relevantCaps.some((rc) => capLower.includes(rc) || rc.includes(capLower));
    })
    .slice(0, 3);

  const reason = `Best match for ${taskType} task. Capabilities: ${matchedCaps.join(", ")}. Workload: ${best.workload.totalLoad.toFixed(1)}`;

  return {
    agentId: best.profile.agentId,
    confidence: Math.min(100, best.finalScore * 10) / 100, // Normalize to 0-1
    reason,
    workload: best.workload,
  };
}

/**
 * Get the full capability profile for an agent.
 */
export function getAgentCapabilities(agentId: string): AgentCapabilityProfile | null {
  const id = normalizeAgentId(agentId);
  return capabilitiesRegistry.get(id) ?? null;
}

/**
 * Get all registered agent capability profiles.
 */
export function getAllAgentCapabilities(): AgentCapabilityProfile[] {
  return Array.from(capabilitiesRegistry.values());
}

/**
 * Initialize capabilities registry from configuration.
 */
export function initCapabilitiesRegistry(config: OpenClawConfig): void {
  capabilitiesRegistry.clear();

  const agents = config.agents?.list ?? [];

  for (const agent of agents) {
    if (!agent?.id) {
      continue;
    }

    const capabilities = agent.capabilities ?? [];
    const expertise = agent.expertise ?? [];
    const availability = agent.availability ?? "auto";

    registerAgentCapabilities(agent.id, {
      name: agent.name,
      role: agent.role,
      capabilities,
      expertise,
      availability,
    });
  }
}

/**
 * Clear the capabilities registry (for testing).
 */
export function resetCapabilitiesRegistryForTests(): void {
  capabilitiesRegistry.clear();
}
