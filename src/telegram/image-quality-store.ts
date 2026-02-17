import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { resolveStateDir } from "../config/paths.js";

const STORE_VERSION = 1;

export type TelegramImageQuality = "normal" | "high";

type TelegramImageQualityState = {
  version: number;
  quality: TelegramImageQuality;
};

function normalizeAccountId(accountId?: string): string {
  const trimmed = accountId?.trim();
  if (!trimmed) return "default";
  return trimmed.replace(/[^a-z0-9._-]+/gi, "_");
}

function normalizeChatId(chatId: string | number): string {
  const normalized = String(chatId).trim();
  if (!normalized) throw new Error("chatId is required");
  return normalized;
}

function resolveTelegramImageQualityPath(
  chatId: string | number,
  accountId?: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const stateDir = resolveStateDir(env);
  const normalizedAccount = normalizeAccountId(accountId);
  const safeChatId = normalizeChatId(chatId).replace(/[^a-z0-9._-]+/gi, "_");
  return path.join(stateDir, "telegram", "image-quality", normalizedAccount, `${safeChatId}.json`);
}

function safeParseState(raw: string): TelegramImageQualityState | null {
  try {
    const parsed = JSON.parse(raw) as TelegramImageQualityState;
    if (parsed?.version !== STORE_VERSION) return null;
    if (parsed.quality !== "normal" && parsed.quality !== "high") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function readTelegramImageQualityFile(filePath: string): Promise<TelegramImageQuality> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = safeParseState(raw);
    return parsed?.quality ?? "normal";
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") return "normal";
    return "normal";
  }
}

async function writeTelegramImageQualityFile(
  filePath: string,
  quality: TelegramImageQuality,
): Promise<void> {
  if (quality === "normal") {
    await fs.rm(filePath, { force: true }).catch(() => undefined);
    return;
  }
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const tmp = path.join(dir, `${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);
  const payload: TelegramImageQualityState = {
    version: STORE_VERSION,
    quality,
  };
  await fs.writeFile(tmp, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf-8",
  });
  await fs.chmod(tmp, 0o600);
  await fs.rename(tmp, filePath);
}

export function normalizeTelegramImageQuality(
  value: string | undefined,
): TelegramImageQuality | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "normal" || normalized === "high") return normalized;
  return null;
}

export async function readTelegramChatImageQuality(params: {
  chatId: string | number;
  accountId?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<TelegramImageQuality> {
  const filePath = resolveTelegramImageQualityPath(params.chatId, params.accountId, params.env);
  return await readTelegramImageQualityFile(filePath);
}

export async function setTelegramChatImageQuality(params: {
  chatId: string | number;
  quality: TelegramImageQuality;
  accountId?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{ changed: boolean; quality: TelegramImageQuality }> {
  const filePath = resolveTelegramImageQualityPath(params.chatId, params.accountId, params.env);
  const current = await readTelegramImageQualityFile(filePath);
  if (current === params.quality) {
    return { changed: false, quality: current };
  }
  await writeTelegramImageQualityFile(filePath, params.quality);
  return { changed: true, quality: params.quality };
}
