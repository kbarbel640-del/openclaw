import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import { loadJsonFile, saveJsonFile } from "../infra/json-file.js";

export type OrchestratorRequestStatus =
  | "pending"
  | "notified"
  | "resolved"
  | "timeout"
  | "cancelled"
  | "orphaned";

export type OrchestratorRequestRecord = {
  requestId: string;
  childSessionKey: string;
  parentSessionKey: string;
  runId?: string;
  message: string;
  context?: string;
  priority: "normal" | "high";
  status: OrchestratorRequestStatus;
  createdAt: number;
  notifiedAt?: number;
  timeoutAt: number;
  resolvedAt?: number;
  resolvedBySessionKey?: string;
  response?: string;
  error?: string;
};

type PersistedOrchestratorRegistry = {
  version: 1;
  requests: Record<string, OrchestratorRequestRecord>;
};

const REGISTRY_VERSION = 1 as const;

export function resolveOrchestratorRegistryPath(): string {
  return path.join(resolveStateDir(), "orchestrator-requests", "requests.json");
}

export function loadOrchestratorRegistryFromDisk(): Map<string, OrchestratorRequestRecord> {
  const pathname = resolveOrchestratorRegistryPath();
  const raw = loadJsonFile(pathname);
  if (!raw || typeof raw !== "object") {
    return new Map();
  }
  const record = raw as Partial<PersistedOrchestratorRegistry>;
  if (record.version !== 1) {
    return new Map();
  }
  const requestsRaw = record.requests;
  if (!requestsRaw || typeof requestsRaw !== "object") {
    return new Map();
  }
  const out = new Map<string, OrchestratorRequestRecord>();
  for (const [id, entry] of Object.entries(requestsRaw)) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    if (!entry.requestId || typeof entry.requestId !== "string") {
      continue;
    }
    out.set(id, entry);
  }
  return out;
}

export function saveOrchestratorRegistryToDisk(
  requests: Map<string, OrchestratorRequestRecord>,
): void {
  const pathname = resolveOrchestratorRegistryPath();
  const serialized: Record<string, OrchestratorRequestRecord> = {};
  for (const [id, entry] of requests.entries()) {
    serialized[id] = entry;
  }
  saveJsonFile(pathname, { version: REGISTRY_VERSION, requests: serialized });
}
