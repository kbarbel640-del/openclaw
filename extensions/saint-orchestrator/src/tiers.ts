import fs from "node:fs/promises";
import path from "node:path";
import type {
  Contact,
  ContactsFile,
  ExternalTierConfig,
  ResolvedTier,
  SaintState,
  TierConfig,
  TierFile,
  TierSet,
} from "./types.js";
import {
  FALLBACK_CUSTOM,
  FALLBACK_EXTERNAL_CEILING,
  FALLBACK_OWNER_CEILING,
  STATE_CACHE_TTL_MS,
} from "./constants.js";
import {
  coerceFiniteNumber,
  isStarList,
  normalizeContact,
  normalizeExternalSlugPart,
  normalizeId,
  normalizePhone,
  normalizeSessionsScope,
  normalizeSkills,
  parseJsonSafe,
  parseYamlSafe,
  readFileIfExists,
  readMtimeMs,
  resolveExternalSlug,
  uniqueStrings,
} from "./normalize.js";

export function mergeTier(base: TierConfig, overlay?: TierConfig): TierConfig {
  const mergedTools = uniqueStrings([...(base.tools ?? []), ...(overlay?.tools ?? [])]);
  const mergedDenyTools = uniqueStrings([
    ...(base.deny_tools ?? []),
    ...(overlay?.deny_tools ?? []),
  ]);
  const mergedExecBlocklist = uniqueStrings([
    ...(base.exec_blocklist ?? []),
    ...(overlay?.exec_blocklist ?? []),
  ]);

  const merged: TierConfig = {
    description: overlay?.description ?? base.description,
    tools: mergedTools,
    deny_tools: mergedDenyTools,
    exec_blocklist: mergedExecBlocklist,
    memory_scope: overlay?.memory_scope
      ? uniqueStrings(overlay.memory_scope)
      : uniqueStrings(base.memory_scope),
    skills:
      overlay?.skills !== undefined
        ? normalizeSkills(overlay.skills)
        : normalizeSkills(base.skills),
    max_budget_usd:
      overlay?.max_budget_usd === null
        ? null
        : (coerceFiniteNumber(overlay?.max_budget_usd) ?? base.max_budget_usd),
    system_prompt_includes: {
      bootstrap: uniqueStrings([
        ...(base.system_prompt_includes?.bootstrap ?? []),
        ...(overlay?.system_prompt_includes?.bootstrap ?? []),
      ]),
      inject: uniqueStrings([
        ...(base.system_prompt_includes?.inject ?? []),
        ...(overlay?.system_prompt_includes?.inject ?? []),
      ]),
    },
    file_access: {
      read: uniqueStrings([
        ...(base.file_access?.read ?? []),
        ...(overlay?.file_access?.read ?? []),
      ]),
      write: uniqueStrings([
        ...(base.file_access?.write ?? []),
        ...(overlay?.file_access?.write ?? []),
      ]),
      deny_write: uniqueStrings([
        ...(base.file_access?.deny_write ?? []),
        ...(overlay?.file_access?.deny_write ?? []),
      ]),
    },
    sessions_scope:
      normalizeSessionsScope(overlay?.sessions_scope) ??
      normalizeSessionsScope(base.sessions_scope) ??
      "own",
    model: overlay?.model ?? base.model,
  };

  if (!merged.tools || merged.tools.length === 0) {
    merged.tools = [];
  }
  if (!merged.deny_tools || merged.deny_tools.length === 0) {
    merged.deny_tools = [];
  }
  if (!merged.exec_blocklist || merged.exec_blocklist.length === 0) {
    merged.exec_blocklist = [];
  }
  if (!merged.memory_scope) {
    merged.memory_scope = [];
  }
  if (!merged.system_prompt_includes) {
    merged.system_prompt_includes = { bootstrap: [], inject: [] };
  }
  if (!merged.file_access) {
    merged.file_access = { read: [], write: [], deny_write: [] };
  }
  return merged;
}

function isSubsetList(list: string[], ceiling: string[]): boolean {
  if (isStarList(ceiling)) {
    return true;
  }
  const ceilingSet = new Set(ceiling.map((entry) => entry.trim()));
  for (const entry of list) {
    if (!ceilingSet.has(entry.trim())) {
      return false;
    }
  }
  return true;
}

