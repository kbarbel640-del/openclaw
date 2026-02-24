import { z } from "zod";

/**
 * Intent classification configuration for routing decisions.
 */
export const IntentClassificationSchema = z
  .object({
    /** Enable intent-based routing for this agent. */
    enabled: z.boolean().optional(),
    /** Keywords or patterns that trigger this agent. */
    keywords: z.array(z.string()).optional(),
    /** Intent categories this agent handles (e.g., "coding", "research", "scheduling"). */
    categories: z.array(z.string()).optional(),
  })
  .strict()
  .optional();

/**
 * Agent handoff configuration controlling delegation between agents.
 */
export const AgentHandoffSchema = z
  .object({
    /** Agent IDs this agent can hand off to. Use "*" to allow any agent. */
    allowAgents: z.array(z.string()).optional(),
    /** Agent IDs this agent can receive handoffs from. Use "*" to allow any. */
    allowFrom: z.array(z.string()).optional(),
    /** Whether to transfer full conversation context during handoff. */
    transferContext: z.boolean().optional(),
  })
  .strict()
  .optional();

/**
 * Shared context/memory configuration for multi-agent collaboration.
 */
export const SharedContextSchema = z
  .object({
    /** Enable shared context for this agent. */
    enabled: z.boolean().optional(),
    /** Agent IDs that can access this agent's shared context. Use "*" to allow any. */
    allowAgents: z.array(z.string()).optional(),
    /** Context scope: "session" (per-session) or "global" (across all sessions). */
    scope: z.enum(["session", "global"]).optional(),
  })
  .strict()
  .optional();

/**
 * Supervisor agent configuration for orchestration and routing.
 */
export const SupervisorConfigSchema = z
  .object({
    /** Default agent to route to when intent is unclear. */
    defaultAgent: z.string().optional(),
    /** Strategy for handling multi-intent requests. */
    strategy: z.enum(["delegate", "collaborate", "sequential"]).optional(),
  })
  .strict()
  .optional();

/**
 * Agent orchestration configuration combining all multi-agent features.
 */
export const AgentOrchestrationSchema = z
  .object({
    /** Mark this agent as a supervisor capable of routing and delegation. */
    supervisor: z.union([z.boolean(), SupervisorConfigSchema]).optional(),
    /** Intent classification rules for routing. */
    intents: IntentClassificationSchema,
    /** Agent handoff permissions and settings. */
    handoff: AgentHandoffSchema,
    /** Shared context/memory configuration. */
    sharedContext: SharedContextSchema,
  })
  .strict()
  .optional();
