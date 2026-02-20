import type { AnyAgentTool } from "openclaw/plugin-sdk";
import { Type } from "@sinclair/typebox";
import type { DoltQueryRecord, DoltReadOnlyQueryHelpers } from "../read-only-dolt-store.js";
import { buildNoContextDataMessage } from "./common.js";

const MAX_OUTPUT_CHARS = 40_000;

type DoltExpandToolParams = {
  queries: DoltReadOnlyQueryHelpers;
  sessionKey?: string;
};

/**
 * Build the dolt_expand tool.
 */
export function createDoltExpandTool(params: DoltExpandToolParams): AnyAgentTool {
  return {
    name: "dolt_expand",
    label: "Dolt Expand",
    description:
      "Expands a leaf or bindle to show child records. For bindles it shows child leaf summaries; for leaves it shows child turn messages. Only callable by sub-agents (spawn a Task). Use dolt_describe first.",
    parameters: Type.Object({
      pointer: Type.String({ description: "Leaf or bindle pointer to expand." }),
    }),
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const pointer = typeof rawParams.pointer === "string" ? rawParams.pointer.trim() : "";
      if (!pointer) {
        throw new Error("pointer required");
      }

      const availability = params.queries.getAvailability();
      if (!availability.available) {
        return {
          content: [{ type: "text", text: buildNoContextDataMessage(availability) }],
          details: { pointer, availability },
        };
      }

      if (!hasParentSession(params.sessionKey)) {
        return {
          content: [{ type: "text", text: buildSubagentOnlyMessage(pointer) }],
          details: { pointer, availability, callerSessionKey: params.sessionKey ?? null },
        };
      }

      const record = params.queries.getRecord(pointer);
      if (!record) {
        return {
          content: [{ type: "text", text: `No Dolt record found for pointer "${pointer}".` }],
          details: { pointer, availability, found: false },
        };
      }

      if (record.level === "turn") {
        return {
          content: [
            {
              type: "text",
              text: [
                `Pointer "${pointer}" resolves to a turn record.`,
                "Turns do not have children to expand.",
                "Use dolt_describe to inspect metadata, or read the turn content directly.",
              ].join("\n"),
            },
          ],
          details: { pointer, availability, found: true, level: record.level },
        };
      }

      const children = params.queries.listDirectChildRecords(pointer);
      const header = buildHeader({
        queries: params.queries,
        record,
      });
      const headerLength = header.length + 2;
      const bodyMaxChars = Math.max(0, MAX_OUTPUT_CHARS - headerLength);
      const body =
        children.length > 0
          ? buildChildrenBody({
              parentLevel: record.level,
              children,
              maxChars: bodyMaxChars,
            })
          : buildNoChildrenBody({
              record,
              maxChars: bodyMaxChars,
            });

      const text = `${header}\n\n${body.text}`.slice(0, MAX_OUTPUT_CHARS);

      return {
        content: [
          {
            type: "text",
            text,
          },
        ],
        details: {
          pointer,
          availability,
          found: true,
          level: record.level,
          childCount: children.length,
          shownChildren: body.shownChildren,
          truncatedChildren: body.truncatedChildren,
        },
      };
    },
  };
}

function buildSubagentOnlyMessage(pointer: string): string {
  return [
    "ERROR: Only sub-agents can expand dolt pointers.",
    "",
    "The dolt_expand tool can only be called by sub-agents spawned via the Task tool.",
    "This restriction protects the main context from uncontrolled expansion.",
    "",
    `To see the content of "${pointer}", spawn a Task sub-agent:`,
    `  Task(prompt="Use dolt_expand on ${pointer} to find <your question>")`,
  ].join("\n");
}

function hasParentSession(sessionKey: string | undefined): boolean {
  const normalized = normalizeOptionalString(sessionKey);
  if (!normalized) {
    return false;
  }

  const lowered = normalized.toLowerCase();
  if (lowered.startsWith("subagent:")) {
    return true;
  }

  const parts = lowered.split(":").filter(Boolean);
  if (parts.length < 3 || parts[0] !== "agent") {
    return false;
  }

  return parts.slice(2).join(":").startsWith("subagent:");
}

function buildHeader(params: {
  queries: DoltReadOnlyQueryHelpers;
  record: DoltQueryRecord;
}): string {
  const activeLane = params.queries.listActiveLane(
    params.record.sessionId,
    params.record.level,
    true,
  );
  const isActive = activeLane.some((entry) => entry.pointer === params.record.pointer);
  const lines = [
    `Pointer: ${params.record.pointer}`,
    `Level: ${params.record.level}`,
    `Session: ${params.record.sessionId}`,
    `Tokens: ~${formatTokenCount(params.record.tokenCount)}`,
    `Event time: ${formatEventTime(params.record.eventTsMs)}`,
    `Status: ${isActive ? "active" : "evicted"}`,
  ];

  if (params.record.level === "bindle") {
    const ghost = params.queries.getGhostSummary(params.record.pointer);
    const ghostSummary = normalizeOptionalString(ghost?.summaryText);
    if (ghostSummary) {
      lines.push(`Ghost summary: ${ghostSummary}`);
    }
  }

  return lines.join("\n");
}

