/**
 * Load Test Configuration
 *
 * Configuration types and defaults for gateway load testing.
 */

export type LoadTestScenario = "connections" | "chat" | "auth-stress";

export type LoadTestConfig = {
  /** Gateway URL to test against */
  gatewayUrl: string;

  /** Authentication token */
  token?: string;

  /** Test scenario to run */
  scenario: LoadTestScenario;

  /** Test duration in seconds */
  durationSeconds: number;

  /** Number of virtual users / concurrent connections */
  concurrency: number;

  /** Ramp-up time in seconds (0 = instant) */
  rampUpSeconds: number;

  /** Requests per second per virtual user (for throughput tests) */
  rpsPerUser: number;

  /** Enable verbose logging */
  verbose: boolean;

  /** Output format for results */
  outputFormat: "console" | "json";
};

export const DEFAULT_CONFIG: LoadTestConfig = {
  gatewayUrl: "ws://127.0.0.1:18789",
  scenario: "connections",
  durationSeconds: 60,
  concurrency: 50,
  rampUpSeconds: 10,
  rpsPerUser: 1,
  verbose: false,
  outputFormat: "console",
};

export type LoadTestMetrics = {
  scenario: LoadTestScenario;
  startTime: number;
  endTime: number;
  durationMs: number;

  // Connection metrics
  connectionsAttempted: number;
  connectionsSucceeded: number;
  connectionsFailed: number;
  connectionsPeak: number;

  // Request metrics
  requestsTotal: number;
  requestsSucceeded: number;
  requestsFailed: number;
  requestsTimedOut: number;

  // Latency metrics (in milliseconds)
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  latencyMin: number;
  latencyMax: number;
  latencyMean: number;

  // Rate limiting
  rateLimitHits: number;
  authFailures: number;

  // Errors
  errors: ErrorSummary[];
};

export type ErrorSummary = {
  message: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
};

/**
 * Calculate percentile from sorted array of values.
 */
export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))] ?? 0;
}

/**
 * Calculate mean from array of values.
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Aggregate error messages into summaries.
 */
export function aggregateErrors(
  errors: Array<{ message: string; timestamp: number }>,
): ErrorSummary[] {
  const byMessage = new Map<string, ErrorSummary>();

  for (const err of errors) {
    const existing = byMessage.get(err.message);
    if (existing) {
      existing.count += 1;
      existing.lastSeen = err.timestamp;
    } else {
      byMessage.set(err.message, {
        message: err.message,
        count: 1,
        firstSeen: err.timestamp,
        lastSeen: err.timestamp,
      });
    }
  }

  return Array.from(byMessage.values()).sort((a, b) => b.count - a.count);
}

/**
 * Format metrics for console output.
 */
export function formatMetricsConsole(metrics: LoadTestMetrics): string {
  const lines: string[] = [
    "",
    "═══════════════════════════════════════════════════════════════════",
    `  Load Test Results: ${metrics.scenario}`,
    "═══════════════════════════════════════════════════════════════════",
    "",
    `  Duration: ${(metrics.durationMs / 1000).toFixed(1)}s`,
    "",
    "  Connections",
    "  ───────────────────────────────────────────────────────────────────",
    `    Attempted:  ${metrics.connectionsAttempted}`,
    `    Succeeded:  ${metrics.connectionsSucceeded}`,
    `    Failed:     ${metrics.connectionsFailed}`,
    `    Peak:       ${metrics.connectionsPeak}`,
    "",
    "  Requests",
    "  ───────────────────────────────────────────────────────────────────",
    `    Total:      ${metrics.requestsTotal}`,
    `    Succeeded:  ${metrics.requestsSucceeded}`,
    `    Failed:     ${metrics.requestsFailed}`,
    `    Timed Out:  ${metrics.requestsTimedOut}`,
    `    Rate:       ${(metrics.requestsTotal / (metrics.durationMs / 1000)).toFixed(1)} req/s`,
    "",
    "  Latency (ms)",
    "  ───────────────────────────────────────────────────────────────────",
    `    Min:        ${metrics.latencyMin.toFixed(1)}`,
    `    Mean:       ${metrics.latencyMean.toFixed(1)}`,
    `    P50:        ${metrics.latencyP50.toFixed(1)}`,
    `    P95:        ${metrics.latencyP95.toFixed(1)}`,
    `    P99:        ${metrics.latencyP99.toFixed(1)}`,
    `    Max:        ${metrics.latencyMax.toFixed(1)}`,
    "",
    "  Rate Limiting",
    "  ───────────────────────────────────────────────────────────────────",
    `    Rate Limit Hits: ${metrics.rateLimitHits}`,
    `    Auth Failures:   ${metrics.authFailures}`,
    "",
  ];

  if (metrics.errors.length > 0) {
    lines.push("  Errors (Top 5)");
    lines.push("  ───────────────────────────────────────────────────────────────────");
    for (const err of metrics.errors.slice(0, 5)) {
      lines.push(`    [${err.count}x] ${err.message.slice(0, 60)}`);
    }
    lines.push("");
  }

  lines.push("═══════════════════════════════════════════════════════════════════");
  lines.push("");

  return lines.join("\n");
}

/**
 * Parse command-line arguments into config.
 */
export function parseArgs(args: string[]): Partial<LoadTestConfig> {
  const config: Partial<LoadTestConfig> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case "--url":
      case "-u":
        config.gatewayUrl = nextArg;
        i++;
        break;
      case "--token":
      case "-t":
        config.token = nextArg;
        i++;
        break;
      case "--scenario":
      case "-s":
        config.scenario = nextArg as LoadTestScenario;
        i++;
        break;
      case "--duration":
      case "-d":
        config.durationSeconds = parseInt(nextArg ?? "60", 10);
        i++;
        break;
      case "--concurrency":
      case "-c":
        config.concurrency = parseInt(nextArg ?? "50", 10);
        i++;
        break;
      case "--ramp-up":
      case "-r":
        config.rampUpSeconds = parseInt(nextArg ?? "10", 10);
        i++;
        break;
      case "--rps":
        config.rpsPerUser = parseFloat(nextArg ?? "1");
        i++;
        break;
      case "--verbose":
      case "-v":
        config.verbose = true;
        break;
      case "--json":
        config.outputFormat = "json";
        break;
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
    }
  }

  return config;
}

function printUsage(): void {
  console.log(`
Gateway Load Test

Usage:
  bun load-tests/run.ts [options]

Options:
  -u, --url <url>          Gateway WebSocket URL (default: ws://127.0.0.1:18789)
  -t, --token <token>      Authentication token
  -s, --scenario <name>    Test scenario: connections, chat, auth-stress (default: connections)
  -d, --duration <secs>    Test duration in seconds (default: 60)
  -c, --concurrency <n>    Number of concurrent connections (default: 50)
  -r, --ramp-up <secs>     Ramp-up time in seconds (default: 10)
      --rps <n>            Requests per second per user (default: 1)
  -v, --verbose            Enable verbose output
      --json               Output results as JSON
  -h, --help               Show this help

Scenarios:
  connections   WebSocket connection stress test
  chat          Chat message throughput test
  auth-stress   Authentication rate limit verification

Examples:
  bun load-tests/run.ts --scenario connections --concurrency 100 --duration 30
  bun load-tests/run.ts --scenario chat --concurrency 20 --rps 5 --duration 60
  bun load-tests/run.ts --scenario auth-stress --concurrency 10 --duration 30
`);
}
