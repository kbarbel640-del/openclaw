#!/usr/bin/env bun
/**
 * scripts/scan-trends.ts
 *
 * Trigger the Market Watch (Intel Radar) skill via OpenClaw Agent.
 * Usage: bun scripts/scan-trends.ts
 */

import { $ } from "bun";

console.log("📡 Intel Radar: Initiating Trend Scan...");

// Trigger the agent to perform the scan
// This assumes 'openclaw' CLI is available and authenticated
try {
  // We use sessions spawn to offload the heavy lifting to the AI agent
  // The agent will use skills/market-watch/SKILL.md
  await $`openclaw sessions spawn --task "Run Intel Radar Daily Brief and send report to Telegram" --thinking low`;
  console.log("✅ Scan task dispatched to Agent.");
} catch (error) {
  console.error("❌ Failed to dispatch task:", error);
  process.exit(1);
}
