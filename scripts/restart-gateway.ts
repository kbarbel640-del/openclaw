#!/usr/bin/env bun
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Config
const HEALTH_URL = "http://localhost:18789/health";
const MAX_RETRIES = 20; // 20 * 3s = 60s timeout
const RETRY_DELAY_MS = 3000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkHealth(): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`curl -s -f ${HEALTH_URL}`);
    // Check for explicit "ok" or typical health JSON response
    return stdout.includes("ok") || stdout.includes('"status":"ok"');
  } catch (e) {
    return false;
  }
}

async function main() {
  console.log("🔄 Triggering Gateway Restart...");

  try {
    // 1. Trigger Restart (Don't wait for it to finish, as it kills the connection)
    // We use nohup or backgrounding to ensure the restart command survives the parent shell if needed.
    // However, 'openclaw gateway restart' usually handles its own process replacement.
    // We just run it and catch the potential "connection lost" error.
    exec("openclaw gateway restart");
  } catch (e) {
    // Ignore error here, as the command might exit abruptly due to restart
  }

  console.log("⏳ Waiting for Gateway to come back online...");

  // 2. Poll for Health
  for (let i = 1; i <= MAX_RETRIES; i++) {
    const isHealthy = await checkHealth();
    if (isHealthy) {
      console.log(`✅ Gateway is ONLINE! (Attempt ${i}/${MAX_RETRIES})`);
      process.exit(0);
    }
    process.stdout.write(".");
    await sleep(RETRY_DELAY_MS);
  }

  console.error("\n❌ Timeout: Gateway failed to recover within 60 seconds.");
  console.error("💡 Suggestion: Check logs with 'openclaw logs --limit 20'");
  process.exit(1);
}

main();
