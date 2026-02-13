import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { Contact, TierConfig } from "./types.js";

export function normalizeId(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

const CONTACT_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function isValidContactSlug(value: string): boolean {
  return CONTACT_SLUG_PATTERN.test(value);
}

export function normalizePhone(value?: string | null): string {
  const raw = (value ?? "").trim();
  if (!raw) {
    return "";
  }
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) {
    return "";
  }
  return hasPlus ? `+${digits}` : digits;
}

export function normalizePath(value: string): string {
  const normalized = path.posix.normalize(value.replaceAll("\\", "/"));
  return normalized.replace(/^\.\//, "");
}

export function toUnixPath(value: string): string {
  return value.replaceAll("\\", "/");
}

export function uniqueStrings(values?: string[]): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    if (typeof raw !== "string") {
      continue;
    }
    const value = raw.trim();
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out;
}

export function normalizeToolName(value: string): string {
  return value.trim().toLowerCase();
}

export function isStarList(list?: string[]): boolean {
  return (list ?? []).some((entry) => entry.trim() === "*");
}

export function normalizeSkills(value: TierConfig["skills"]): "*" | string[] {
  if (value === "*") {
    return "*";
  }
  return uniqueStrings(Array.isArray(value) ? value : []);
}

export function coerceFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

export function normalizeSessionsScope(value: unknown): "all" | "own" | undefined {
  if (value === "all" || value === "own") {
    return value;
  }
  return undefined;
}

export function toArrayOrUndefined(value: unknown): string[] | undefined {
  const entries = uniqueStrings(Array.isArray(value) ? value : []);
  return entries.length > 0 ? entries : undefined;
}

export function parseJsonSafe<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function parseYamlSafe<T>(raw: string): T | null {
  try {
    return parseYaml(raw) as T;
  } catch {
    return null;
  }
}

export async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

export async function readMtimeMs(filePath: string): Promise<number> {
  try {
    const stat = await fs.stat(filePath);
    return stat.mtimeMs;
  } catch {
    return -1;
  }
}

export function normalizeExternalSlugPart(value: string): string {
  const lowered = value.trim().toLowerCase();
  const compact = lowered
    .replace(/[^a-z0-9@._+-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return compact || "unknown";
}

export function resolveExternalSlug(params: {
  messageProvider?: string;
  peerId?: string;
  senderE164?: string;
}): string {
  const peerIdRaw = params.peerId?.trim() ?? "";
  const senderPhone = normalizePhone(params.senderE164);

  let provider = normalizeId(params.messageProvider);
  let identity = "";

  if (senderPhone) {
    identity = senderPhone;
  } else if (peerIdRaw) {
    const split = peerIdRaw.split(":");
    if (!provider && split.length >= 2) {
      provider = normalizeId(split[0]);
      identity = split.slice(1).join(":");
    } else {
      identity = peerIdRaw;
    }
  }

  if (!provider) {
    provider = "external";
  }
  const slugIdentity = normalizeExternalSlugPart(identity || "unknown");
  return `${provider}-${slugIdentity}`.slice(0, 96);
}

export function resolveWorkspaceDir(ctx: {
  workspaceDir?: string;
  agentWorkspaceDir?: string;
}): string | null {
  const dir = ctx.agentWorkspaceDir?.trim() || ctx.workspaceDir?.trim();
  return dir ? path.resolve(dir) : null;
}

export function matchPattern(value: string, pattern: string): boolean {
  if (pattern === "*") {
    return true;
  }
  // No wildcards -- exact match
  if (!pattern.includes("*")) {
    return value === pattern;
  }
  // Split on wildcards and match segments linearly to avoid ReDoS
  const segments = pattern.split("*");
  let pos = 0;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    if (i === 0) {
      // First segment must match the start
      if (!value.startsWith(segment)) {
        return false;
      }
      pos = segment.length;
    } else if (i === segments.length - 1) {
      // Last segment must match the end
      if (!value.endsWith(segment)) {
        return false;
      }
      if (value.length - segment.length < pos) {
        return false;
      }
    } else {
      // Middle segment must appear somewhere after current pos
      const idx = value.indexOf(segment, pos);
      if (idx === -1) {
        return false;
      }
      pos = idx + segment.length;
    }
  }
  return true;
}

export function anyMatch(value: string, patterns?: string[]): boolean {
  const list = uniqueStrings(patterns);
  if (list.length === 0) {
    return false;
  }
  return list.some((pattern) => matchPattern(value, pattern));
}

export function normalizeContact(entry: Contact): Contact | null {
  const slug = normalizeId(entry.slug);
  if (!slug || !isValidContactSlug(slug)) {
    return null;
  }
  const identifiers: Record<string, string> = {};
  const sourceIds = entry.identifiers ?? {};
  for (const [key, value] of Object.entries(sourceIds)) {
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed) {
      identifiers[key] = trimmed;
    }
  }
  return {
    slug,
    name: typeof entry.name === "string" ? entry.name.trim() : undefined,
    tier: typeof entry.tier === "string" ? normalizeId(entry.tier) : undefined,
    identifiers,
  };
}
