import fs from "node:fs/promises";
import path from "node:path";
import { PLATFORM_PROTECTED_FILES } from "./constants.js";
import { anyMatch, matchPattern, normalizePath, toUnixPath, uniqueStrings, isStarList, normalizeSkills } from "./normalize.js";
import type { ResolvedTier, TierConfig, ToolPolicy } from "./types.js";

export function resolveToolPolicy(tier: TierConfig): ToolPolicy | undefined {
  const allow = uniqueStrings(tier.tools);
  const deny = uniqueStrings(tier.deny_tools);
  if (allow.length === 0 && deny.length === 0) {
    return { allow: [], deny: undefined };
  }
  if (isStarList(allow) && deny.length === 0) {
    return undefined;
  }
  return {
    allow: isStarList(allow) ? undefined : allow,
    deny: deny.length > 0 ? deny : undefined,
  };
}

export function resolveSkillFilter(tier: TierConfig): string[] | undefined {
  const skills = normalizeSkills(tier.skills);
  if (skills === "*") {
    return undefined;
  }
  return skills;
}

export function resolveMemoryReadPatterns(scope: string[] | undefined, slug: string): string[] {
  const scopes = new Set(uniqueStrings(scope));
  const patterns: string[] = [];

  if (scopes.has("shared")) {
    patterns.push("memory/shared/*", "MEMORY.md");
  }
  if (scopes.has("private")) {
    patterns.push("memory/private/*", "COMPANY.md", "TOOLS.md");
  }
  if (scopes.has("daily")) {
    patterns.push("memory/daily/*");
  }
  if (scopes.has("all_users")) {
    patterns.push("memory/users/*/*");
  }
  if (scopes.has("own_user") && slug) {
    patterns.push(`memory/users/${slug}/*`);
  }

  return uniqueStrings(patterns);
}

export function isExecBlocked(tier: TierConfig, command: string): boolean {
  const value = command.trim();
  if (!value) {
    return false;
  }
  const patterns = uniqueStrings(tier.exec_blocklist);
  if (patterns.length === 0) {
    return false;
  }
  return patterns.some((pattern) => matchPattern(value, pattern));
}

export function isBlockedUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return false;
  }
  const lowered = trimmed.toLowerCase();
  if (lowered.startsWith("file:") || lowered.startsWith("data:")) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    // Strip IPv6 brackets for consistent matching
    const bare = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
    if (bare === "localhost" || bare === "admin.saint.work") {
      return true;
    }
    const ipv4Match = bare.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const octets = ipv4Match.slice(1).map((part) => Number.parseInt(part, 10));
      const valid = octets.every((value) => Number.isInteger(value) && value >= 0 && value <= 255);
      if (valid) {
        const [a, b] = octets;
        // IPv4 loopback & private ranges
        if (
          a === 127 || // 127.0.0.0/8
          a === 0 || // 0.0.0.0/8
          a === 10 || // 10.0.0.0/8
          (a === 192 && b === 168) || // 192.168.0.0/16
          (a === 169 && b === 254) || // 169.254.0.0/16
          (a === 172 && b >= 16 && b <= 31) // 172.16.0.0/12
        ) {
          return true;
        }
      }
    }
    // IPv6 loopback
    if (bare === "::1" || bare === "0:0:0:0:0:0:0:1") {
      return true;
    }
    // IPv4-mapped IPv6 (::ffff:x.x.x.x or normalized ::ffff:HHHH:HHHH)
    const v4MappedDotted = bare.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (v4MappedDotted) {
      return isBlockedUrl(`http://${v4MappedDotted[1]}/`);
    }
    // Node.js normalizes ::ffff:a.b.c.d to ::ffff:HHHH:HHHH — decode hex back to IPv4
    const v4MappedHex = bare.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (v4MappedHex) {
      const hi = parseInt(v4MappedHex[1]!, 16);
      const lo = parseInt(v4MappedHex[2]!, 16);
      const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      return isBlockedUrl(`http://${ipv4}/`);
    }
    // IPv6 link-local addresses (fe80::/10)
    if (/^fe[89ab][0-9a-f]:/.test(bare)) {
      return true;
    }
    // IPv6 unique local addresses (fc00::/7 covers fd00::/8 and fc00::/8)
    if (/^f[cd][0-9a-f]{2}:/.test(bare)) {
      return true;
    }
  } catch {
    // Unparseable URLs are blocked conservatively
    return true;
  }
  return false;
}

