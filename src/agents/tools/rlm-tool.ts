import { Type } from "@sinclair/typebox";
import { spawn } from "node:child_process";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam, readNumberParam } from "./common.js";

const RLM_SCRIPT = `${process.env.HOME}/.openclaw/scripts/rlm/rlm_runner.py`;
const RLM_TIMEOUT_MS = 600_000; // 10 minutes

const RlmQuerySchema = Type.Object({
  task: Type.String({
    description: "The analysis/synthesis task instruction",
  }),
  file: Type.Optional(
    Type.String({
      description: "Path to input file (text/markdown)",
    }),
  ),
  content: Type.Optional(
    Type.String({
      description:
        "Direct text content to analyze (alternative to file). Use for inline documents.",
    }),
  ),
  root_model: Type.Optional(
    Type.String({
      description:
        "REPL coding model (default: qwen3-coder:480b-cloud)",
    }),
  ),
  sub_model: Type.Optional(
    Type.String({
      description: "Sub-query model for llm_query() calls (default: same as root)",
    }),
  ),
  max_iterations: Type.Optional(
    Type.Number({
      description: "Max REPL iterations (default: 10)",
    }),
  ),
  store_brain_workspace: Type.Optional(
    Type.String({
      description: "Brain workspace ID to store the result in",
    }),
  ),
});

export function createRlmTool(): AnyAgentTool {
  return {
    label: "RLM",
    name: "rlm_query",
    description:
      "Process large documents using Recursive Language Model (RLM). " +
      "A coding model writes Python code to programmatically decompose and analyze " +
      "content via recursive sub-LLM calls. Handles documents that exceed normal " +
      "context window limits. Use for synthesizing multiple research papers, " +
      "extracting structured data from long reports, or any task where context rot " +
      "degrades quality.",
    parameters: RlmQuerySchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const task = readStringParam(params, "task", { required: true });
      const file = readStringParam(params, "file");
      const content = readStringParam(params, "content");
      const rootModel = readStringParam(params, "root_model");
      const subModel = readStringParam(params, "sub_model");
      const maxIterations = readNumberParam(params, "max_iterations", { integer: true });
      const storeBrain = readStringParam(params, "store_brain_workspace");

      if (!file && !content) {
        return jsonResult({ error: "Either 'file' or 'content' parameter is required" });
      }

      // Build CLI args
      const cliArgs = [RLM_SCRIPT, "--task", task];
      if (file) {
        cliArgs.push("--file", file);
      } else {
        cliArgs.push("--stdin");
      }
      if (rootModel) cliArgs.push("--root-model", rootModel);
      if (subModel) cliArgs.push("--sub-model", subModel);
      if (maxIterations) cliArgs.push("--max-iterations", String(maxIterations));
      if (storeBrain) cliArgs.push("--store-brain", storeBrain);

      return new Promise((resolve) => {
        const proc = spawn("python3", cliArgs, {
          stdio: ["pipe", "pipe", "pipe"],
          timeout: RLM_TIMEOUT_MS,
        });

        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", (chunk: Buffer) => {
          stdout += chunk.toString();
        });

        proc.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString();
        });

        // Pipe content via stdin if no file provided
        if (!file && content) {
          proc.stdin.write(content);
          proc.stdin.end();
        } else {
          proc.stdin.end();
        }

        const timer = setTimeout(() => {
          proc.kill("SIGTERM");
        }, RLM_TIMEOUT_MS);

        proc.on("close", (code) => {
          clearTimeout(timer);

          // Always produce a result, even on failure
          if (!stdout.trim()) {
            const errMsg = stderr.slice(-2000) || `Process exited with code ${code} and no output`;
            resolve(jsonResult({ 
              error: errMsg, 
              exit_code: code,
              result: `No result provided - ${errMsg.slice(0, 200)}`,
            }));
            return;
          }

          if (code !== 0) {
            const errMsg = stderr.slice(-2000) || `Process exited with code ${code}`;
            // Try to parse stdout as JSON first (may contain partial results)
            try {
              const result = JSON.parse(stdout);
              resolve(jsonResult({ 
                ...result, 
                error: errMsg, 
                exit_code: code,
              }));
            } catch {
              resolve(jsonResult({ 
                error: errMsg, 
                exit_code: code,
                result: stdout.slice(0, 10000),
              }));
            }
            return;
          }

          try {
            const result = JSON.parse(stdout);
            // Ensure result field exists
            if (!result.result && !result.error) {
              result.result = "No explicit result produced by RLM engine";
            }
            resolve(jsonResult(result));
          } catch {
            // If stdout isn't valid JSON, return it as-is
            resolve(jsonResult({
              result: stdout.slice(0, 10000),
              warning: "Output was not valid JSON",
            }));
          }
        });

        proc.on("error", (err) => {
          clearTimeout(timer);
          resolve(jsonResult({ 
            error: `Failed to spawn RLM process: ${err.message}`,
            result: `No result provided - Failed to spawn RLM process: ${err.message}`,
          }));
        });
      });
    },
  };
}
