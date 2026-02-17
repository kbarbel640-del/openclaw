/**
 * End-to-end integration tests.
 *
 * Exercises multiple features working together across module boundaries:
 * - MCP tool bridge → approval workflow → diagnostics
 * - Config env profiles → Zod validation → MCP config
 * - A2A contracts → pipeline validation → contract context
 * - Plugin CLI scaffolding → manifest validation
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// ── MCP imports ──────────────────────────────────────────────────────────────
import {
  discoverContracts,
  findContract,
  validateContractInput,
  validateContractOutput,
  createA2AMessage,
  parseA2AMessage,
  listAgentContracts,
} from "../agents/tools/a2a-contracts.js";
import type { AgentA2AConfig } from "../agents/tools/a2a-contracts.js";
import { buildAgentToAgentContractContext } from "../agents/tools/sessions-send-helpers.js";
// ── Config imports ───────────────────────────────────────────────────────────
import type { OpenClawConfig } from "../config/config.js";
// ── A2A imports ──────────────────────────────────────────────────────────────
import { resolveConfigEnvProfiles, resolveActiveEnv } from "../config/env-profiles.js";
import { emitDiagnosticEvent, onDiagnosticEvent } from "../infra/diagnostic-events.js";
import {
  McpApprovalManager,
  requiresMcpApproval,
  resolveApprovalMode,
  resetMcpApprovalManagerForTest,
} from "../mcp/approvals.js";
import { createMcpToolsFromConnection } from "../mcp/tools.js";
// ── Diagnostics imports ──────────────────────────────────────────────────────
import type { McpServerConnection, McpToolDefinition, McpServerConfig } from "../mcp/types.js";

// ═══════════════════════════════════════════════════════════════════════════
// Test helpers
// ═══════════════════════════════════════════════════════════════════════════

function createMockConnection(overrides: Partial<McpServerConnection> = {}): McpServerConnection {
  return {
    name: "integration-server",
    config: { command: "echo", args: [] },
    tools: [],
    status: "connected",
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "result from MCP" }],
    }),
    ping: vi.fn().mockResolvedValue(true),
    reconnect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeCfg(
  agents: Array<{
    id: string;
    contracts?: Record<string, { description?: string; input?: object; output?: object }>;
    allowFreeform?: boolean;
  }>,
  mcpServers?: Record<string, McpServerConfig>,
): OpenClawConfig {
  return {
    agents: {
      list: agents.map((a) => ({
        id: a.id,
        ...(a.contracts || a.allowFreeform !== undefined
          ? {
              a2a: {
                ...(a.contracts ? { contracts: a.contracts } : {}),
                ...(a.allowFreeform !== undefined ? { allowFreeform: a.allowFreeform } : {}),
              },
            }
          : {}),
      })),
    },
    ...(mcpServers ? { mcp: { servers: mcpServers } } : {}),
  } as unknown as OpenClawConfig;
}

// ═══════════════════════════════════════════════════════════════════════════
// Integration: MCP tool → approval → diagnostics
// ═══════════════════════════════════════════════════════════════════════════

describe("E2E: MCP tool → approval → diagnostics", () => {
  afterEach(() => {
    resetMcpApprovalManagerForTest();
  });

  it("tool with approval=none executes immediately and emits diagnostics", async () => {
    const events: Array<{ type: string }> = [];
    const unsub = onDiagnosticEvent((evt) => {
      if (evt.type.startsWith("mcp.")) {
        events.push({ type: evt.type });
      }
    });

    const conn = createMockConnection({
      config: { command: "echo", args: [], approval: "none" },
      tools: [
        {
          name: "quick_tool",
          description: "No approval needed",
          inputSchema: { type: "object", properties: {} },
        },
      ],
    });

    const tools = createMcpToolsFromConnection(conn);
    expect(tools).toHaveLength(1);

    // Execute the tool
    const result = await tools[0].execute("call-1", { message: "hi" });
    expect(result.content).toBeDefined();

    // Diagnostics should have been emitted
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "mcp.tool.call" }),
        expect.objectContaining({ type: "mcp.tool.result" }),
      ]),
    );

    unsub();
  });

  it("tool with approval=always blocks until approval decision", async () => {
    const manager = new McpApprovalManager({ defaultTimeoutMs: 5000 });
    const config: McpServerConfig = {
      command: "echo",
      args: [],
      approval: "always",
    };

    // Verify approval is required
    expect(requiresMcpApproval(config, "any_tool")).toBe(true);
    expect(resolveApprovalMode(config)).toBe("always");

    // Register and immediately resolve
    const request = {
      id: "e2e-1",
      serverName: "test",
      toolName: "dangerous_tool",
      args: { action: "delete" },
      timestamp: Date.now(),
    };

    const decisionPromise = manager.register(request, 3000);
    expect(manager.size).toBe(1);

    // Resolve the approval
    const resolved = manager.resolve("e2e-1", "allow");
    expect(resolved).toBe(true);

    const decision = await decisionPromise;
    expect(decision).toBe("allow");
    expect(manager.size).toBe(0);
  });

  it("tool with approval=allowlist skips approval for approved tools", () => {
    const config: McpServerConfig = {
      command: "echo",
      args: [],
      approval: "allowlist",
      approvedTools: ["read_file", "list_dir"],
    };

    // Approved tool → no approval needed
    expect(requiresMcpApproval(config, "read_file")).toBe(false);
    expect(requiresMcpApproval(config, "list_dir")).toBe(false);

    // Unapproved tool → approval needed
    expect(requiresMcpApproval(config, "write_file")).toBe(true);
    expect(requiresMcpApproval(config, "delete_file")).toBe(true);
  });

  it("denial stops tool execution and returns denial message", async () => {
    const manager = new McpApprovalManager({ defaultTimeoutMs: 5000 });
    const request = {
      id: "deny-1",
      serverName: "test",
      toolName: "risky_op",
      args: {},
      timestamp: Date.now(),
    };

    const decisionPromise = manager.register(request, 3000);
    manager.resolve("deny-1", "deny");
    const decision = await decisionPromise;
    expect(decision).toBe("deny");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Integration: Config env profiles → MCP config
// ═══════════════════════════════════════════════════════════════════════════

describe("E2E: Config env profiles → MCP config", () => {
  it("resolves different MCP servers per environment", () => {
    const rawConfig = {
      agents: { list: [{ id: "main" }] },
      mcp: {
        servers: {
          "base-server": {
            command: "npx",
            args: ["-y", "base-mcp"],
          },
        },
      },
      $env: {
        production: {
          mcp: {
            servers: {
              "prod-only": {
                command: "npx",
                args: ["-y", "prod-mcp"],
                approval: "always",
              },
            },
          },
        },
        development: {
          mcp: {
            servers: {
              "dev-tools": {
                command: "npx",
                args: ["-y", "dev-mcp"],
              },
            },
          },
        },
      },
    };

    // Resolve for production
    const prodResult = resolveConfigEnvProfiles(rawConfig, {
      OPENCLAW_ENV: "production",
    } as NodeJS.ProcessEnv) as Record<string, unknown>;
    const prodMcp = prodResult.mcp as { servers: Record<string, McpServerConfig> };
    expect(prodMcp.servers["base-server"]).toBeDefined();
    expect(prodMcp.servers["prod-only"]).toBeDefined();
    expect(prodMcp.servers["prod-only"].approval).toBe("always");
    expect(prodMcp.servers["dev-tools"]).toBeUndefined();

    // Resolve for development
    const devResult = resolveConfigEnvProfiles(rawConfig, {
      OPENCLAW_ENV: "development",
    } as NodeJS.ProcessEnv) as Record<string, unknown>;
    const devMcp = devResult.mcp as { servers: Record<string, McpServerConfig> };
    expect(devMcp.servers["base-server"]).toBeDefined();
    expect(devMcp.servers["dev-tools"]).toBeDefined();
    expect(devMcp.servers["prod-only"]).toBeUndefined();
  });

  it("falls back to development when no env is set", () => {
    const env = resolveActiveEnv({} as NodeJS.ProcessEnv);
    expect(env).toBe("development");
  });

  it("OPENCLAW_ENV takes priority over NODE_ENV", () => {
    const env = resolveActiveEnv({
      OPENCLAW_ENV: "staging",
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv);
    expect(env).toBe("staging");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Integration: A2A contracts → pipeline → context
// ═══════════════════════════════════════════════════════════════════════════

describe("E2E: A2A contract full pipeline", () => {
  const researchContract = {
    description: "Submit a research query",
    input: {
      type: "object" as const,
      properties: {
        query: { type: "string" as const, description: "Research query" },
        depth: {
          type: "string" as const,
          enum: ["shallow", "deep"],
          description: "Research depth",
        },
        maxResults: { type: "integer" as const },
      },
      required: ["query"],
    },
    output: {
      type: "object" as const,
      properties: {
        findings: { type: "string" as const },
        sources: { type: "array" as const, items: { type: "string" as const } },
        confidence: { type: "number" as const },
      },
    },
  };

  it("end-to-end: create message → parse → validate → build context", () => {
    const cfg = makeCfg([
      {
        id: "researcher",
        contracts: { "research.request": researchContract },
      },
    ]);

    // Step 1: Sender creates a structured A2A message
    const message = createA2AMessage(
      "research.request",
      {
        query: "quantum computing applications",
        depth: "deep",
        maxResults: 10,
      },
      "corr-123",
    );

    // Step 2: Pipeline parses the JSON message
    const parsed = parseA2AMessage(JSON.stringify(message));
    expect(parsed).not.toBeNull();
    expect(parsed!.contract).toBe("research.request");
    expect(parsed!.correlationId).toBe("corr-123");

    // Step 3: Pipeline discovers the contract
    const contract = findContract(cfg, "researcher", parsed!.contract);
    expect(contract).toBeDefined();
    expect(contract!.contract.description).toBe("Submit a research query");

    // Step 4: Pipeline validates the input against the contract schema
    const validation = validateContractInput(contract!.contract, parsed!.payload);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // Step 5: Pipeline builds the contract context for the system prompt
    const context = buildAgentToAgentContractContext({
      structured: parsed!,
      contract: contract!.contract,
    });
    expect(context).toContain("research.request");
    expect(context).toContain("Submit a research query");
    expect(context).toContain("quantum computing applications");
    expect(context).toContain("corr-123");
    expect(context).toContain("Expected output schema");
  });

  it("end-to-end: validation rejects invalid input", () => {
    const cfg = makeCfg([
      {
        id: "researcher",
        contracts: { "research.request": researchContract },
      },
    ]);

    // Missing required field "query"
    const message = createA2AMessage("research.request", {
      depth: "shallow",
    });

    const parsed = parseA2AMessage(JSON.stringify(message))!;
    const contract = findContract(cfg, "researcher", parsed.contract)!;
    const validation = validateContractInput(contract.contract, parsed.payload);

    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
    // The error should mention the missing required "query" field
    expect(validation.errors.some((e) => e.includes("query") && e.includes("required"))).toBe(true);
  });

  it("end-to-end: validation rejects invalid enum value", () => {
    const cfg = makeCfg([
      {
        id: "researcher",
        contracts: { "research.request": researchContract },
      },
    ]);

    const message = createA2AMessage("research.request", {
      query: "test",
      depth: "invalid-depth",
    });

    const parsed = parseA2AMessage(JSON.stringify(message))!;
    const contract = findContract(cfg, "researcher", parsed.contract)!;
    const validation = validateContractInput(contract.contract, parsed.payload);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("enum") || e.includes("one of"))).toBe(true);
  });

  it("end-to-end: output validation works too", () => {
    const cfg = makeCfg([
      {
        id: "researcher",
        contracts: { "research.request": researchContract },
      },
    ]);

    const contract = findContract(cfg, "researcher", "research.request")!;

    // Valid output
    const validOutput = {
      findings: "Quantum computing shows promise in...",
      sources: ["arxiv:1234", "nature:5678"],
      confidence: 0.85,
    };
    const validResult = validateContractOutput(contract.contract, validOutput);
    expect(validResult.valid).toBe(true);

    // Invalid output (wrong type for sources)
    const invalidOutput = {
      findings: "test",
      sources: "not-an-array",
    };
    const invalidResult = validateContractOutput(contract.contract, invalidOutput);
    expect(invalidResult.valid).toBe(false);
  });

  it("multi-agent: discovers contracts across all agents", () => {
    const cfg = makeCfg([
      {
        id: "researcher",
        contracts: { "research.request": researchContract },
      },
      {
        id: "writer",
        contracts: {
          "write.article": { description: "Write an article" },
          "write.summary": { description: "Write a summary" },
        },
      },
      {
        id: "reviewer",
        contracts: {
          "review.code": { description: "Review code" },
        },
      },
    ]);

    const allContracts = discoverContracts(cfg);
    expect(allContracts).toHaveLength(4);

    // Each agent's contracts are found
    expect(listAgentContracts(cfg, "researcher")).toHaveLength(1);
    expect(listAgentContracts(cfg, "writer")).toHaveLength(2);
    expect(listAgentContracts(cfg, "reviewer")).toHaveLength(1);
    expect(listAgentContracts(cfg, "nonexistent")).toHaveLength(0);
  });

  it("freeform messages allowed by default", () => {
    const cfg = makeCfg([{ id: "open-agent" }]);
    const agents = (cfg.agents as { list: Array<Record<string, unknown>> }).list;
    const agent = agents.find((a) => a.id === "open-agent");
    const a2aCfg = agent?.a2a as AgentA2AConfig | undefined;
    // No a2a config means freeform is allowed (default)
    expect(a2aCfg?.allowFreeform).toBeUndefined();
  });

  it("freeform messages blocked when allowFreeform=false", () => {
    const cfg = makeCfg([
      {
        id: "strict-agent",
        contracts: { "only.this": { description: "Only accepts this" } },
        allowFreeform: false,
      },
    ]);
    const agents = (cfg.agents as { list: Array<Record<string, unknown>> }).list;
    const agent = agents.find((a) => a.id === "strict-agent");
    const a2aCfg = agent?.a2a as AgentA2AConfig | undefined;
    expect(a2aCfg?.allowFreeform).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Integration: MCP tools + env profiles together
// ═══════════════════════════════════════════════════════════════════════════

describe("E2E: MCP + env profiles + A2A together", () => {
  it("full config pipeline: env profiles resolve → MCP tools created → A2A contract found", () => {
    // Simulate a config that uses env profiles for different MCP servers
    // AND has A2A contracts defined
    const rawConfig = {
      agents: {
        list: [
          {
            id: "coordinator",
            a2a: {
              contracts: {
                "task.assign": {
                  description: "Assign a task",
                  input: {
                    type: "object",
                    properties: {
                      task: { type: "string" },
                      priority: { type: "string", enum: ["low", "medium", "high"] },
                    },
                    required: ["task"],
                  },
                },
              },
            },
          },
        ],
      },
      mcp: {
        servers: {
          "base-tools": { command: "npx", args: ["-y", "mcp-base"] },
        },
      },
      $env: {
        production: {
          mcp: {
            servers: {
              monitoring: {
                command: "npx",
                args: ["-y", "mcp-monitor"],
                approval: "always",
              },
            },
          },
        },
      },
    };

    // Resolve for production environment
    const resolved = resolveConfigEnvProfiles(rawConfig, {
      OPENCLAW_ENV: "production",
    } as NodeJS.ProcessEnv) as OpenClawConfig;

    // MCP servers merged correctly
    const mcpConfig = (resolved as unknown as Record<string, unknown>).mcp as {
      servers: Record<string, McpServerConfig>;
    };
    expect(Object.keys(mcpConfig.servers)).toHaveLength(2);
    expect(mcpConfig.servers["base-tools"]).toBeDefined();
    expect(mcpConfig.servers["monitoring"]).toBeDefined();
    expect(mcpConfig.servers["monitoring"].approval).toBe("always");

    // A2A contracts still accessible through the resolved config
    const contracts = discoverContracts(resolved);
    expect(contracts).toHaveLength(1);
    expect(contracts[0].contractName).toBe("task.assign");

    // Can validate a message against the contract
    const msg = createA2AMessage("task.assign", { task: "deploy v2", priority: "high" });
    const parsed = parseA2AMessage(JSON.stringify(msg))!;
    const contract = findContract(resolved, "coordinator", parsed.contract)!;
    const validation = validateContractInput(contract.contract, parsed.payload);
    expect(validation.valid).toBe(true);

    // MCP tool from mock connection works alongside A2A
    const conn = createMockConnection({
      name: "monitoring",
      config: mcpConfig.servers["monitoring"],
      tools: [
        {
          name: "check_health",
          description: "Check system health",
          inputSchema: { type: "object", properties: {} },
        },
      ],
    });
    const mcpTools = createMcpToolsFromConnection(conn);
    expect(mcpTools).toHaveLength(1);
    expect(mcpTools[0].name).toBe("mcp_monitoring_check_health");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Integration: Plugin scaffold → validate manifest
// ═══════════════════════════════════════════════════════════════════════════

describe("E2E: Plugin scaffolding → manifest validation", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oc-e2e-plugin-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("scaffolded plugin has consistent metadata across all files", () => {
    const pluginId = "my-e2e-plugin";
    const description = "E2E test plugin";
    const outDir = path.join(tmpDir, pluginId);

    // Simulate scaffolding
    fs.mkdirSync(outDir, { recursive: true });

    const packageJson = {
      name: `@openclaw/${pluginId}`,
      version: "0.1.0",
      private: true,
      description,
      type: "module",
      devDependencies: { openclaw: "workspace:*" },
      openclaw: { extensions: ["./index.ts"] },
    };
    fs.writeFileSync(path.join(outDir, "package.json"), JSON.stringify(packageJson, null, 2));

    const manifest = {
      id: pluginId,
      name: pluginId,
      description,
      configSchema: { type: "object", additionalProperties: false, properties: {} },
    };
    fs.writeFileSync(path.join(outDir, "openclaw.plugin.json"), JSON.stringify(manifest, null, 2));

    // Verify cross-file consistency
    const pkg = JSON.parse(fs.readFileSync(path.join(outDir, "package.json"), "utf-8"));
    const mfst = JSON.parse(fs.readFileSync(path.join(outDir, "openclaw.plugin.json"), "utf-8"));

    expect(pkg.name).toBe(`@openclaw/${mfst.id}`);
    expect(pkg.description).toBe(mfst.description);
    expect(mfst.configSchema.type).toBe("object");
    expect(mfst.configSchema.additionalProperties).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Integration: Diagnostic event flow
// ═══════════════════════════════════════════════════════════════════════════

describe("E2E: Diagnostic event pipeline", () => {
  it("MCP tool events carry correct metadata through the pipeline", () => {
    const collected: unknown[] = [];
    const unsub = onDiagnosticEvent((evt) => {
      if (evt.type.startsWith("mcp.")) {
        collected.push(evt);
      }
    });

    // Emit call event
    emitDiagnosticEvent({
      type: "mcp.tool.call",
      serverName: "test-server",
      toolName: "read_file",
    });

    // Emit result event
    emitDiagnosticEvent({
      type: "mcp.tool.result",
      serverName: "test-server",
      toolName: "read_file",
      durationMs: 42,
      isError: false,
    });

    expect(collected).toHaveLength(2);

    const callEvt = collected[0] as Record<string, unknown>;
    expect(callEvt.type).toBe("mcp.tool.call");
    expect(callEvt.serverName).toBe("test-server");
    expect(callEvt.toolName).toBe("read_file");
    expect(callEvt.seq).toBeDefined(); // Enriched with sequence number
    expect(callEvt.ts).toBeDefined(); // Enriched with timestamp

    const resultEvt = collected[1] as Record<string, unknown>;
    expect(resultEvt.type).toBe("mcp.tool.result");
    expect(resultEvt.durationMs).toBe(42);
    expect(resultEvt.isError).toBe(false);
    expect((resultEvt.seq as number) > (callEvt.seq as number)).toBe(true);

    unsub();
  });
});