function defaultFileAccessForTier(
  tierName: string,
  slug: string,
): {
  read: string[];
  write: string[];
  denyWrite: string[];
} {
  const self = `memory/users/${slug}/*`;
  if (tierName === "owner") {
    return {
      read: ["*"],
      write: ["*"],
      denyWrite: Array.from(PLATFORM_PROTECTED_FILES),
    };
  }
  if (tierName === "manager") {
    return {
      read: [
        "memory/shared/*",
        "memory/daily/*",
        self,
        "skills/*",
        "data/*",
        "SOUL.md",
        "IDENTITY.md",
      ],
      write: ["memory/shared/*", "memory/daily/*", self, "data/*"],
      denyWrite: Array.from(PLATFORM_PROTECTED_FILES),
    };
  }
  if (tierName === "employee") {
    return {
      read: ["memory/shared/*", self, "skills/*", "data/*", "SOUL.md", "IDENTITY.md"],
      write: [self, "data/*"],
      denyWrite: Array.from(PLATFORM_PROTECTED_FILES),
    };
  }
  return {
    read: [],
    write: [],
    denyWrite: Array.from(PLATFORM_PROTECTED_FILES),
  };
}

function resolveFileAccess(tier: ResolvedTier): {
  read: string[];
  write: string[];
  denyWrite: string[];
} {
  const defaults = defaultFileAccessForTier(tier.tierName, tier.contactSlug);
  const custom = tier.tier.file_access;
  return {
    read: uniqueStrings(custom?.read).length > 0 ? uniqueStrings(custom?.read) : defaults.read,
    write: uniqueStrings(custom?.write).length > 0 ? uniqueStrings(custom?.write) : defaults.write,
    denyWrite:
      uniqueStrings(custom?.deny_write).length > 0
        ? uniqueStrings(custom?.deny_write)
        : defaults.denyWrite,
  };
}

export function canReadPath(tier: ResolvedTier, relativePath: string): boolean {
  if (tier.tierName === "owner") {
    return true;
  }
  const normalized = normalizePath(relativePath);
  const access = resolveFileAccess(tier);
  return anyMatch(normalized, access.read);
}

export function canWritePath(tier: ResolvedTier, relativePath: string): boolean {
  const normalized = normalizePath(relativePath);
  const access = resolveFileAccess(tier);
  if (!anyMatch(normalized, access.write)) {
    return false;
  }
  if (PLATFORM_PROTECTED_FILES.has(normalized)) {
    return false;
  }
  if (anyMatch(normalized, access.denyWrite)) {
    return false;
  }
  return true;
}

export function isConfigManagedPath(relativePath: string): boolean {
  const normalized = normalizePath(relativePath);
  if (normalized.startsWith("config/")) {
    return true;
  }
  return (
    normalized === "openclaw.json" ||
    normalized === "openclaw.json5" ||
    normalized.endsWith("/openclaw.json") ||
    normalized.endsWith("/openclaw.json5")
  );
}

export function needsConfigValidation(relativePath: string): boolean {
  const normalized = normalizePath(relativePath);
  return (
    normalized === "config/contacts.json" ||
    normalized === "config/tiers.yaml" ||
    normalized === "openclaw.json" ||
    normalized === "openclaw.json5" ||
    normalized.endsWith("/openclaw.json") ||
    normalized.endsWith("/openclaw.json5")
  );
}

export async function resolveRealPathWithinWorkspace(
  workspaceDir: string,
  inputPath: string,
): Promise<{ abs: string; rel: string }> {
  const root = await fs.realpath(workspaceDir).catch(() => path.resolve(workspaceDir));
  const target = path.resolve(workspaceDir, inputPath);
  const rel = toUnixPath(path.relative(workspaceDir, target));
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("path escapes workspace");
  }

  const existingAnchor = await (async () => {
    let cursor = target;
    while (true) {
      try {
        await fs.access(cursor);
        return cursor;
      } catch {
        const parent = path.dirname(cursor);
        if (parent === cursor) {
          return workspaceDir;
        }
        cursor = parent;
      }
    }
  })();

  const realAnchor = await fs.realpath(existingAnchor).catch(() => existingAnchor);
  const insideRoot = (() => {
    const relToRoot = path.relative(root, realAnchor);
    return relToRoot === "" || (!relToRoot.startsWith("..") && !path.isAbsolute(relToRoot));
  })();
  if (!insideRoot) {
    throw new Error("symlink/path escapes workspace");
  }

  return { abs: target, rel: normalizePath(rel) };
}
