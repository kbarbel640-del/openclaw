/**
 * `openclaw fabric` — CLI Subcommand Group
 *
 * Cloud.ru AI Fabric tools: ask agents, sync resources, check status.
 */

import type { Command } from "commander";
import { defaultRuntime } from "../runtime.js";

export function registerFabricCli(program: Command) {
  const fabric = program.command("fabric").description("Cloud.ru AI Fabric tools");

  fabric
    .command("ask")
    .description("Send a message to a Cloud.ru AI Fabric agent or agent system")
    .argument("<name>", "Agent or agent system name/ID")
    .argument("<message...>", "Message to send")
    .action(async (name: string, messageParts: string[]) => {
      const { fabricAsk } = await import("../commands/fabric-ask.js");
      const message = messageParts.join(" ");

      const result = await fabricAsk({ target: name, message });
      if (!result.ok) {
        defaultRuntime.error(result.error);
        defaultRuntime.exit(1);
        return;
      }

      defaultRuntime.log(result.text);
    });

  fabric
    .command("sync")
    .description("Sync AI Fabric resources (MCP servers, skills) to Claude CLI")
    .action(async () => {
      const { runFabricSync } = await import("../commands/fabric-sync-cmd.js");
      await runFabricSync();
    });

  fabric
    .command("status")
    .description("Show AI Fabric resource status (alias for /status_agents)")
    .argument("[filter]", "Optional name filter")
    .action(async (filter?: string) => {
      const { runFabricStatus } = await import("../commands/fabric-status-cmd.js");
      await runFabricStatus(filter);
    });
}
