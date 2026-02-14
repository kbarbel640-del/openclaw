import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { splitCommandChain } from "../infra/exec-approvals-analysis.js";
import { splitShellArgs } from "../utils/shell-argv.js";
import { readSessionMessages, resolveSessionTranscriptCandidates } from "./session-utils.fs.js";

export type SessionFileAction = "created" | "updated" | "read" | "deleted" | "referenced";
export type SessionFileKind = "file" | "directory" | "unknown";
export type SessionFilesScope = "created" | "changed" | "all";

export type SessionFileEntry = {
  path: string;
  workspacePath?: string;
  kind: SessionFileKind;
  action: SessionFileAction;
  actions: SessionFileAction[];
  exists: boolean;
  firstSeenAt?: number;
  lastSeenAt?: number;
};

export type SessionFilesIndexResult = {
  transcriptPath?: string;
  entries: SessionFileEntry[];
};

type JsonRecord = Record<string, unknown>;

type ToolCallEnvelope = {
  toolName: string;
  args: JsonRecord;
  timestamp?: number;
};

type FileObservation = {
  candidatePath: string;
  action: SessionFileAction;
  kind: SessionFileKind;
  timestamp?: number;
  workdir?: string;
};

type FileObservationAggregate = {
  path: string;
  kind: SessionFileKind;
  actions: Set<SessionFileAction>;
  firstSeenAt?: number;
  lastSeenAt?: number;
};

const ACTION_PRIORITY: SessionFileAction[] = [
  "created",
  "updated",
  "deleted",
  "read",
  "referenced",
];

const CHANGED_ACTIONS = new Set<SessionFileAction>(["created", "updated", "deleted"]);
const EXEC_TOOL_NAMES = new Set(["exec", "bash", "shell", "sh"]);
const APPLY_PATCH_TOOL_NAMES = new Set(["apply_patch", "apply-patch"]);
const READ_TOOL_NAMES = new Set(["read", "read_file", "cat", "view_file"]);
const CREATE_TOOL_NAMES = new Set(["write", "write_file", "create_file"]);
const UPDATE_TOOL_NAMES = new Set([
  "edit",
  "multi_edit",
  "str_replace",
  "str_replace_editor",
  "replace_text",
]);
const DELETE_TOOL_NAMES = new Set(["delete", "remove", "unlink"]);
const TOOL_CALL_BLOCK_TYPES = new Set([
  "toolcall",
  "tool_call",
  "tooluse",
  "tool_use",
  "functioncall",
  "function_call",
]);

const WINDOWS_ABS_RE = /^[a-zA-Z]:[\\/]/;
const LEADING_PROTOCOL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

function toRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function toNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function toStringArray(value: unknown): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    const trimmed = item.trim();
    if (trimmed) {
      out.push(trimmed);
    }
  }
  return out;
}

function parseRecordFromUnknown(value: unknown): JsonRecord | null {
  const direct = toRecord(value);
  if (direct) {
    return direct;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed);
    return toRecord(parsed);
  } catch {
    return null;
  }
}

function normalizeToolName(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function extractPathArgs(args: JsonRecord, keys: string[]): string[] {
  const out: string[] = [];
  for (const key of keys) {
    out.push(...toStringArray(args[key]));
  }
  return out;
}

function splitPipelineSegments(command: string): string[] {
  const parts: string[] = [];
  let buf = "";
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  const pushPart = () => {
    const trimmed = buf.trim();
    if (trimmed) {
      parts.push(trimmed);
    }
    buf = "";
  };

  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    const next = command[i + 1];
    if (escaped) {
      buf += ch;
      escaped = false;
      continue;
    }
    if (!inSingle && ch === "\\") {
      escaped = true;
      buf += ch;
      continue;
    }
    if (!inDouble && ch === "'") {
      inSingle = !inSingle;
      buf += ch;
      continue;
    }
    if (!inSingle && ch === '"') {
      inDouble = !inDouble;
      buf += ch;
      continue;
    }
    if (!inSingle && !inDouble && ch === "|" && next !== "|") {
      pushPart();
      continue;
    }
    buf += ch;
  }
  pushPart();
  return parts;
}

