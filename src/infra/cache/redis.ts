/**
 * Redis client for OpenClaw caching.
 * Works with Redis from Docker, Homebrew, or any external source.
 */

import { Redis } from "ioredis";

export type RedisConfig = {
  /** Full connection URL if provided (preferred). */
  url?: string;
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  connectTimeout?: number;
  maxRetriesPerRequest?: number;
};

let redis: Redis | null = null;

function parseRedisUrl(raw: string): RedisConfig | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
      return null;
    }
    const host = url.hostname || "localhost";
    const port = url.port ? Number(url.port) : 6379;
    // ioredis uses username/password from URL, but we keep config for introspection.
    const password = url.password ? decodeURIComponent(url.password) : undefined;
    const dbPath = url.pathname.replace(/^\//, "");
    const db = dbPath ? Number.parseInt(dbPath, 10) : undefined;
    const tls = url.protocol === "rediss:";
    return {
      url: raw,
      host,
      port,
      password,
      db: Number.isFinite(db as number) ? db : undefined,
      // Keep default prefix unless explicitly overridden.
      keyPrefix: process.env.REDIS_KEY_PREFIX ?? "openclaw:",
      connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT ?? 10000),
      maxRetriesPerRequest: 3,
      ...(tls ? {} : {}),
    };
  } catch {
    return null;
  }
}

export function getRedisConfig(): RedisConfig {
  const urlConfig = process.env.REDIS_URL?.trim()
    ? parseRedisUrl(process.env.REDIS_URL.trim())
    : null;
  if (urlConfig) {
    return urlConfig;
  }
  return {
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB ?? 0),
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? "openclaw:",
    connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT ?? 10000),
    maxRetriesPerRequest: 3,
  };
}

export function getRedis(): Redis {
  if (redis) {
    return redis;
  }

  const config = getRedisConfig();

  const options = {
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db,
    keyPrefix: config.keyPrefix,
    connectTimeout: config.connectTimeout,
    maxRetriesPerRequest: config.maxRetriesPerRequest,
    lazyConnect: true,
    retryStrategy: (times: number) => {
      if (times > 3) {
        return null;
      }
      return Math.min(times * 200, 1000);
    },
  } as const;

  // Prefer REDIS_URL when present so users can use standard tooling/env.
  redis = config.url ? new Redis(config.url, options) : new Redis(options);

  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

export async function isRedisConnected(): Promise<boolean> {
  try {
    const client = getRedis();
    await client.ping();
    return true;
  } catch {
    return false;
  }
}

export { Redis };
