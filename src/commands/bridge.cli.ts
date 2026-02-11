import { Command } from "commander";
import { readFileSync } from "node:fs";
import { RuntimeEnv } from "../config/runtime.js";
import { bridgeCommand, BridgeInput } from "./bridge.js";

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

export function registerBridgeCommand(program: Command, runtime: RuntimeEnv) {
  program
    .command("bridge [json]")
    .description("Execute bridge commands via JSON (Headless Mode)")
    .action(async (jsonArg: string | undefined) => {
      try {
        let inputStr = jsonArg;

        // If no arg, try reading stdin
        if (!inputStr) {
          if (process.stdin.isTTY) {
            console.error("Error: JSON payload required (argument or stdin).");
            process.exit(1);
          }
          inputStr = await readStdin();
        }

        if (!inputStr) {
          console.error("Error: Empty input.");
          process.exit(1);
        }

        const input = JSON.parse(inputStr) as BridgeInput;
        const result = await bridgeCommand(input, runtime);

        console.log(JSON.stringify(result, null, 2));
      } catch (err) {
        console.error(JSON.stringify({ success: false, error: String(err) }, null, 2));
        process.exit(1);
      }
    });
}