function extractRedirectTargets(command: string): string[] {
  const targets: string[] = [];
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (!inSingle && ch === "\\") {
      escaped = true;
      continue;
    }
    if (!inDouble && ch === "'") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && ch === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (inSingle || inDouble || ch !== ">") {
      continue;
    }

    if (command[i + 1] === ">") {
      i += 1;
    }
    let cursor = i + 1;
    while (cursor < command.length && /\s/.test(command[cursor] ?? "")) {
      cursor += 1;
    }
    if (cursor >= command.length) {
      continue;
    }

    let token = "";
    const start = command[cursor];
    if (start === '"' || start === "'") {
      const quote = start;
      cursor += 1;
      while (cursor < command.length && command[cursor] !== quote) {
        token += command[cursor];
        cursor += 1;
      }
      i = cursor;
    } else {
      while (cursor < command.length) {
        const next = command[cursor];
        if (!next || /\s/.test(next) || "|&;<>".includes(next)) {
          break;
        }
        token += next;
        cursor += 1;
      }
      i = cursor - 1;
    }

    const trimmed = token.trim();
    if (!trimmed || trimmed.startsWith("&")) {
      continue;
    }
    targets.push(trimmed);
  }

  return targets;
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return trimmed;
  }
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === "'" && last === "'") || (first === '"' && last === '"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function fallbackSplitArgs(command: string): string[] {
  const matches = command.match(/(?:[^\s"']+|"(?:\\.|[^"])*"|'(?:\\.|[^'])*')+/g) ?? [];
  return matches.map((token) => stripWrappingQuotes(token)).filter(Boolean);
}

function resolveOptionValue(tokens: string[], flags: Set<string>): string | undefined {
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (flags.has(token)) {
      const next = tokens[i + 1];
      if (next && !next.startsWith("-")) {
        return next;
      }
      continue;
    }
    for (const flag of flags) {
      const prefix = `${flag}=`;
      if (token.startsWith(prefix)) {
        const value = token.slice(prefix.length).trim();
        if (value) {
          return value;
        }
      }
    }
  }
  return undefined;
}

function nonOptionOperands(tokens: string[]): string[] {
  const out: string[] = [];
  for (const token of tokens) {
    if (!token || token.startsWith("-")) {
      continue;
    }
    out.push(token);
  }
  return out;
}

function extractExecObservations(params: {
  command: string;
  workdir?: string;
  workspaceDir?: string;
  timestamp?: number;
}): FileObservation[] {
  const out: FileObservation[] = [];
  const chain = splitCommandChain(params.command) ?? [params.command];
  let currentDir = params.workdir;

  const appendPath = (
    candidatePath: string,
    action: SessionFileAction,
    kind: SessionFileKind,
    workdir?: string,
  ) => {
    out.push({
      candidatePath,
      action,
      kind,
      timestamp: params.timestamp,
      workdir,
    });
  };

  for (const chainPart of chain) {
    const pipelineSegments = splitPipelineSegments(chainPart);
    for (const segment of pipelineSegments) {
      const trimmed = segment.trim();
      if (!trimmed) {
        continue;
      }

      for (const target of extractRedirectTargets(trimmed)) {
        appendPath(target, "created", "file", currentDir ?? params.workspaceDir);
      }

      const tokens = splitShellArgs(trimmed) ?? fallbackSplitArgs(trimmed);
      if (tokens.length === 0) {
        continue;
      }
      const commandName = path.basename(tokens[0] ?? "").toLowerCase();
      const operands = tokens.slice(1);

      if (commandName === "cd") {
        const nextDir = operands.find((token) => !token.startsWith("-"));
        if (nextDir) {
          const resolved = resolveCandidatePath(nextDir, currentDir, params.workspaceDir);
          if (resolved) {
            currentDir = resolved;
          }
        }
        continue;
      }

      if (commandName === "touch") {
        for (const operand of nonOptionOperands(operands)) {
          appendPath(operand, "created", "file", currentDir ?? params.workspaceDir);
        }
        continue;
      }

      if (commandName === "mkdir") {
        for (const operand of nonOptionOperands(operands)) {
          appendPath(operand, "created", "directory", currentDir ?? params.workspaceDir);
        }
        continue;
      }

      if (commandName === "rm" || commandName === "unlink") {
        for (const operand of nonOptionOperands(operands)) {
          appendPath(operand, "deleted", "file", currentDir ?? params.workspaceDir);
        }
        continue;
      }

      if (commandName === "rmdir") {
        for (const operand of nonOptionOperands(operands)) {
          appendPath(operand, "deleted", "directory", currentDir ?? params.workspaceDir);
        }
        continue;
      }

      if (commandName === "mv") {
        const entries = nonOptionOperands(operands);
        if (entries.length >= 2) {
          const destination = entries[entries.length - 1];
          for (const source of entries.slice(0, -1)) {
            appendPath(source, "deleted", "unknown", currentDir ?? params.workspaceDir);
          }
          appendPath(destination, "created", "unknown", currentDir ?? params.workspaceDir);
        }
        continue;
      }

      if (commandName === "cp" || commandName === "install" || commandName === "ln") {
        const entries = nonOptionOperands(operands);
        if (entries.length >= 2) {
          appendPath(
            entries[entries.length - 1],
            "created",
            "unknown",
            currentDir ?? params.workspaceDir,
          );
        }
        continue;
      }

      if (commandName === "tee") {
        for (const operand of nonOptionOperands(operands).filter((token) => token !== "-")) {
          appendPath(operand, "created", "file", currentDir ?? params.workspaceDir);
        }
        continue;
      }

      if (commandName === "textutil") {
        const output = resolveOptionValue(tokens, new Set(["-output", "--output"]));
        if (output) {
          appendPath(output, "created", "file", currentDir ?? params.workspaceDir);
        }
        continue;
      }

      if (commandName === "pandoc") {
        const output = resolveOptionValue(tokens, new Set(["-o", "--output"]));
        if (output) {
          appendPath(output, "created", "file", currentDir ?? params.workspaceDir);
        }
        continue;
      }

      if (commandName === "zip") {
        const archive = nonOptionOperands(operands)[0];
        if (archive) {
          appendPath(archive, "created", "file", currentDir ?? params.workspaceDir);
        }
        continue;
      }

      if (commandName === "tar") {
        const output = resolveOptionValue(tokens, new Set(["-f", "--file"]));
        if (output) {
          appendPath(output, "created", "file", currentDir ?? params.workspaceDir);
        }
      }
    }
  }

  return out;
}

function extractApplyPatchObservations(params: {
  patch: string;
  timestamp?: number;
}): FileObservation[] {
  const out: FileObservation[] = [];
  const lines = params.patch.split(/\r?\n/);
  let currentUpdatePath: string | undefined;
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.startsWith("*** Add File: ")) {
      const candidatePath = line.slice("*** Add File: ".length).trim();
      if (candidatePath) {
        out.push({
          candidatePath,
          action: "created",
          kind: "file",
          timestamp: params.timestamp,
        });
      }
      currentUpdatePath = undefined;
      continue;
    }
    if (line.startsWith("*** Update File: ")) {
      currentUpdatePath = line.slice("*** Update File: ".length).trim();
      if (currentUpdatePath) {
        out.push({
          candidatePath: currentUpdatePath,
          action: "updated",
          kind: "file",
          timestamp: params.timestamp,
        });
      }
      continue;
    }
    if (line.startsWith("*** Delete File: ")) {
      const candidatePath = line.slice("*** Delete File: ".length).trim();
      if (candidatePath) {
        out.push({
          candidatePath,
          action: "deleted",
          kind: "file",
          timestamp: params.timestamp,
        });
      }
      currentUpdatePath = undefined;
      continue;
    }
    if (line.startsWith("*** Move to: ")) {
      const movedTo = line.slice("*** Move to: ".length).trim();
      if (currentUpdatePath) {
        out.push({
          candidatePath: currentUpdatePath,
          action: "deleted",
          kind: "file",
          timestamp: params.timestamp,
        });
      }
      if (movedTo) {
        out.push({
          candidatePath: movedTo,
          action: "created",
          kind: "file",
          timestamp: params.timestamp,
        });
      }
    }
  }
  return out;
}