export function validateTierAgainstCeiling(params: {
  tierName: string;
  tier: TierConfig;
  ceiling: TierConfig;
}): string[] {
  const { tierName, tier, ceiling } = params;
  const errors: string[] = [];

  const tierTools = uniqueStrings(tier.tools);
  const ceilingTools = uniqueStrings(ceiling.tools);
  if (isStarList(tierTools) && !isStarList(ceilingTools)) {
    errors.push(`${tierName}: tools contains '*' beyond ceiling`);
  } else if (!isStarList(tierTools) && !isSubsetList(tierTools, ceilingTools)) {
    errors.push(`${tierName}: tools exceed ceiling`);
  }

  const tierScopes = uniqueStrings(tier.memory_scope);
  const ceilingScopes = uniqueStrings(ceiling.memory_scope);
  if (!isSubsetList(tierScopes, ceilingScopes)) {
    errors.push(`${tierName}: memory_scope exceeds ceiling`);
  }

  const tierSkills = normalizeSkills(tier.skills);
  const ceilingSkills = normalizeSkills(ceiling.skills);
  if (tierSkills === "*" && ceilingSkills !== "*") {
    errors.push(`${tierName}: skills '*' exceeds ceiling`);
  } else if (
    Array.isArray(tierSkills) &&
    Array.isArray(ceilingSkills) &&
    !isSubsetList(tierSkills, ceilingSkills)
  ) {
    errors.push(`${tierName}: skills exceed ceiling`);
  }

  const tierBudget = tier.max_budget_usd;
  const ceilingBudget = ceiling.max_budget_usd;
  if (
    typeof tierBudget === "number" &&
    Number.isFinite(tierBudget) &&
    typeof ceilingBudget === "number" &&
    Number.isFinite(ceilingBudget) &&
    tierBudget > ceilingBudget
  ) {
    errors.push(`${tierName}: max_budget_usd exceeds ceiling`);
  }

  const tierRead = uniqueStrings(tier.file_access?.read);
  const tierWrite = uniqueStrings(tier.file_access?.write);
  const ceilingRead = uniqueStrings(ceiling.file_access?.read);
  const ceilingWrite = uniqueStrings(ceiling.file_access?.write);
  if (tierRead.length > 0 && ceilingRead.length > 0 && !isSubsetList(tierRead, ceilingRead)) {
    errors.push(`${tierName}: file_access.read exceeds ceiling`);
  }
  if (tierWrite.length > 0 && ceilingWrite.length > 0 && !isSubsetList(tierWrite, ceilingWrite)) {
    errors.push(`${tierName}: file_access.write exceeds ceiling`);
  }

  return errors;
}

/** If ceiling is non-empty, intersect; otherwise pass through (empty ceiling = no restriction). */
export function filterByCeiling(tierList: string[], ceilingList: string[]): string[] {
  if (ceilingList.length === 0) {
    return tierList;
  }
  const allowed = new Set(ceilingList);
  return tierList.filter((entry) => allowed.has(entry));
}

export function clampByCeiling(tier: TierConfig, ceiling: TierConfig): TierConfig {
  const tools = uniqueStrings(tier.tools);
  const ceilingTools = uniqueStrings(ceiling.tools);
  const clampedTools = isStarList(ceilingTools)
    ? tools
    : tools.filter((entry) => new Set(ceilingTools).has(entry));

  const memoryScope = uniqueStrings(tier.memory_scope).filter((entry) =>
    new Set(uniqueStrings(ceiling.memory_scope)).has(entry),
  );

  const ceilingSkills = normalizeSkills(ceiling.skills);
  const tierSkills = normalizeSkills(tier.skills);
  let skills: "*" | string[];
  if (ceilingSkills === "*") {
    skills = tierSkills;
  } else if (tierSkills === "*") {
    skills = Array.isArray(ceilingSkills) ? ceilingSkills : [];
  } else {
    const allowed = new Set(Array.isArray(ceilingSkills) ? ceilingSkills : []);
    skills = Array.isArray(tierSkills) ? tierSkills.filter((entry) => allowed.has(entry)) : [];
  }

  const ceilingBudget = coerceFiniteNumber(ceiling.max_budget_usd);
  const tierBudget = coerceFiniteNumber(tier.max_budget_usd);
  const maxBudgetUsd =
    ceiling.max_budget_usd === null
      ? (tier.max_budget_usd ?? null)
      : typeof tierBudget === "number" && typeof ceilingBudget === "number"
        ? Math.min(tierBudget, ceilingBudget)
        : (ceilingBudget ?? tier.max_budget_usd);

  const allowedBootstrap = uniqueStrings(ceiling.system_prompt_includes?.bootstrap);
  const allowedInject = uniqueStrings(ceiling.system_prompt_includes?.inject);

  return {
    ...tier,
    tools: clampedTools,
    memory_scope: memoryScope,
    skills,
    max_budget_usd: maxBudgetUsd ?? null,
    system_prompt_includes: {
      bootstrap:
        allowedBootstrap.length === 0
          ? uniqueStrings(tier.system_prompt_includes?.bootstrap)
          : uniqueStrings(tier.system_prompt_includes?.bootstrap).filter((entry) =>
              new Set(allowedBootstrap).has(entry),
            ),
      inject:
        allowedInject.length === 0
          ? uniqueStrings(tier.system_prompt_includes?.inject)
          : uniqueStrings(tier.system_prompt_includes?.inject).filter((entry) =>
              new Set(allowedInject).has(entry),
            ),
    },
    file_access: {
      read: filterByCeiling(
        uniqueStrings(tier.file_access?.read),
        uniqueStrings(ceiling.file_access?.read),
      ),
      write: filterByCeiling(
        uniqueStrings(tier.file_access?.write),
        uniqueStrings(ceiling.file_access?.write),
      ),
      deny_write: uniqueStrings(tier.file_access?.deny_write),
    },
  };
}

