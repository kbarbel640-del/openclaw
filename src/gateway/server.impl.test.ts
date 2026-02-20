import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import * as securityRequirements from "../config/security-requirements.js";

// Mock all dependencies to isolate the security validation logic
vi.mock("../config/config.js", () => ({
  CONFIG_PATH: "/tmp/test-config.json",
  loadConfig: vi.fn(),
  readConfigFileSnapshot: vi.fn(),
  writeConfigFile: vi.fn(),
  isNixMode: false,
  migrateLegacyConfig: vi.fn(),
  resolveStateDir: vi.fn(() => "/tmp/state"),
}));

vi.mock("../agents/agent-scope.js");
vi.mock("../agents/pi-embedded-runner/runs.js");
vi.mock("../agents/skills/refresh.js");
vi.mock("../agents/subagent-registry.js");
vi.mock("../auto-reply/reply/dispatcher-registry.js");
vi.mock("../channels/plugins/index.js");
vi.mock("../cli/command-format.js");
vi.mock("../cli/deps.js");
vi.mock("../config/plugin-auto-enable.js");
vi.mock("../infra/agent-events.js");
vi.mock("../infra/control-ui-assets.js");
vi.mock("../infra/diagnostic-events.js");
vi.mock("../infra/env.js");
vi.mock("../infra/exec-approval-forwarder.js");
vi.mock("../infra/heartbeat-events.js");
vi.mock("../infra/heartbeat-runner.js");
vi.mock("../infra/machine-name.js");
vi.mock("../infra/path-env.js");
vi.mock("../infra/restart.js");
vi.mock("../infra/skills-remote.js");
vi.mock("../infra/update-startup.js");
vi.mock("../logging/diagnostic.js");
vi.mock("../logging/subsystem.js", () => ({
  createSubsystemLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  })),
  runtimeForLogger: vi.fn(),
}));
vi.mock("../plugins/hook-runner-global.js");
vi.mock("../plugins/registry.js");
vi.mock("../process/command-queue.js");
vi.mock("../wizard/onboarding.js");
vi.mock("./auth-rate-limit.js");
vi.mock("./config-reload.js");
vi.mock("./exec-approval-manager.js");
vi.mock("./node-registry.js");
vi.mock("./server-channels.js");
vi.mock("./server-chat.js");
vi.mock("./server-close.js");
vi.mock("./server-cron.js");
vi.mock("./server-discovery-runtime.js");
vi.mock("./server-lanes.js");
vi.mock("./server-maintenance.js");
vi.mock("./server-methods-list.js");
vi.mock("./server-methods.js");
vi.mock("./server-methods/exec-approval.js");
vi.mock("./server-methods/nodes.helpers.js");
vi.mock("./server-mobile-nodes.js");
vi.mock("./server-model-catalog.js");
vi.mock("./server-node-subscriptions.js");
vi.mock("./server-plugins.js");
vi.mock("./server-reload-handlers.js");
vi.mock("./server-runtime-config.js");
vi.mock("./server-runtime-state.js");
vi.mock("./server-session-key.js");
vi.mock("./server-startup-log.js");
vi.mock("./server-startup.js");
vi.mock("./server-tailscale.js");
vi.mock("./server-wizard-sessions.js");
vi.mock("./server-ws-runtime.js");
vi.mock("./server/health-state.js");
vi.mock("./server/tls.js");