function resolveToolCallArgs(block: JsonRecord): JsonRecord {
  const candidates = [block.arguments, block.input, block.params, block.args];
  for (const candidate of candidates) {
    const parsed = parseRecordFromUnknown(candidate);
    if (parsed) {
      return parsed;
    }
  }
  return {};
}

function extractToolCallsFromMessage(message: unknown): ToolCallEnvelope[] {
  const record = toRecord(message);
  if (!record) {
    return [];
  }
  const out: ToolCallEnvelope[] = [];
  const timestamp = toNumber(record.timestamp);
  const topLevelToolName = normalizeToolName(toString(record.toolName));
  const topLevelArgs = parseRecordFromUnknown(record.args) ?? parseRecordFromUnknown(record.params);

  if (topLevelToolName && topLevelArgs) {
    out.push({ toolName: topLevelToolName, args: topLevelArgs, timestamp });
  }

  const content = Array.isArray(record.content) ? record.content : [];
  for (const blockValue of content) {
    const block = toRecord(blockValue);
    if (!block) {
      continue;
    }
    const blockType = normalizeToolName(toString(block.type));
    if (!TOOL_CALL_BLOCK_TYPES.has(blockType)) {
      continue;
    }
    const blockName = normalizeToolName(toString(block.name));
    const toolName = blockName || topLevelToolName;
    if (!toolName) {
      continue;
    }
    out.push({
      toolName,
      args: resolveToolCallArgs(block),
      timestamp,
    });
  }

  return out;
}

