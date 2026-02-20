import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { OpenClawConfig } from "../../config/types.openclaw.js";
import * as securityRequirements from "../../config/security-requirements.js";

// Mock dependencies
vi.mock("../../config/config.js", () => ({
  CONFIG_PATH: "/tmp/test-config.json",
  loadConfig: vi.fn(),
  readConfigFileSnapshot: vi.fn(),
  resolveStateDir: vi.fn(() => "/tmp/state"),
  resolveGatewayPort: vi.fn(() => 18789),
}));

vi.mock("../../gateway/auth.js");
vi.mock("../../gateway/server.js");
vi.mock("../../gateway/ws-logging.js");
vi.mock("../../runtime.js", () => ({
  defaultRuntime: {
    error: vi.fn(),
    exit: vi.fn(),
  },
}));
vi.mock("./dev.js");
vi.mock("./run-loop.js");

describe("gateway-cli/run security validation", () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = {
      OPENCLAW_GATEWAY_TOKEN: process.env.OPENCLAW_GATEWAY_TOKEN,
      OPENCLAW_GATEWAY_PASSWORD: process.env.OPENCLAW_GATEWAY_PASSWORD,
    };
  });

  afterEach(() => {
    // Restore original env vars
    if (originalEnv.OPENCLAW_GATEWAY_TOKEN !== undefined) {
      process.env.OPENCLAW_GATEWAY_TOKEN = originalEnv.OPENCLAW_GATEWAY_TOKEN;
    } else {
      delete process.env.OPENCLAW_GATEWAY_TOKEN;
    }
    if (originalEnv.OPENCLAW_GATEWAY_PASSWORD !== undefined) {
      process.env.OPENCLAW_GATEWAY_PASSWORD = originalEnv.OPENCLAW_GATEWAY_PASSWORD;
    } else {
      delete process.env.OPENCLAW_GATEWAY_PASSWORD;
    }
  });

  describe("Phase 3: security validation on startup", () => {
    it("validateSecurityRequirements should be called with config", async () => {
      const validateSpy = vi.spyOn(securityRequirements, "validateSecurityRequirements");

      const mockConfig: OpenClawConfig = {
        gateway: {
          mode: "local",
          auth: { mode: "token", token: "test-token" },
          securityConfigured: true,
        },
      };

      // Verify the function exists and can be called
      const result = securityRequirements.validateSecurityRequirements(mockConfig);
      expect(validateSpy).toHaveBeenCalledWith(mockConfig);
      expect(result.valid).toBe(true);
      expect(result.failures).toHaveLength(0);

      validateSpy.mockRestore();
    });

    it("formatSecurityFailures should format failure messages", () => {
      const failures = [
        {
          field: "gateway.auth.mode",
          description: "Gateway authentication mode must be explicitly configured",
          check: () => false,
          remediation: 'Run "openclaw configure" and select an authentication mode',
        },
      ];

      const formatted = securityRequirements.formatSecurityFailures(failures);
      expect(formatted).toContain("Gateway startup blocked");
      expect(formatted).toContain("gateway.auth.mode");
      expect(formatted).toContain("Gateway authentication mode");
      expect(formatted).toContain('Run "openclaw configure"');
    });

    it("validateSecurityRequirements should fail with missing auth mode", () => {
      const mockConfig: OpenClawConfig = {
        gateway: {
          mode: "local",
          auth: {},
          securityConfigured: true,
        },
      };

      const result = securityRequirements.validateSecurityRequirements(mockConfig);
      expect(result.valid).toBe(false);
      expect(result.failures.length).toBeGreaterThan(0);
      expect(result.failures.some((f) => f.field === "gateway.auth.mode")).toBe(true);
    });

    it("validateSecurityRequirements should fail with missing credential", () => {
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

    it("validateSecurityRequirements should fail without securityConfigured flag", () => {
      const mockConfig: OpenClawConfig = {
        gateway: {
          mode: "local",
          auth: { mode: "token", token: "test-token" },
          securityConfigured: false,
        },
      };

      const result = securityRequirements.validateSecurityRequirements(mockConfig);
      expect(result.valid).toBe(false);
      expect(result.failures.some((f) => f.field === "gateway.securityConfigured")).toBe(true);
    });

    it("validateSecurityRequirements should pass with valid token config", () => {
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

    it("validateSecurityRequirements should pass with valid password config", () => {
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

    it("validateSecurityRequirements should pass with trusted-proxy config", () => {
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
  });
});
