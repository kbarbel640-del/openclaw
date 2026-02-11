import { Command } from "commander";
import { registerBridgeCommand } from "../../commands/bridge.cli.js";
import { defaultRuntime } from "../../config/runtime.js";

export function registerBridgeCli(program: Command) {
  registerBridgeCommand(program, defaultRuntime);
}
