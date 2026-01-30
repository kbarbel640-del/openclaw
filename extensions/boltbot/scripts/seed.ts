import { randomUUID } from "node:crypto";
import { LocalReceiptStore } from "../src/stores/local.js";
import type { ActionReceipt } from "../src/receipt-store.js";

const MEDIUM_TOOLS = ["message", "write", "edit", "cron", "sessions_send", "browser", "canvas", "nodes"];
const HIGH_TOOLS = ["exec", "apply_patch", "gateway", "sessions_spawn", "process"];

const ANOMALY_LABELS = ["shell_injection", "data_exfiltration", "unauthorized_gateway"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomHex64(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

function pickTool(): { name: string; tier: "medium" | "high" } {
  const isHigh = Math.random() < 0.4;
  return isHigh
    ? { name: pick(HIGH_TOOLS), tier: "high" }
    : { name: pick(MEDIUM_TOOLS), tier: "medium" };
}

const sessionCount = randInt(3, 5);
const sessionKeys = Array.from({ length: sessionCount }, () => randomUUID());

const now = Date.now();
const DAY_MS = 86_400_000;
const receiptCount = randInt(50, 100);

const receipts: ActionReceipt[] = Array.from({ length: receiptCount }, () => {
  const { name, tier } = pickTool();
  const hasAnomaly = Math.random() < 0.125;

  return {
    id: randomUUID(),
    timestamp: new Date(now - Math.random() * DAY_MS).toISOString(),
    sessionKey: pick(sessionKeys),
    tier,
    toolName: name,
    argumentsHash: randomHex64(),
    resultHash: randomHex64(),
    success: Math.random() < 0.9,
    durationMs: randInt(50, 5000),
    anomalies: hasAnomaly ? [pick(ANOMALY_LABELS)] : [],
    daCommitment: Math.random() < 0.2 ? randomHex64() : undefined,
  };
});

receipts.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

const store = new LocalReceiptStore();
for (const r of receipts) await store.put(r);

console.log(`Seeded ${receipts.length} receipts across ${sessionCount} sessions`);
