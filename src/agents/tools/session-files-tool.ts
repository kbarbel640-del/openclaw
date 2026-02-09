import { Type } from "@sinclair/typebox";
import type { OpenClawConfig } from "../../config/config.js";
import type { AnyAgentTool } from "./common.js";
import { listFiles, getFile } from "../../sessions/files/storage.js";
import { resolveSessionAgentId } from "../agent-scope.js";
import { jsonResult, readStringParam } from "./common.js";

const SessionFilesListSchema = Type.Object({
  sessionId: Type.String({ description: "Session ID to list files for" }),
});

const SessionFilesGetSchema = Type.Object({
  sessionId: Type.String({ description: "Session ID to get file from" }),
  fileId: Type.String({ description: "File ID to retrieve" }),
});

export function createSessionFilesListTool(options: {
  config?: OpenClawConfig;
  agentSessionKey?: string;
}): AnyAgentTool | null {
  const cfg = options.config;
  if (!cfg) {
    return null;
  }
  const agentId = resolveSessionAgentId({
    sessionKey: options.agentSessionKey,
    config: cfg,
  });
  return {
    label: "Session Files List",
    name: "session_files_list",
    description: "List all files stored for a session",
    parameters: SessionFilesListSchema,
    execute: async (_toolCallId, params) => {
      const sessionId = readStringParam(params, "sessionId", { required: true });
      try {
        const files = await listFiles({ sessionId, agentId });
        return jsonResult({ files });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({ files: [], error: message });
      }
    },
  };
}

export function createSessionFilesGetTool(options: {
  config?: OpenClawConfig;
  agentSessionKey?: string;
}): AnyAgentTool | null {
  const cfg = options.config;
  if (!cfg) {
    return null;
  }
  const agentId = resolveSessionAgentId({
    sessionKey: options.agentSessionKey,
    config: cfg,
  });
  return {
    label: "Session Files Get",
    name: "session_files_get",
    description: "Get file content and metadata by file ID",
    parameters: SessionFilesGetSchema,
    execute: async (_toolCallId, params) => {
      const sessionId = readStringParam(params, "sessionId", { required: true });
      const fileId = readStringParam(params, "fileId", { required: true });
      try {
        const { buffer, metadata } = await getFile({ sessionId, agentId, fileId });
        const content = buffer.toString("utf-8");
        return jsonResult({ content, metadata });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({ content: null, error: message });
      }
    },
  };
}
