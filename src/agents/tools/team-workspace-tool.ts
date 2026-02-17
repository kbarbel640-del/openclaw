import { z } from "zod";
import { zodToToolJsonSchema } from "../schema/zod-tool-schema.js";
import {
  buildTeamContextSummary,
  listTeamArtifacts,
  listTeamDecisions,
  readTeamArtifact,
  readTeamContext,
  writeTeamArtifact,
  writeTeamContext,
} from "../team-workspace.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringArrayParam, readStringParam } from "./common.js";

const TEAM_WORKSPACE_ACTIONS = [
  "write_artifact",
  "read_artifact",
  "list_artifacts",
  "set_context",
  "get_context",
  "list_decisions",
  "get_summary",
] as const;

const TeamWorkspaceToolSchema = zodToToolJsonSchema(
  z.object({
    action: z
      .enum(TEAM_WORKSPACE_ACTIONS)
      .describe(
        "write_artifact: write a file to shared artifacts. " +
          "read_artifact: read a shared artifact. " +
          "list_artifacts: list all shared artifacts with metadata. " +
          "set_context: write a key-value pair to shared context. " +
          "get_context: read a value from shared context. " +
          "list_decisions: list all team decisions. " +
          "get_summary: get a formatted summary of team context.",
      ),
    name: z.string().describe("Artifact name (for write_artifact, read_artifact)").optional(),
    content: z.string().describe("Artifact content (for write_artifact)").optional(),
    description: z.string().describe("Artifact description (for write_artifact)").optional(),
    tags: z.array(z.string()).describe("Artifact tags (for write_artifact)").optional(),
    key: z.string().describe("Context key (for set_context, get_context)").optional(),
    value: z.string().describe("Context value (for set_context)").optional(),
  }),
);

export function createTeamWorkspaceTool(opts?: { agentSessionKey?: string }): AnyAgentTool {
  return {
    label: "Team Workspace",
    name: "team_workspace",
    description:
      "Access shared team workspace for cross-agent collaboration. " +
      "Write and read artifacts, manage shared context, and view team decisions. " +
      "Available to all agents for coordinated work.",
    parameters: TeamWorkspaceToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });
      const requesterSessionKey = opts?.agentSessionKey;

      if (!requesterSessionKey) {
        return jsonResult({
          status: "error",
          error: "team_workspace requires a valid agent session key",
        });
      }

      if (action === "write_artifact") {
        const name = readStringParam(params, "name", { required: true });
        const content = readStringParam(params, "content", { required: true });
        const description = readStringParam(params, "description");
        const tags = readStringArrayParam(params, "tags");

        try {
          const path = await writeTeamArtifact({
            requesterSessionKey,
            name,
            content,
            metadata: { description, tags },
          });
          return jsonResult({ status: "ok", path, name });
        } catch (err) {
          return jsonResult({
            status: "error",
            error: err instanceof Error ? err.message : "write failed",
          });
        }
      }

      if (action === "read_artifact") {
        const name = readStringParam(params, "name", { required: true });

        try {
          const content = await readTeamArtifact({ requesterSessionKey, name });
          if (content === null) {
            return jsonResult({ status: "error", error: "artifact not found" });
          }
          return jsonResult({ status: "ok", name, content });
        } catch (err) {
          return jsonResult({
            status: "error",
            error: err instanceof Error ? err.message : "read failed",
          });
        }
      }

      if (action === "list_artifacts") {
        try {
          const artifacts = await listTeamArtifacts({ requesterSessionKey });
          return jsonResult({
            status: "ok",
            artifacts: artifacts.map((a) => ({
              name: a.name,
              description: a.metadata.description,
              tags: a.metadata.tags,
              createdBy: a.metadata.createdBy,
              modifiedBy: a.metadata.modifiedBy,
              modifiedAt: new Date(a.metadata.modifiedAt).toISOString(),
            })),
          });
        } catch (err) {
          return jsonResult({
            status: "error",
            error: err instanceof Error ? err.message : "list failed",
          });
        }
      }

      if (action === "set_context") {
        const key = readStringParam(params, "key", { required: true });
        const value = readStringParam(params, "value", { required: true });

        try {
          await writeTeamContext({ requesterSessionKey, key, value });
          return jsonResult({ status: "ok", key });
        } catch (err) {
          return jsonResult({
            status: "error",
            error: err instanceof Error ? err.message : "write failed",
          });
        }
      }

      if (action === "get_context") {
        const key = readStringParam(params, "key", { required: true });

        try {
          const value = await readTeamContext({ requesterSessionKey, key });
          if (value === null) {
            return jsonResult({ status: "error", error: "key not found" });
          }
          return jsonResult({ status: "ok", key, value });
        } catch (err) {
          return jsonResult({
            status: "error",
            error: err instanceof Error ? err.message : "read failed",
          });
        }
      }

      if (action === "list_decisions") {
        try {
          const decisions = await listTeamDecisions({ requesterSessionKey });
          return jsonResult({
            status: "ok",
            decisions: decisions.map((d) => ({
              id: d.id,
              topic: d.topic,
              decision: d.decision,
              participants: d.participants,
              timestamp: new Date(d.timestamp).toISOString(),
            })),
          });
        } catch (err) {
          return jsonResult({
            status: "error",
            error: err instanceof Error ? err.message : "list failed",
          });
        }
      }

      if (action === "get_summary") {
        try {
          const summary = await buildTeamContextSummary({ requesterSessionKey });
          return jsonResult({ status: "ok", summary });
        } catch (err) {
          return jsonResult({
            status: "error",
            error: err instanceof Error ? err.message : "summary failed",
          });
        }
      }

      return jsonResult({
        status: "error",
        error: `Unknown action: ${action}`,
      });
    },
  };
}