function observationsFromToolCall(params: {
  toolCall: ToolCallEnvelope;
  workspaceDir?: string;
  defaultWorkdir?: string;
}): FileObservation[] {
  const { toolCall } = params;
  const args = toolCall.args;
  const toolName = normalizeToolName(toolCall.toolName);
  const timestamp = toolCall.timestamp;

  if (EXEC_TOOL_NAMES.has(toolName)) {
    const command = toString(args.command) ?? toString(args.cmd);
    if (!command) {
      return [];
    }
    const workdirCandidate =
      toString(args.workdir) ??
      toString(args.cwd) ??
      toString(args.dir) ??
      toString(args.directory) ??
      params.defaultWorkdir;
    const workdir = resolveCandidatePath(
      workdirCandidate,
      params.defaultWorkdir,
      params.workspaceDir,
    );
    return extractExecObservations({
      command,
      workdir,
      workspaceDir: params.workspaceDir,
      timestamp,
    });
  }

  if (APPLY_PATCH_TOOL_NAMES.has(toolName)) {
    const patch = toString(args.patch) ?? toString(args.diff) ?? toString(args.content);
    if (!patch) {
      return [];
    }
    return extractApplyPatchObservations({ patch, timestamp });
  }

  const pathKeys = ["path", "file_path", "filepath", "target_path", "target", "output", "out"];
  const paths = extractPathArgs(args, pathKeys);

  if (paths.length === 0) {
    return [];
  }

  const action = READ_TOOL_NAMES.has(toolName)
    ? "read"
    : CREATE_TOOL_NAMES.has(toolName)
      ? "created"
      : UPDATE_TOOL_NAMES.has(toolName)
        ? "updated"
        : DELETE_TOOL_NAMES.has(toolName)
          ? "deleted"
          : "referenced";

  const kind: SessionFileKind = action === "referenced" ? "unknown" : "file";
  return paths.map((candidatePath) => ({
    candidatePath,
    action,
    kind,
    timestamp,
    workdir: params.defaultWorkdir ?? params.workspaceDir,
  }));
}

function resolveCandidatePath(
  rawPath: string | undefined,
  workdir?: string,
  workspaceDir?: string,
): string | null {
  const value = toString(rawPath);
  if (!value) {
    return null;
  }
  if (LEADING_PROTOCOL_RE.test(value) && !value.toLowerCase().startsWith("file://")) {
    return null;
  }

  let candidate = stripWrappingQuotes(value);
  if (!candidate || candidate === "-" || candidate.startsWith("$")) {
    return null;
  }
  if (candidate.toLowerCase().startsWith("file://")) {
    try {
      candidate = decodeURIComponent(new URL(candidate).pathname);
    } catch {
      return null;
    }
  }
  if (candidate === "~") {
    candidate = os.homedir();
  } else if (candidate.startsWith("~/") || candidate.startsWith("~\\")) {
    candidate = path.join(os.homedir(), candidate.slice(2));
  } else if (candidate.startsWith("~")) {
    return null;
  }

  if (path.isAbsolute(candidate) || WINDOWS_ABS_RE.test(candidate)) {
    return path.normalize(candidate);
  }

  const baseDir = workdir ?? workspaceDir;
  if (baseDir) {
    return path.resolve(baseDir, candidate);
  }
  return path.resolve(candidate);
}

function resolveWorkspacePath(absPath: string, workspaceDir?: string): string | undefined {
  if (!workspaceDir) {
    return undefined;
  }
  const root = path.resolve(workspaceDir);
  const relative = path.relative(root, absPath);
  if (!relative || relative === ".") {
    return ".";
  }
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return undefined;
  }
  return relative.replaceAll("\\", "/");
}

function statPath(targetPath: string): { exists: boolean; kind: SessionFileKind } {
  try {
    const stat = fs.statSync(targetPath);
    return { exists: true, kind: stat.isDirectory() ? "directory" : "file" };
  } catch {
    return { exists: false, kind: "unknown" };
  }
}

function resolvePrimaryAction(actions: Set<SessionFileAction>): SessionFileAction {
  for (const action of ACTION_PRIORITY) {
    if (actions.has(action)) {
      return action;
    }
  }
  return "referenced";
}