function normalizeExternalTier(raw: ExternalTierConfig | undefined): {
  ceiling: TierConfig;
  effective: TierConfig;
} {
  if (!raw || typeof raw !== "object") {
    return {
      ceiling: mergeTier(FALLBACK_EXTERNAL_CEILING, {}),
      effective: mergeTier(FALLBACK_EXTERNAL_CEILING, {}),
    };
  }

  if ("ceiling" in raw || "effective" in raw) {
    const ceiling = mergeTier(FALLBACK_EXTERNAL_CEILING, raw.ceiling ?? {});
    const effectiveBase = mergeTier(ceiling, raw.effective ?? {});
    return {
      ceiling: clampByCeiling(ceiling, FALLBACK_EXTERNAL_CEILING),
      effective: clampByCeiling(effectiveBase, ceiling),
    };
  }

  const plain = raw as TierConfig;
  const effective = mergeTier(FALLBACK_EXTERNAL_CEILING, plain);
  const ceiling = mergeTier(FALLBACK_EXTERNAL_CEILING, plain);
  return {
    ceiling: clampByCeiling(ceiling, FALLBACK_EXTERNAL_CEILING),
    effective: clampByCeiling(effective, ceiling),
  };
}

export function normalizeTierState(raw?: TierFile): TierSet {
  const owner = mergeTier(FALLBACK_OWNER_CEILING, raw?.fixed?.owner ?? {});
  const externalNormalized = normalizeExternalTier(raw?.fixed?.external);

  const customMerged: Record<string, TierConfig> = {
    ...Object.fromEntries(
      Object.entries(FALLBACK_CUSTOM).map(([name, tier]) => [name, mergeTier(tier, {})]),
    ),
  };

  for (const [name, tier] of Object.entries(raw?.custom ?? {})) {
    customMerged[normalizeId(name)] = mergeTier(
      { tools: [], skills: [], memory_scope: [] },
      tier ?? {},
    );
  }

  const customClamped: Record<string, TierConfig> = {};
  for (const [name, tier] of Object.entries(customMerged)) {
    customClamped[name] = clampByCeiling(tier, owner);
  }

  return {
    owner,
    externalCeiling: externalNormalized.ceiling,
    externalEffective: externalNormalized.effective,
    custom: customClamped,
  };
}

const stateCache = new Map<
  string,
  {
    loadedAtMs: number;
    contactsMtimeMs: number;
    tiersMtimeMs: number;
    state: SaintState;
  }
>();

export async function loadSaintState(workspaceDir: string): Promise<SaintState> {
  const contactsPath = path.join(workspaceDir, "config", "contacts.json");
  const tiersPath = path.join(workspaceDir, "config", "tiers.yaml");

  const contactsMtimeMs = await readMtimeMs(contactsPath);
  const tiersMtimeMs = await readMtimeMs(tiersPath);
  const cached = stateCache.get(workspaceDir);

  if (
    cached &&
    cached.contactsMtimeMs === contactsMtimeMs &&
    cached.tiersMtimeMs === tiersMtimeMs &&
    Date.now() - cached.loadedAtMs <= STATE_CACHE_TTL_MS
  ) {
    return cached.state;
  }

  const contactsRaw = await readFileIfExists(contactsPath);
  const tiersRaw = await readFileIfExists(tiersPath);

  const contactsDoc = contactsRaw ? parseJsonSafe<ContactsFile>(contactsRaw) : null;
  const tiersDoc = tiersRaw ? parseYamlSafe<TierFile>(tiersRaw) : null;

  const contacts = (contactsDoc?.contacts ?? [])
    .map((entry) => normalizeContact(entry))
    .filter((entry): entry is Contact => Boolean(entry));

  const state: SaintState = {
    contacts,
    tiers: normalizeTierState(tiersDoc ?? {}),
  };

  stateCache.set(workspaceDir, {
    loadedAtMs: Date.now(),
    contactsMtimeMs,
    tiersMtimeMs,
    state,
  });

  return state;
}

