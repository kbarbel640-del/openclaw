#!/usr/bin/env node

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { Command } from "commander";
import {
  generateKeypair,
  getPublicKey,
  loadPrivateKey,
  savePrivateKey,
  sign,
  toHex,
} from "./wallet.js";

const DEFAULT_DIR = join(homedir(), ".dem");
const DEFAULT_KEY_PATH = join(DEFAULT_DIR, "private.key");

/** Ensure the ~/.dem directory exists with safe permissions. */
function ensureConfigDir(): void {
  if (!existsSync(DEFAULT_DIR)) {
    mkdirSync(DEFAULT_DIR, { recursive: true, mode: 0o700 });
  }
}

/** Safely load the private key, providing a clear error on failure. */
function loadKey(): Uint8Array {
  if (!existsSync(DEFAULT_KEY_PATH)) {
    console.error(
      `Error: private key not found at ${DEFAULT_KEY_PATH}\nRun "dem-auth keygen" first.`,
    );
    return process.exit(1);
  }
  try {
    return loadPrivateKey(DEFAULT_KEY_PATH);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error loading private key: ${message}`);
    return process.exit(1);
  }
}

const program = new Command();

program
  .name("dem-auth")
  .description("DEM operator wallet — Ed25519 key management and challenge signing")
  .version("0.1.0");

// ── keygen ──────────────────────────────────────────────────────────────────
program
  .command("keygen")
  .description("Generate a new Ed25519 keypair and save to ~/.dem/private.key")
  .action(() => {
    ensureConfigDir();

    if (existsSync(DEFAULT_KEY_PATH)) {
      console.error(
        `Error: key already exists at ${DEFAULT_KEY_PATH}\nRemove it manually before generating a new one.`,
      );
      process.exit(1);
    }

    const { privateKey, publicKey } = generateKeypair();
    savePrivateKey(privateKey, DEFAULT_KEY_PATH);

    console.log(toHex(publicKey));
  });

// ── sign ────────────────────────────────────────────────────────────────────
program
  .command("sign <challenge>")
  .description("Sign a UTF-8 challenge string and output base64 signature")
  .action((challenge: string) => {
    const privateKey = loadKey();
    const message = new TextEncoder().encode(challenge);
    const signature = sign(message, privateKey);
    const b64 = Buffer.from(signature).toString("base64");
    console.log(b64);
  });

// ── pubkey ──────────────────────────────────────────────────────────────────
program
  .command("pubkey")
  .description("Derive and display the public key (hex) from the stored private key")
  .action(() => {
    const privateKey = loadKey();
    const publicKey = getPublicKey(privateKey);
    console.log(toHex(publicKey));
  });

// ── register ────────────────────────────────────────────────────────────────
program
  .command("register")
  .description("Display public key and registration instructions")
  .action(() => {
    const privateKey = loadKey();
    const publicKey = getPublicKey(privateKey);
    const hex = toHex(publicKey);

    console.log("Operator Public Key:");
    console.log(`  ${hex}\n`);
    console.log("To register with the Diabolus Ex Machina platform:");
    console.log("  1. Copy the public key above.");
    console.log("  2. Submit it to the platform operator registry endpoint:");
    console.log("     POST /api/v1/operators/register");
    console.log('     Body: { "publicKey": "<hex>" }');
    console.log("  3. The platform will issue a challenge. Sign it with:");
    console.log("     dem-auth sign <challenge>");
    console.log("  4. Submit the signature to complete registration.");
  });

program.parse();
