import fs from "node:fs";
import path from "node:path";
import { writeJsonFileAtomically } from "../plugin-sdk/json-store.js";
import { CONFIG_DIR, safeParseJson } from "../utils.js";
import { serializeByKey } from "./skills/serialize.js";

const fsp = fs.promises;
const SKILLS_USAGE_FILE = "skills-usage.json";
const SKILLS_USAGE_VERSION = 1;

export type SkillUsageEntry = {
  firstSeenAt: string;
  lastSeenAt: string;
  commandCalls: number;
  mappedToolCalls: number;
  totalCalls: number;
};

export type SkillsUsageStore = {
  version: number;
  updatedAt: string;
  meta: {
    unmappedToolCalls: number;
    mappedByRunContext: number;
    mappedByStaticDispatch: number;
  };
  skills: Record<string, SkillUsageEntry>;
};

export type SkillsUsageRow = {
  skillName: string;
  firstSeenAt: string;
  lastSeenAt: string;
  commandCalls: number;
  mappedToolCalls: number;
  totalCalls: number;
};

function nowIso(): string {
  return new Date().toISOString();
}

function createEmptyStore(now: string = nowIso()): SkillsUsageStore {
  return {
    version: SKILLS_USAGE_VERSION,
    updatedAt: now,
    meta: {
      unmappedToolCalls: 0,
      mappedByRunContext: 0,
      mappedByStaticDispatch: 0,
    },
    skills: {},
  };
}

function isValidNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function sanitizeEntry(entry: unknown, now: string): SkillUsageEntry | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }
  const record = entry as Record<string, unknown>;
  const firstSeenAt =
    typeof record.firstSeenAt === "string" && record.firstSeenAt.trim() ? record.firstSeenAt : now;
  const lastSeenAt =
    typeof record.lastSeenAt === "string" && record.lastSeenAt.trim() ? record.lastSeenAt : now;
  const commandCalls = isValidNumber(record.commandCalls) ? Math.floor(record.commandCalls) : 0;
  const mappedToolCalls = isValidNumber(record.mappedToolCalls)
    ? Math.floor(record.mappedToolCalls)
    : 0;
  const totalRaw = isValidNumber(record.totalCalls)
    ? Math.floor(record.totalCalls)
    : commandCalls + mappedToolCalls;
  const totalCalls = Math.max(totalRaw, commandCalls + mappedToolCalls);
  return {
    firstSeenAt,
    lastSeenAt,
    commandCalls,
    mappedToolCalls,
    totalCalls,
  };
}

function sanitizeStore(input: unknown, now: string = nowIso()): SkillsUsageStore {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return createEmptyStore(now);
  }
  const record = input as Record<string, unknown>;
  const skillsRecord =
    record.skills && typeof record.skills === "object" && !Array.isArray(record.skills)
      ? (record.skills as Record<string, unknown>)
      : {};
  const skills: Record<string, SkillUsageEntry> = {};
  for (const [rawName, value] of Object.entries(skillsRecord)) {
    const skillName = rawName.trim();
    if (!skillName) {
      continue;
    }
    const entry = sanitizeEntry(value, now);
    if (!entry) {
      continue;
    }
    skills[skillName] = entry;
  }
  return {
    version: SKILLS_USAGE_VERSION,
    updatedAt:
      typeof record.updatedAt === "string" && record.updatedAt.trim() ? record.updatedAt : now,
    meta: {
      unmappedToolCalls: isValidNumber(
        (record.meta as { unmappedToolCalls?: unknown })?.unmappedToolCalls,
      )
        ? Math.floor((record.meta as { unmappedToolCalls?: number }).unmappedToolCalls ?? 0)
        : 0,
      mappedByRunContext: isValidNumber(
        (record.meta as { mappedByRunContext?: unknown })?.mappedByRunContext,
      )
        ? Math.floor((record.meta as { mappedByRunContext?: number }).mappedByRunContext ?? 0)
        : 0,
      mappedByStaticDispatch: isValidNumber(
        (record.meta as { mappedByStaticDispatch?: unknown })?.mappedByStaticDispatch,
      )
        ? Math.floor(
            (record.meta as { mappedByStaticDispatch?: number }).mappedByStaticDispatch ?? 0,
          )
        : 0,
    },
    skills,
  };
}

export function resolveSkillsUsageStorePath(): string {
  return path.join(CONFIG_DIR, SKILLS_USAGE_FILE);
}

function resolveSkillsUsageBackupPath(filePath: string): string {
  return `${filePath}.bak`;
}

async function readStoreFromPath(filePath: string): Promise<SkillsUsageStore | null> {
  try {
    const raw = await fsp.readFile(filePath, "utf-8");
    const parsed = safeParseJson<unknown>(raw);
    if (parsed === null) {
      return null;
    }
    return sanitizeStore(parsed);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "ENOENT") {
      return createEmptyStore();
    }
    return null;
  }
}

export async function loadSkillsUsageStore(): Promise<SkillsUsageStore> {
  const filePath = resolveSkillsUsageStorePath();
  const primary = await readStoreFromPath(filePath);
  if (primary) {
    return primary;
  }
  const backup = await readStoreFromPath(resolveSkillsUsageBackupPath(filePath));
  return backup ?? createEmptyStore();
}

