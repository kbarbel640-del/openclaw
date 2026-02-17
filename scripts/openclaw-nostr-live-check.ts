import type { PluginRuntime } from "openclaw/plugin-sdk";
import { execSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { startNostrBus } from "../extensions/nostr/src/nostr-bus.ts";
import { setNostrRuntime } from "../extensions/nostr/src/runtime.ts";

async function main() {
  setNostrRuntime({
    config: {
      loadConfig: () => ({ channels: { nostr: {} } }),
    },
    state: {
      resolveStateDir: () => "/tmp/nostr-runtime-state",
    },
  } satisfies PluginRuntime);

  const BOT_SECRET = "9a0f28772e0b927167da79e9785c72076bba382074fad150bd4b0dc7d29a1cd6";
  const BOT_PUBLIC = execSync(`nak key public ${BOT_SECRET}`, { encoding: "utf8" }).trim();
  const SENDER_SECRET = execSync("nak key generate", { encoding: "utf8" }).trim();

  const plaintext = JSON.stringify({ ver: 1, message: "direct-check-1" });
  const encrypted = execSync(
    `nak encrypt ${JSON.stringify(plaintext)} --recipient-pubkey ${BOT_PUBLIC} --sec ${SENDER_SECRET}`,
    { encoding: "utf8" },
  ).trim();

  const bus = await startNostrBus({
    privateKey: BOT_SECRET,
    relays: ["wss://relay.damus.io"],
    onMessage: async (payload, reply) => {
      console.log(
        "received",
        payload.eventId,
        payload.senderPubkey,
        payload.sessionId,
        payload.inReplyTo,
      );
      await reply("ack from runtime test");
    },
    onError: (error, context) => {
      console.error("bus error", context, String(error));
    },
  });

  const event = JSON.parse(
    execSync(
      `nak event -q -k 25802 -p ${BOT_PUBLIC} -t "s=live-check" -t "encryption=nip44" -c ${JSON.stringify(
        encrypted,
      )} --sec ${SENDER_SECRET} wss://relay.damus.io`,
      { encoding: "utf8" },
    ),
  );
  console.log("published", event.id);

  await sleep(20000);
  bus.close();
  console.log("done");
}

void main();