function buildChildrenBody(params: {
  parentLevel: DoltQueryRecord["level"];
  children: DoltQueryRecord[];
  maxChars: number;
}): {
  text: string;
  shownChildren: number;
  truncatedChildren: number;
} {
  if (params.maxChars <= 0) {
    return {
      text: "",
      shownChildren: 0,
      truncatedChildren: params.children.length,
    };
  }

  let text = "";
  let shownChildren = 0;
  for (let idx = 0; idx < params.children.length; idx += 1) {
    const child = params.children[idx];
    const section = formatChildSection({
      parentLevel: params.parentLevel,
      child,
      childNumber: idx + 1,
    });
    const next = shownChildren === 0 ? section : `${text}\n\n${section}`;
    if (next.length > params.maxChars) {
      break;
    }
    text = next;
    shownChildren += 1;
  }

  const truncatedChildren = Math.max(0, params.children.length - shownChildren);
  if (truncatedChildren === 0) {
    return {
      text,
      shownChildren,
      truncatedChildren,
    };
  }

  const marker = `--- Truncated: ${truncatedChildren} more children not shown. Use dolt_describe on individual child pointers. ---`;
  const withMarker = text ? `${text}\n\n${marker}` : marker;
  if (withMarker.length <= params.maxChars) {
    return {
      text: withMarker,
      shownChildren,
      truncatedChildren,
    };
  }

  const keep = Math.max(0, params.maxChars - marker.length - 2);
  const trimmed = keep > 0 ? text.slice(0, keep).trimEnd() : "";
  return {
    text: trimmed ? `${trimmed}\n\n${marker}` : marker.slice(0, params.maxChars),
    shownChildren,
    truncatedChildren,
  };
}

function formatChildSection(params: {
  parentLevel: DoltQueryRecord["level"];
  child: DoltQueryRecord;
  childNumber: number;
}): string {
  const content =
    params.parentLevel === "bindle"
      ? extractSummaryText(params.child.payload, params.child.payloadJson)
      : formatTurnContent(params.child);

  return [
    `--- Child ${params.childNumber} (pointer: ${params.child.pointer}, level: ${params.child.level}, tokens: ~${formatTokenCount(params.child.tokenCount)}) ---`,
    content,
  ].join("\n");
}

function buildNoChildrenBody(params: { record: DoltQueryRecord; maxChars: number }): {
  text: string;
  shownChildren: number;
  truncatedChildren: number;
} {
  const payloadFallback = extractSummaryText(params.record.payload, params.record.payloadJson);
  const text = [
    "No lineage children were found for this pointer.",
    "Showing the record payload instead:",
    payloadFallback,
  ].join("\n");

  return {
    text: text.slice(0, Math.max(0, params.maxChars)),
    shownChildren: 0,
    truncatedChildren: 0,
  };
}

function formatTurnContent(record: DoltQueryRecord): string {
  const extracted = extractTurnPayload(record.payload, record.payloadJson);
  const role = extracted.role ?? "unknown";
  const content = extracted.content || "(empty turn content)";
  return `Role: ${role}\n${content}`;
}

function extractSummaryText(payload: unknown, payloadJson: string | null): string {
  if (typeof payload === "string") {
    const normalized = normalizeOptionalString(payload);
    if (normalized) {
      return normalized;
    }
  }

  const record = asRecord(payload);
  if (record) {
    const summary =
      normalizeOptionalString(asString(record.summary)) ??
      normalizeOptionalString(asString(record.summary_text));
    if (summary) {
      return summary;
    }

    const content = extractContentText(record.content);
    if (content) {
      return content;
    }
  }

  return normalizeOptionalString(payloadJson) ?? "(no payload content)";
}

function extractTurnPayload(
  payload: unknown,
  payloadJson: string | null,
): { role: string | null; content: string } {
  if (typeof payload === "string") {
    return {
      role: null,
      content: payload,
    };
  }

  const record = asRecord(payload);
  if (!record) {
    return {
      role: null,
      content: normalizeOptionalString(payloadJson) ?? "",
    };
  }

  const role = normalizeOptionalString(asString(record.role));
  const content = extractContentText(record.content) ?? normalizeOptionalString(payloadJson) ?? "";
  return {
    role,
    content,
  };
}

function extractContentText(content: unknown): string | null {
  if (typeof content === "string") {
    return normalizeOptionalString(content);
  }
  if (!Array.isArray(content)) {
    return null;
  }

  const parts = content
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }
      const block = asRecord(entry);
      if (!block) {
        return "";
      }
      return asString(block.text) ?? asString(block.content) ?? "";
    })
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts.join("\n") : null;
}

function formatEventTime(eventTsMs: number): string {
  if (!Number.isFinite(eventTsMs) || eventTsMs <= 0) {
    return "unknown";
  }
  return new Date(eventTsMs).toISOString();
}

function formatTokenCount(tokenCount: number): number {
  if (!Number.isFinite(tokenCount) || tokenCount < 0) {
    return 0;
  }
  return Math.floor(tokenCount);
}

function normalizeOptionalString(value: string | undefined | null): string | null {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
