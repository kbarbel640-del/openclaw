import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";

type SavedToken = {
  token: string;
  createdAt: string; // ISO
  expiresAt?: string; // ISO
  note?: string;
};

const TOKENS_FILENAME = "tokens.json";

function resolveTokensPath(): string {
  return path.join(resolveStateDir(), TOKENS_FILENAME);
}

function loadTokens(): SavedToken[] {
  const p = resolveTokensPath();
  try {
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as SavedToken[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean);
  } catch {
    return [];
  }
}

function saveTokens(tokens: SavedToken[]) {
  const p = resolveTokensPath();
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  } catch (err) {
    // best-effort
    throw err;
  }
}

export function createDeviceToken(opts?: { ttlHours?: number; note?: string }): string {
  const ttlHours = opts?.ttlHours ?? 24;
  const buf = crypto.randomBytes(32);
  const token = buf.toString("hex");
  const now = new Date();
  const expires = new Date(now.getTime() + Math.floor(ttlHours) * 3600 * 1000);
  const entry: SavedToken = {
    token,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    note: opts?.note,
  };
  const tokens = loadTokens();
  tokens.push(entry);
  saveTokens(tokens);
  return token;
}

export function listDeviceTokens(): Array<
  Omit<SavedToken, "token"> & { id: string } & { active: boolean }
> {
  const tokens = loadTokens();
  return tokens.map((t) => ({
    id: t.token.slice(0, 8),
    createdAt: t.createdAt,
    expiresAt: t.expiresAt,
    note: t.note,
    active: !t.expiresAt || new Date(t.expiresAt) > new Date(),
  }));
}

export function validateDeviceToken(candidate?: string): boolean {
  if (!candidate) return false;
  const tokens = loadTokens();
  const now = new Date();
  for (const t of tokens) {
    if (t.token === candidate) {
      if (!t.expiresAt) return true;
      if (new Date(t.expiresAt) > now) return true;
      return false;
    }
  }
  return false;
}

export function pruneExpiredTokens(): number {
  const tokens = loadTokens();
  const now = new Date();
  const remaining = tokens.filter((t) => !t.expiresAt || new Date(t.expiresAt) > now);
  saveTokens(remaining);
  return tokens.length - remaining.length;
}