function resolveTierForName(state: SaintState, tierName: string): TierConfig {
  if (tierName === "owner") {
    return state.tiers.owner;
  }
  if (tierName === "external") {
    return state.tiers.externalEffective;
  }
  return state.tiers.custom[tierName] ?? state.tiers.externalEffective;
}

export function resolveContact(
  state: SaintState,
  params: { peerId?: string; senderE164?: string },
): Contact | null {
  const peer = normalizeId(params.peerId);
  const phone = normalizePhone(params.senderE164);

  for (const contact of state.contacts) {
    if (peer && normalizeId(contact.slug) === peer) {
      return contact;
    }

    const ids = contact.identifiers ?? {};
    for (const value of Object.values(ids)) {
      const normalized = normalizeId(value);
      const normalizedPhone = normalizePhone(value);
      if (peer && normalized === peer) {
        return contact;
      }
      if (phone && normalizedPhone === phone) {
        return contact;
      }
    }
  }

  return null;
}

export function extractCronJobIdFromSessionKey(sessionKey?: string): string | null {
  const key = sessionKey?.trim();
  if (!key) {
    return null;
  }
  const match = key.match(/cron:([a-z0-9-]{8,})/i);
  return match?.[1] ?? null;
}

export async function readTierMap(
  workspaceDir: string,
  relativePath: string,
): Promise<Record<string, string>> {
  const filePath = path.join(workspaceDir, relativePath);
  const raw = await readFileIfExists(filePath);
  const parsed = raw ? parseJsonSafe<Record<string, unknown>>(raw) : null;
  if (!parsed || typeof parsed !== "object") {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string") {
      continue;
    }
    out[key] = normalizeId(value);
  }
  return out;
}

export async function writeTierMap(
  workspaceDir: string,
  relativePath: string,
  map: Record<string, string>,
) {
  const filePath = path.join(workspaceDir, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(map, null, 2)}\n`, "utf-8");
}

const tierMapWriteQueue = new Map<string, Promise<void>>();

export async function updateTierMap(params: {
  workspaceDir: string;
  relativePath: string;
  update: (
    current: Record<string, string>,
  ) => Record<string, string> | void | Promise<Record<string, string> | void>;
}): Promise<void> {
  const filePath = path.join(params.workspaceDir, params.relativePath);
  const previous = tierMapWriteQueue.get(filePath) ?? Promise.resolve();
  const current = previous
    .catch(() => undefined)
    .then(async () => {
      const currentMap = await readTierMap(params.workspaceDir, params.relativePath);
      const updated = await params.update(currentMap);
      await writeTierMap(params.workspaceDir, params.relativePath, updated ?? currentMap);
    });

  tierMapWriteQueue.set(filePath, current);
  try {
    await current;
  } finally {
    if (tierMapWriteQueue.get(filePath) === current) {
      tierMapWriteQueue.delete(filePath);
    }
  }
}

export async function resolveTierForContext(params: {
  workspaceDir: string;
  messageProvider?: string;
  peerId?: string;
  senderE164?: string;
  sessionKey?: string;
}): Promise<ResolvedTier> {
  const state = await loadSaintState(params.workspaceDir);

  const contact = resolveContact(state, {
    peerId: params.peerId,
    senderE164: params.senderE164,
  });

  if (contact) {
    const tierName = normalizeId(contact.tier) || "external";
    return {
      tierName,
      tier: resolveTierForName(state, tierName),
      contactSlug: contact.slug,
      contactName: contact.name,
      source: "contact",
    };
  }

  const sessionKey = params.sessionKey?.trim();
  if (sessionKey) {
    const subagentMap = await readTierMap(params.workspaceDir, "config/subagent-tiers.json");
    const mappedSubagentTier = normalizeId(subagentMap[sessionKey]);
    if (mappedSubagentTier) {
      return {
        tierName: mappedSubagentTier,
        tier: resolveTierForName(state, mappedSubagentTier),
        contactSlug: `subagent-${normalizeExternalSlugPart(sessionKey)}`,
        source: "subagent",
      };
    }

    const cronJobId = extractCronJobIdFromSessionKey(sessionKey);
    if (cronJobId) {
      const cronMap = await readTierMap(params.workspaceDir, "config/cron-tiers.json");
      const mappedCronTier = normalizeId(cronMap[cronJobId]);
      if (mappedCronTier) {
        return {
          tierName: mappedCronTier,
          tier: resolveTierForName(state, mappedCronTier),
          contactSlug: `cron-${cronJobId}`,
          source: "cron",
        };
      }
    }
  }

  const externalSlug = resolveExternalSlug({
    messageProvider: params.messageProvider,
    peerId: params.peerId,
    senderE164: params.senderE164,
  });

  return {
    tierName: "external",
    tier: state.tiers.externalEffective,
    contactSlug: externalSlug,
    source: "external",
  };
}
