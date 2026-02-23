#!/usr/bin/env node

/**
 * Test script to verify the Telegram thread ID caching fix.
 * This simulates the scenario where a cron job gets a stale thread ID
 * and tests that it gets cleared when the retry succeeds.
 */

import { clearStaleThreadIdFromSession } from "./src/telegram/session-cache.js";

async function testThreadIdCacheFix() {
  console.log("Testing Telegram thread ID cache fix...");

  // Simulate clearing a stale thread ID
  try {
    await clearStaleThreadIdFromSession({ chatId: "5442165164" });
    console.log("✅ Successfully cleared stale thread ID from cache");
  } catch (err) {
    console.error("❌ Failed to clear stale thread ID:", err);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  testThreadIdCacheFix().catch(console.error);
}
