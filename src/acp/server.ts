#!/usr/bin/env node
/**
 * ACP Server Entry Point
 *
 * Runs Clawd as an ACP agent over stdio.
 * IDEs spawn this as a subprocess and communicate via JSON-RPC.
 *
 * Usage:
 *   clawd-acp [--cwd <dir>] [--verbose]
 */

import { Readable, Writable } from "node:stream";

import { AgentSideConnection, ndJsonStream } from "@agentclientprotocol/sdk";

import { loadConfig } from "../config/config.js";
import { ClawdisAgent } from "./agent.js";
import type { AcpServerOptions } from "./types.js";

/**
 * Start the ACP server, listening on stdin/stdout.
 */
export function serveAcp(opts: AcpServerOptions = {}): void {
  const config = loadConfig();

  // Log to stderr so we don't interfere with JSON-RPC on stdout
  const log = opts.verbose
    ? (msg: string) => process.stderr.write(`[acp] ${msg}\n`)
    : () => {};

  log("starting ACP server");

  // Create Web Streams from Node streams for the SDK
  const input = Writable.toWeb(process.stdout);
  const output = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>;

  // Create the JSON-RPC stream
  const stream = ndJsonStream(input, output);

  // Create the connection and agent
  new AgentSideConnection((conn) => new ClawdisAgent(conn, { config }), stream);

  log("ACP server ready");
}

/**
 * CLI entry point.
 */
function main(): void {
  const args = process.argv.slice(2);
  const opts: AcpServerOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--cwd" && args[i + 1]) {
      opts.cwd = args[++i];
    } else if (arg === "--verbose" || arg === "-v") {
      opts.verbose = true;
    } else if (arg === "--config" && args[i + 1]) {
      opts.configPath = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: clawd-acp [options]

Run Clawd as an ACP agent over stdio.

Options:
  --cwd <dir>      Working directory (default: current directory)
  --config <path>  Config file path
  --verbose, -v    Enable verbose logging to stderr
  --help, -h       Show this help message
`);
      process.exit(0);
    }
  }

  serveAcp(opts);
}

// Run if executed directly
main();
