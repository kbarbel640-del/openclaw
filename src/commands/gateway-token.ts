import type { Command } from "commander";
import {
  createDeviceToken,
  listDeviceTokens,
  pruneExpiredTokens,
} from "../gateway/tokens-store.js";
import { defaultRuntime } from "../runtime.js";

export function registerGatewayTokenCommands(program: Command) {
  const cmd = program.command("token").description("Manage gateway ephemeral tokens (create/list)");

  cmd
    .command("create")
    .description("Create a new ephemeral gateway token")
    .option("--ttl <hours>", "Time-to-live in hours (default: 24)")
    .option("--note <note>", "Optional note for the token")
    .action(async (opts) => {
      try {
        const ttl = opts.ttl ? Number(opts.ttl) : 24;
        if (!Number.isFinite(ttl) || ttl <= 0) {
          defaultRuntime.error("Invalid --ttl");
          return;
        }
        const token = createDeviceToken({ ttlHours: ttl, note: opts.note });
        defaultRuntime.log(token);
        defaultRuntime.log(
          "Created token (printed above). Keep it secure; it will expire automatically.",
        );
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  cmd
    .command("list")
    .description("List ephemeral gateway tokens (shows id, created, expiry, active)")
    .action(async () => {
      try {
        pruneExpiredTokens();
        const tokens = listDeviceTokens();
        if (tokens.length === 0) {
          defaultRuntime.log("No tokens found");
          return;
        }
        for (const t of tokens) {
          defaultRuntime.log(
            `${t.id}  created=${t.createdAt} expires=${t.expiresAt ?? "never"} active=${t.active} ${t.note ? `note=${t.note}` : ""}`,
          );
        }
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  return cmd;
}
