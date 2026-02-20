import { Command } from "commander";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { wireAgentsBridgeCommands } from "../bridge/commands/agents.js";
import { wireModelsBridgeCommands } from "../bridge/commands/models.js";
import { bridgeRegistry } from "../bridge/registry.js";

// Wire new modules explicitly
wireAgentsBridgeCommands(bridgeRegistry);
wireModelsBridgeCommands(bridgeRegistry);

// Schema for Bridge Input
const BridgeInputSchema = z.object({
  action: z.string(),
  args: z.record(z.any()).optional(),
  context: z
    .object({
      channel: z.string().optional(),
      userId: z.string().optional(),
      isAdmin: z.boolean().optional(),
      metadata: z.record(z.unknown()).optional(),
    })
    .optional(),
});

export function registerBridgeCommand(program: Command) {
  program
    .command("bridge [payload]")
    .description("Execute internal commands via JSON bridge")
    .option("-f, --file <path>", "Read payload from file")
    .action(async (payloadStr, opts) => {
      try {
        let inputStr = payloadStr;

        // 1. Resolve Input
        if (opts.file) {
          inputStr = readFileSync(opts.file, "utf-8");
        } else if (!inputStr && !process.stdin.isTTY) {
          // Read from STDIN
          const chunks = [];
          for await (const chunk of process.stdin) {
            chunks.push(chunk);
          }
          inputStr = Buffer.concat(chunks).toString("utf-8");
        }

        console.error("DEBUG input:", inputStr); // Debug
        const json = JSON.parse(inputStr);
        console.error("DEBUG parsed json"); // Debug

        try {
          const input = BridgeInputSchema.parse(json);
          console.error("DEBUG validated input"); // Debug

          // 3. Dispatch
          const command = bridgeRegistry.get(input.action);
          if (!command) {
            console.error(
              JSON.stringify({ success: false, error: `Unknown action: ${input.action}` }),
            );
            process.exit(1);
          }
          console.error("DEBUG dispatched command:", input.action); // Debug

          // 4. Execute
          const args = command.schema
            ? command.schema.parse(input.args ?? command.defaultArgs ?? {})
            : (input.args ?? {});

          const context = {
            channel: input.context?.channel ?? "cli",
            userId: input.context?.userId,
            isAdmin: input.context?.isAdmin ?? true,
            metadata: input.context?.metadata,
          };

          const result = await command.handler(args, context);
          console.error("DEBUG executed handler"); // Debug

          // 5. Output
          console.log(JSON.stringify(result, null, 2));
        } catch (innerErr) {
          console.error("DEBUG inner error:", innerErr);
          throw innerErr;
        }
      } catch (err) {
        console.error(JSON.stringify({ success: false, error: String(err) }));
        process.exit(1);
      }
    });
}
