#!/usr/bin/env bun
/**
 * Gateway Load Test Runner
 *
 * Entry point for running gateway load tests.
 *
 * Usage:
 *   bun load-tests/run.ts --scenario connections --concurrency 100 --duration 30
 *   bun load-tests/run.ts --scenario chat --concurrency 20 --rps 5 --duration 60
 *   bun load-tests/run.ts --scenario auth-stress --concurrency 10 --duration 30
 */

import { DEFAULT_CONFIG, formatMetricsConsole, parseArgs } from "./config.js";
import type { LoadTestConfig, LoadTestMetrics } from "./config.js";
import { runConnectionsTest } from "./gateway-ws.js";
import { runChatTest } from "./gateway-chat.js";
import { runAuthStressTest } from "./gateway-auth.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const parsedArgs = parseArgs(args);

  const config: LoadTestConfig = {
    ...DEFAULT_CONFIG,
    ...parsedArgs,
  };

  // Validate config
  if (!config.gatewayUrl) {
    console.error("Error: Gateway URL is required (--url or -u)");
    process.exit(1);
  }

  if (!["connections", "chat", "auth-stress"].includes(config.scenario)) {
    console.error(`Error: Invalid scenario "${config.scenario}". Use: connections, chat, auth-stress`);
    process.exit(1);
  }

  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║              Clawdbot Gateway Load Test                          ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`  Scenario:     ${config.scenario}`);
  console.log(`  Gateway:      ${config.gatewayUrl}`);
  console.log(`  Concurrency:  ${config.concurrency}`);
  console.log(`  Duration:     ${config.durationSeconds}s`);
  console.log(`  Ramp-up:      ${config.rampUpSeconds}s`);
  if (config.scenario === "chat") {
    console.log(`  RPS/user:     ${config.rpsPerUser}`);
  }
  console.log(`  Auth:         ${config.token ? "token provided" : "none"}`);
  console.log("");

  let metrics: LoadTestMetrics;

  try {
    switch (config.scenario) {
      case "connections":
        metrics = await runConnectionsTest(config);
        break;
      case "chat":
        metrics = await runChatTest(config);
        break;
      case "auth-stress":
        metrics = await runAuthStressTest(config);
        break;
    }
  } catch (err) {
    console.error(`\nLoad test failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // Output results
  if (config.outputFormat === "json") {
    console.log(JSON.stringify(metrics, null, 2));
  } else {
    console.log(formatMetricsConsole(metrics));
  }

  // Exit with error code if significant failures
  const failureRate = metrics.requestsTotal > 0
    ? metrics.requestsFailed / metrics.requestsTotal
    : 0;

  if (failureRate > 0.1) {
    console.log("⚠️  Warning: Failure rate > 10%");
    process.exit(1);
  }

  if (metrics.connectionsFailed > 0 && metrics.connectionsSucceeded === 0) {
    console.log("⚠️  Warning: All connections failed");
    process.exit(1);
  }

  console.log("✓ Load test completed successfully");
}

main().catch((err) => {
  console.error(`Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
