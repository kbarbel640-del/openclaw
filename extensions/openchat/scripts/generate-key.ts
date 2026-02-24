#!/usr/bin/env -S node --import tsx
/**
 * Generates a secp256k1 private key and prints the corresponding
 * Internet Computer principal — everything needed to register an
 * OpenChat bot before the gateway is running.
 *
 * Usage (from repo root):
 *   cd extensions/openchat && pnpm tsx scripts/generate-key.ts
 *
 * Output:
 *   Private key PEM  → paste into openclaw config as channels.openchat.privateKey
 *   Principal        → use when registering the bot on OpenChat
 */
import { execSync } from "node:child_process";
import { BotClientFactory } from "@open-ic/openchat-botclient-ts";

// Generate a secp256k1 key in traditional EC format (BEGIN EC PRIVATE KEY),
// which is what the @dfinity/identity-secp256k1 SDK expects.
const pem = execSync(
  "openssl ecparam -name secp256k1 -genkey -noout | openssl ec -outform PEM 2>/dev/null",
)
  .toString()
  .trim();

// BotClientFactory logs "Principal: <text>" to console as a side effect of createAgent.
// We use a dummy public key and canister ID since we only need the identity to be created.
console.log("=== OpenChat Bot Identity ===\n");
console.log("Deriving principal from key (you will see it printed below)...\n");

new BotClientFactory({
  openchatPublicKey: "dummy",
  icHost: "https://icp-api.io",
  identityPrivateKey: pem,
  openStorageCanisterId: "aaaaa-aa",
});

// One-liner format: real newlines replaced with literal \n
const oneLiner = pem.replace(/\n/g, "\\n");

console.log("\n--- Save as a key file (recommended) ---");
console.log("Copy everything between the dashes and save to ~/.openclaw/openchat-bot.pem:\n");
console.log(pem);

console.log("\n--- Or use as env var / inline config ---");
console.log("OC_PRIVATE_KEY or channels.openchat.privateKey (one line with \\n):\n");
console.log(oneLiner);

console.log("\nEndpoint to register with OpenChat: https://<your-gateway-host>/openchat");