describe("server.impl security validation", () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = {
      OPENCLAW_GATEWAY_TOKEN: process.env.OPENCLAW_GATEWAY_TOKEN,
      OPENCLAW_GATEWAY_PASSWORD: process.env.OPENCLAW_GATEWAY_PASSWORD,
      VITEST: process.env.VITEST,
      OPENCLAW_TEST_MINIMAL_GATEWAY: process.env.OPENCLAW_TEST_MINIMAL_GATEWAY,
      OPENCLAW_GATEWAY_PORT: process.env.OPENCLAW_GATEWAY_PORT,
    };
  });

  afterEach(() => {
    // Restore original env vars
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value !== undefined) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }
  });

  describe("Phase 3: defense-in-depth security validation", () => {
    it("validateSecurityRequirements should be called during server start", () => {
      const mockConfig: OpenClawConfig = {
        gateway: {
          mode: "local",
          auth: { mode: "token", token: "test-token" },
          securityConfigured: true,
        },
      };

      const result = securityRequirements.validateSecurityRequirements(mockConfig);
      expect(result.valid).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it("should throw error when security validation fails", () => {
      const mockConfig: OpenClawConfig = {
        gateway: {
          mode: "local",
          auth: {},
          securityConfigured: false,
        },
      };

      const result = securityRequirements.validateSecurityRequirements(mockConfig);
      expect(result.valid).toBe(false);
      expect(result.failures.length).toBeGreaterThan(0);

      // Verify that formatSecurityFailures produces the expected error message
      const errorMessage = securityRequirements.formatSecurityFailures(result.failures);
      expect(errorMessage).toContain("Gateway startup blocked");
      expect(() => {
        throw new Error(errorMessage);
      }).toThrow("Gateway startup blocked");
    });

    it("should fail validation with missing auth mode", () => {
      const mockConfig: OpenClawConfig = {
        gateway: {
          mode: "local",
          auth: {},
          securityConfigured: true,
        },
      };

      const result = securityRequirements.validateSecurityRequirements(mockConfig);
      expect(result.valid).toBe(false);
      expect(result.failures.some((f) => f.field === "gateway.auth.mode")).toBe(true);
    });

    it("should fail validation with missing credential", () => {
      delete process.env.OPENCLAW_GATEWAY_TOKEN;
      const mockConfig: OpenClawConfig = {
        gateway: {
          mode: "local",
          auth: { mode: "token" },
          securityConfigured: true,
        },
      };

      const result = securityRequirements.validateSecurityRequirements(mockConfig);
      expect(result.valid).toBe(false);
      expect(result.failures.some((f) => f.field === "gateway.auth.credential")).toBe(true);
    });

    it("should fail validation without securityConfigured flag", () => {
      const mockConfig: OpenClawConfig = {
        gateway: {
          mode: "local",
          auth: { mode: "token", token: "test-token" },
        },
      };

      const result = securityRequirements.validateSecurityRequirements(mockConfig);
      expect(result.valid).toBe(false);
      expect(result.failures.some((f) => f.field === "gateway.securityConfigured")).toBe(true);
    });

    it("should pass validation with complete token config", () => {
      const mockConfig: OpenClawConfig = {
        gateway: {
          mode: "local",
          auth: { mode: "token", token: "secure-token-123" },
          securityConfigured: true,
        },
      };

      const result = securityRequirements.validateSecurityRequirements(mockConfig);
      expect(result.valid).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it("should pass validation with complete password config", () => {
      const mockConfig: OpenClawConfig = {
        gateway: {
          mode: "local",
          auth: { mode: "password", password: "secure-pass" },
          securityConfigured: true,
        },
      };

      const result = securityRequirements.validateSecurityRequirements(mockConfig);
      expect(result.valid).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it("should pass validation with complete trusted-proxy config", () => {
      const mockConfig: OpenClawConfig = {
        gateway: {
          mode: "local",
          auth: {
            mode: "trusted-proxy",
            trustedProxy: { userHeader: "x-forwarded-user" },
          },
          securityConfigured: true,
        },
      };

      const result = securityRequirements.validateSecurityRequirements(mockConfig);
      expect(result.valid).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it("should produce formatted error with all failed requirements", () => {
      const mockConfig: OpenClawConfig = {
        gateway: {},
      };

      const result = securityRequirements.validateSecurityRequirements(mockConfig);
      expect(result.valid).toBe(false);

      const errorMessage = securityRequirements.formatSecurityFailures(result.failures);
      expect(errorMessage).toContain("Gateway startup blocked");
      expect(errorMessage).toContain("gateway.auth.mode");
      expect(errorMessage).toContain("gateway.auth.credential");
      expect(errorMessage).toContain("gateway.securityConfigured");
      expect(errorMessage).toContain('Run "openclaw security audit"');
    });
  });
});
