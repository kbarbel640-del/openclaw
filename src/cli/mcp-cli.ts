import type { Command } from "commander";
import { defaultRuntime } from "../runtime.js";
import { danger } from "../globals.js";

export function registerMcpCli(program: Command) {
  const mcp = program
    .command("mcp")
    .description("Manage MCP (Model Context Protocol) server connections");

  mcp
    .command("status")
    .description("Show status of all configured MCP servers")
    .option("--json", "Output JSON", false)
    .action(async (opts: { json?: boolean }) => {
      try {
        const { getMcpConnections, isMcpInitialized } = await import("../mcp/manager.js");

        if (!isMcpInitialized()) {
          if (opts.json) {
            defaultRuntime.log(
              JSON.stringify({ initialized: false, servers: [] }, null, 2),
            );
          } else {
            defaultRuntime.log("MCP not initialized (gateway not running?)");
          }
          return;
        }

        const connections = getMcpConnections();

        if (opts.json) {
          const data = connections.map((conn) => ({
            name: conn.name,
            status: conn.status,
            transport: conn.config.transport ?? "stdio",
            toolCount: conn.tools.length,
            tools: conn.tools.map((t) => t.name),
            error: conn.error ?? null,
          }));
          defaultRuntime.log(JSON.stringify({ initialized: true, servers: data }, null, 2));
          return;
        }

        if (connections.length === 0) {
          defaultRuntime.log("No MCP servers configured.");
          return;
        }

        for (const conn of connections) {
          const statusIcon =
            conn.status === "connected" ? "●" : conn.status === "error" ? "✗" : "○";
          defaultRuntime.log(
            `${statusIcon} ${conn.name}  (${conn.config.transport ?? "stdio"})  ${conn.status}  ${conn.tools.length} tool(s)`,
          );
          if (conn.error) {
            defaultRuntime.log(`  error: ${conn.error}`);
          }
          for (const tool of conn.tools) {
            defaultRuntime.log(`    → ${tool.name}: ${tool.description?.slice(0, 60) ?? ""}`);
          }
        }
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  mcp
    .command("list-tools")
    .description("List all tools from connected MCP servers")
    .option("--json", "Output JSON", false)
    .action(async (opts: { json?: boolean }) => {
      try {
        const { getMcpConnections, isMcpInitialized } = await import("../mcp/manager.js");

        if (!isMcpInitialized()) {
          defaultRuntime.log(opts.json ? "[]" : "MCP not initialized.");
          return;
        }

        const connections = getMcpConnections();
        const allTools = connections.flatMap((conn) =>
          conn.tools.map((tool) => ({
            server: conn.name,
            name: tool.name,
            description: tool.description ?? "",
            parameterCount: Object.keys(tool.inputSchema.properties ?? {}).length,
          })),
        );

        if (opts.json) {
          defaultRuntime.log(JSON.stringify(allTools, null, 2));
          return;
        }

        if (allTools.length === 0) {
          defaultRuntime.log("No MCP tools available.");
          return;
        }

        for (const tool of allTools) {
          defaultRuntime.log(
            `[${tool.server}] ${tool.name}  (${tool.parameterCount} params)  ${tool.description.slice(0, 60)}`,
          );
        }
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  mcp
    .command("validate")
    .description("Validate MCP configuration without connecting")
    .action(async () => {
      try {
        const { loadConfig } = await import("../config/config.js");
        const cfg = loadConfig();
        const mcpConfig = cfg.mcp;

        if (!mcpConfig?.servers || Object.keys(mcpConfig.servers).length === 0) {
          defaultRuntime.log("No MCP servers configured in openclaw.json.");
          return;
        }

        if (mcpConfig.enabled === false) {
          defaultRuntime.log("MCP is disabled (mcp.enabled = false).");
          return;
        }

        const entries = Object.entries(mcpConfig.servers);
        defaultRuntime.log(`Found ${entries.length} MCP server(s):\n`);

        let hasIssues = false;
        for (const [name, config] of entries) {
          const transport = config.transport ?? "stdio";
          const enabled = config.enabled !== false;
          const issues: string[] = [];

          if (transport === "stdio" && !config.command) {
            issues.push("missing 'command' (required for stdio transport)");
          }
          if (transport === "sse" && !config.url) {
            issues.push("missing 'url' (required for sse transport)");
          }

          const icon = enabled ? (issues.length === 0 ? "✓" : "⚠") : "○";
          defaultRuntime.log(
            `${icon} ${name}  transport=${transport}  enabled=${enabled}`,
          );

          if (transport === "stdio" && config.command) {
            defaultRuntime.log(`    command: ${config.command} ${(config.args ?? []).join(" ")}`);
          }
          if (transport === "sse" && config.url) {
            defaultRuntime.log(`    url: ${config.url}`);
          }
          if (config.toolPrefix !== undefined) {
            defaultRuntime.log(`    toolPrefix: ${config.toolPrefix || "(empty — no prefix)"}`);
          }

          for (const issue of issues) {
            defaultRuntime.log(`    ⚠ ${issue}`);
            hasIssues = true;
          }
        }

        if (hasIssues) {
          defaultRuntime.log("\nSome servers have configuration issues.");
          defaultRuntime.exit(1);
        } else {
          defaultRuntime.log("\nAll MCP server configs look valid.");
        }
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  // ─── call-tool ──────────────────────────────────────────────────────
  mcp
    .command("call-tool <server> <tool>")
    .description("Invoke an MCP tool directly for debugging")
    .option("--params <json>", "JSON parameters to pass to the tool", "{}")
    .option("--json", "Output raw JSON result", false)
    .option("--timeout <ms>", "Override timeout in milliseconds")
    .action(
      async (
        serverName: string,
        toolName: string,
        opts: { params?: string; json?: boolean; timeout?: string },
      ) => {
        try {
          const { getMcpConnections, isMcpInitialized } = await import("../mcp/manager.js");

          if (!isMcpInitialized()) {
            defaultRuntime.error("MCP not initialized. Start the gateway first.");
            defaultRuntime.exit(1);
            return;
          }

          const connections = getMcpConnections();
          const conn = connections.find((c) => c.name === serverName);
          if (!conn) {
            const available = connections.map((c) => c.name).join(", ") || "none";
            defaultRuntime.error(
              `MCP server "${serverName}" not found. Available: ${available}`,
            );
            defaultRuntime.exit(1);
            return;
          }

          if (conn.status !== "connected") {
            defaultRuntime.error(
              `MCP server "${serverName}" is not connected (status: ${conn.status}).`,
            );
            defaultRuntime.exit(1);
            return;
          }

          const tool = conn.tools.find((t) => t.name === toolName);
          if (!tool) {
            const available = conn.tools.map((t) => t.name).join(", ") || "none";
            defaultRuntime.error(
              `Tool "${toolName}" not found on server "${serverName}". Available: ${available}`,
            );
            defaultRuntime.exit(1);
            return;
          }

          // Parse params
          let params: Record<string, unknown>;
          try {
            params = JSON.parse(opts.params ?? "{}") as Record<string, unknown>;
          } catch {
            defaultRuntime.error("Invalid JSON in --params. Use valid JSON: --params '{\"key\":\"value\"}'");
            defaultRuntime.exit(1);
            return;
          }

          const timeoutMs = opts.timeout ? parseInt(opts.timeout, 10) : undefined;
          if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) {
            defaultRuntime.error("Invalid --timeout value. Must be a positive integer (milliseconds).");
            defaultRuntime.exit(1);
            return;
          }

          if (!opts.json) {
            defaultRuntime.log(
              `Calling ${serverName}/${toolName} with ${JSON.stringify(params)}...`,
            );
          }

          const startMs = Date.now();
          const result = await conn.callTool(toolName, params, timeoutMs);
          const durationMs = Date.now() - startMs;

          if (opts.json) {
            defaultRuntime.log(JSON.stringify({ ...result, durationMs }, null, 2));
            return;
          }

          // Pretty-print result
          defaultRuntime.log(`\nResult (${durationMs}ms):`);
          if (result.isError) {
            defaultRuntime.log("  Status: ERROR");
          }
          for (const block of result.content) {
            if (block.type === "text" && block.text) {
              defaultRuntime.log(block.text);
            } else if (block.type === "image") {
              defaultRuntime.log(`[Image: ${block.mimeType ?? "unknown"}]`);
            } else if (block.type === "resource") {
              defaultRuntime.log(`[Resource: ${block.uri ?? "unknown"}]`);
            }
          }
        } catch (err) {
          defaultRuntime.error(danger(String(err)));
          defaultRuntime.exit(1);
        }
      },
    );

  // ─── test-tool ──────────────────────────────────────────────────────
  mcp
    .command("test-tool <server> <tool>")
    .description("Validate tool parameters without calling it (dry-run)")
    .option("--params <json>", "JSON parameters to validate", "{}")
    .action(async (serverName: string, toolName: string, opts: { params?: string }) => {
      try {
        const { getMcpConnections, isMcpInitialized } = await import("../mcp/manager.js");

        if (!isMcpInitialized()) {
          defaultRuntime.error("MCP not initialized. Start the gateway first.");
          defaultRuntime.exit(1);
          return;
        }

        const connections = getMcpConnections();
        const conn = connections.find((c) => c.name === serverName);
        if (!conn) {
          defaultRuntime.error(`MCP server "${serverName}" not found.`);
          defaultRuntime.exit(1);
          return;
        }

        const tool = conn.tools.find((t) => t.name === toolName);
        if (!tool) {
          defaultRuntime.error(`Tool "${toolName}" not found on server "${serverName}".`);
          defaultRuntime.exit(1);
          return;
        }

        let params: Record<string, unknown>;
        try {
          params = JSON.parse(opts.params ?? "{}") as Record<string, unknown>;
        } catch {
          defaultRuntime.error("Invalid JSON in --params.");
          defaultRuntime.exit(1);
          return;
        }

        // Validate params against schema
        const schema = tool.inputSchema;
        const issues: string[] = [];

        if (schema.required) {
          for (const key of schema.required) {
            if (!(key in params)) {
              issues.push(`Missing required parameter: ${key}`);
            }
          }
        }

        if (schema.properties) {
          for (const key of Object.keys(params)) {
            if (!(key in schema.properties)) {
              issues.push(`Unknown parameter: ${key}`);
            }
          }
        }

        // Print schema info
        defaultRuntime.log(`Tool: ${serverName}/${toolName}`);
        defaultRuntime.log(`Description: ${tool.description ?? "(none)"}`);
        if (schema.properties) {
          defaultRuntime.log("\nParameters:");
          for (const [key, prop] of Object.entries(schema.properties)) {
            const propSchema = prop as { type?: string; description?: string };
            const required = schema.required?.includes(key) ? " (required)" : " (optional)";
            defaultRuntime.log(
              `  ${key}: ${propSchema.type ?? "any"}${required}  ${propSchema.description ?? ""}`,
            );
          }
        }

        defaultRuntime.log(`\nInput: ${JSON.stringify(params)}`);

        if (issues.length > 0) {
          defaultRuntime.log("\nValidation issues:");
          for (const issue of issues) {
            defaultRuntime.log(`  ⚠ ${issue}`);
          }
          defaultRuntime.exit(1);
        } else {
          defaultRuntime.log("\n✓ Parameters look valid (dry-run — no call made).");
        }
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });
}