function sortActions(actions: Set<SessionFileAction>): SessionFileAction[] {
  return ACTION_PRIORITY.filter((action) => actions.has(action));
}

function matchesScope(actions: Set<SessionFileAction>, scope: SessionFilesScope): boolean {
  if (scope === "all") {
    return true;
  }
  if (scope === "created") {
    return actions.has("created");
  }
  for (const action of actions) {
    if (CHANGED_ACTIONS.has(action)) {
      return true;
    }
  }
  return false;
}

function resolveSessionTranscriptPath(params: {
  sessionId: string;
  storePath?: string;
  sessionFile?: string;
  agentId?: string;
}): string | undefined {
  return resolveSessionTranscriptCandidates(
    params.sessionId,
    params.storePath,
    params.sessionFile,
    params.agentId,
  ).find((candidate) => fs.existsSync(candidate));
}

export function listSessionFilesFromTranscript(params: {
  sessionId: string;
  storePath?: string;
  sessionFile?: string;
  agentId?: string;
  workspaceDir?: string;
  scope?: SessionFilesScope;
  includeMissing?: boolean;
  limit?: number;
}): SessionFilesIndexResult {
  const transcriptPath = resolveSessionTranscriptPath(params);
  if (!transcriptPath) {
    return { entries: [] };
  }

  const messages = readSessionMessages(
    params.sessionId,
    params.storePath,
    params.sessionFile,
    params.agentId,
  );
  const scope = params.scope ?? "created";
  const includeMissing = params.includeMissing === true;
  const limit =
    typeof params.limit === "number" && Number.isFinite(params.limit)
      ? Math.max(1, Math.floor(params.limit))
      : 500;

  const aggregates = new Map<string, FileObservationAggregate>();
  const defaultWorkdir = params.workspaceDir;

  for (const message of messages) {
    const toolCalls = extractToolCallsFromMessage(message);
    for (const toolCall of toolCalls) {
      const observations = observationsFromToolCall({
        toolCall,
        workspaceDir: params.workspaceDir,
        defaultWorkdir,
      });
      for (const observation of observations) {
        const resolvedPath = resolveCandidatePath(
          observation.candidatePath,
          observation.workdir,
          params.workspaceDir,
        );
        if (!resolvedPath) {
          continue;
        }
        const existing = aggregates.get(resolvedPath);
        if (!existing) {
          aggregates.set(resolvedPath, {
            path: resolvedPath,
            kind: observation.kind,
            actions: new Set<SessionFileAction>([observation.action]),
            firstSeenAt: observation.timestamp,
            lastSeenAt: observation.timestamp,
          });
          continue;
        }
        existing.actions.add(observation.action);
        if (existing.kind === "unknown" || observation.kind === "directory") {
          existing.kind = observation.kind;
        } else if (existing.kind === "file" && observation.kind === "file") {
          existing.kind = "file";
        }
        if (typeof observation.timestamp === "number") {
          const first = existing.firstSeenAt;
          const last = existing.lastSeenAt;
          existing.firstSeenAt =
            typeof first === "number"
              ? Math.min(first, observation.timestamp)
              : observation.timestamp;
          existing.lastSeenAt =
            typeof last === "number"
              ? Math.max(last, observation.timestamp)
              : observation.timestamp;
        }
      }
    }
  }

  const entries = Array.from(aggregates.values())
    .filter((aggregate) => matchesScope(aggregate.actions, scope))
    .map((aggregate): SessionFileEntry => {
      const stat = statPath(aggregate.path);
      const actions = sortActions(aggregate.actions);
      const action = resolvePrimaryAction(aggregate.actions);
      const kind =
        aggregate.kind !== "unknown"
          ? aggregate.kind
          : stat.kind !== "unknown"
            ? stat.kind
            : aggregate.path.endsWith("/") || aggregate.path.endsWith("\\")
              ? "directory"
              : "unknown";
      return {
        path: aggregate.path,
        workspacePath: resolveWorkspacePath(aggregate.path, params.workspaceDir),
        kind,
        action,
        actions,
        exists: stat.exists,
        firstSeenAt: aggregate.firstSeenAt,
        lastSeenAt: aggregate.lastSeenAt,
      };
    })
    .filter((entry) => includeMissing || entry.exists)
    .toSorted((a, b) => a.path.localeCompare(b.path))
    .slice(0, limit);

  return {
    transcriptPath,
    entries,
  };
}