async function persistSkillsUsageStore(store: SkillsUsageStore): Promise<void> {
  const filePath = resolveSkillsUsageStorePath();
  const backupPath = resolveSkillsUsageBackupPath(filePath);
  await fsp.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  try {
    await fsp.copyFile(filePath, backupPath);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code !== "ENOENT") {
      throw error;
    }
  }
  await writeJsonFileAtomically(filePath, store);
}

async function mutateStore(
  mutator: (store: SkillsUsageStore, now: string) => void,
): Promise<SkillsUsageStore> {
  const filePath = resolveSkillsUsageStorePath();
  return serializeByKey(`skills-usage:${filePath}`, async () => {
    const now = nowIso();
    const store = await loadSkillsUsageStore();
    mutator(store, now);
    store.updatedAt = now;
    await persistSkillsUsageStore(store);
    return store;
  });
}

function ensureSkillRecord(
  store: SkillsUsageStore,
  skillName: string,
  now: string,
): SkillUsageEntry {
  const existing = store.skills[skillName];
  if (existing) {
    existing.lastSeenAt = now;
    return existing;
  }
  const created: SkillUsageEntry = {
    firstSeenAt: now,
    lastSeenAt: now,
    commandCalls: 0,
    mappedToolCalls: 0,
    totalCalls: 0,
  };
  store.skills[skillName] = created;
  return created;
}

export async function registerSkillsUsageEntries(skillNames: string[]): Promise<SkillsUsageStore> {
  return mutateStore((store, now) => {
    for (const rawName of skillNames) {
      const skillName = rawName.trim();
      if (!skillName) {
        continue;
      }
      ensureSkillRecord(store, skillName, now);
    }
  });
}

export async function incrementSkillCommandUsage(skillName: string): Promise<SkillsUsageStore> {
  return mutateStore((store, now) => {
    const name = skillName.trim();
    if (!name) {
      return;
    }
    const entry = ensureSkillRecord(store, name, now);
    entry.commandCalls += 1;
    entry.totalCalls = entry.commandCalls + entry.mappedToolCalls;
    entry.lastSeenAt = now;
  });
}

export async function incrementMappedToolUsage(skillNames: string[]): Promise<SkillsUsageStore> {
  return mutateStore((store, now) => {
    for (const rawName of skillNames) {
      const skillName = rawName.trim();
      if (!skillName) {
        continue;
      }
      const entry = ensureSkillRecord(store, skillName, now);
      entry.mappedToolCalls += 1;
      entry.totalCalls = entry.commandCalls + entry.mappedToolCalls;
      entry.lastSeenAt = now;
    }
  });
}

export async function incrementUnmappedToolUsage(count = 1): Promise<SkillsUsageStore> {
  return mutateStore((store) => {
    const incrementBy = Number.isFinite(count) && count > 0 ? Math.max(1, Math.floor(count)) : 1;
    store.meta.unmappedToolCalls += incrementBy;
  });
}

export async function incrementMappedByRunContextUsage(count = 1): Promise<SkillsUsageStore> {
  return mutateStore((store) => {
    const incrementBy = Number.isFinite(count) && count > 0 ? Math.max(1, Math.floor(count)) : 1;
    store.meta.mappedByRunContext += incrementBy;
  });
}

export async function incrementMappedByStaticDispatchUsage(count = 1): Promise<SkillsUsageStore> {
  return mutateStore((store) => {
    const incrementBy = Number.isFinite(count) && count > 0 ? Math.max(1, Math.floor(count)) : 1;
    store.meta.mappedByStaticDispatch += incrementBy;
  });
}

export function buildSkillsUsageRows(store: SkillsUsageStore): SkillsUsageRow[] {
  return Object.entries(store.skills)
    .map(([skillName, entry]) => ({
      skillName,
      firstSeenAt: entry.firstSeenAt,
      lastSeenAt: entry.lastSeenAt,
      commandCalls: entry.commandCalls,
      mappedToolCalls: entry.mappedToolCalls,
      totalCalls: entry.totalCalls,
    }))
    .toSorted((a, b) => b.totalCalls - a.totalCalls || a.skillName.localeCompare(b.skillName));
}

function csvCell(value: string | number): string {
  const text = String(value);
  if (!/[",\n]/.test(text)) {
    return text;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

export function formatSkillsUsageCsv(rows: SkillsUsageRow[]): string {
  const header = [
    "skill",
    "commandCalls",
    "mappedToolCalls",
    "totalCalls",
    "firstSeenAt",
    "lastSeenAt",
  ];
  const body = rows.map((row) =>
    [
      row.skillName,
      row.commandCalls,
      row.mappedToolCalls,
      row.totalCalls,
      row.firstSeenAt,
      row.lastSeenAt,
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...body].join("\n");
}

export function formatSkillsUsageMarkdown(rows: SkillsUsageRow[]): string {
  const lines = [
    "| Skill | Command Calls | Mapped Tool Calls | Total Calls | First Seen | Last Seen |",
    "| --- | ---: | ---: | ---: | --- | --- |",
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.skillName} | ${row.commandCalls} | ${row.mappedToolCalls} | ${row.totalCalls} | ${row.firstSeenAt} | ${row.lastSeenAt} |`,
    );
  }
  return lines.join("\n");
}
