#!/usr/bin/env npx tsx
/**
 * Interactive script to generate a TELEGRAM_SESSION string for the
 * telegram-digest extension.
 *
 * Usage:
 *   npx tsx extensions/telegram-digest/setup-session.ts
 *
 * You will need:
 *   - TELEGRAM_API_ID (from https://my.telegram.org/apps)
 *   - TELEGRAM_API_HASH (from https://my.telegram.org/apps)
 *   - Your phone number registered with Telegram
 *   - Access to Telegram for the confirmation code
 *
 * The script will output a TELEGRAM_SESSION string that you should
 * save as an environment variable.
 */

import * as readline from "node:readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function main() {
  console.log("=== Telegram Session Generator ===\n");
  console.log("This script generates a StringSession token for the telegram-digest extension.");
  console.log("You need API credentials from https://my.telegram.org/apps\n");

  const apiId = Number(await ask("Enter your TELEGRAM_API_ID: "));
  if (!apiId || Number.isNaN(apiId)) {
    console.error("Invalid API ID. Must be a number.");
    process.exit(1);
  }

  const apiHash = await ask("Enter your TELEGRAM_API_HASH: ");
  if (!apiHash) {
    console.error("API hash is required.");
    process.exit(1);
  }

  console.log("\nConnecting to Telegram...\n");

  const { TelegramClient } = await import("telegram");
  const { StringSession } = await import("telegram/sessions/index.js");

  const session = new StringSession("");
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 3,
  });

  await client.start({
    phoneNumber: async () =>
      ask("Enter your phone number (international format, e.g. +79991234567): "),
    password: async () => ask("Enter your 2FA password (if enabled, or press Enter): "),
    phoneCode: async () => ask("Enter the confirmation code from Telegram: "),
    onError: (err: Error) => {
      console.error("Error:", err.message);
    },
  });

  const sessionString = client.session.save() as unknown as string;

  console.log("\n=== Session generated successfully! ===\n");
  console.log("Add this to your environment:\n");
  console.log(`TELEGRAM_SESSION=${sessionString}\n`);
  console.log("For example, add to your .env file or export in your shell:\n");
  console.log(`  export TELEGRAM_API_ID=${apiId}`);
  console.log(`  export TELEGRAM_API_HASH=${apiHash}`);
  console.log(`  export TELEGRAM_SESSION=${sessionString}`);
  console.log("\nKeep the session string secret — it grants access to your Telegram account!\n");

  await client.disconnect();
  rl.close();
}

main().catch((err) => {
  console.error("Failed:", err.message);
  rl.close();
  process.exit(1);
});
