import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { OpenClawConfig } from "./types.openclaw.js";
import {
  MANDATORY_SECURITY_REQUIREMENTS,
  validateSecurityRequirements,
  formatSecurityFailures,
} from "./security-requirements.js";

describe("security-requirements", () => {
  // Store original env vars
  let originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
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

  describe("MANDATORY_SECURITY_REQUIREMENTS", () => {
    it("should have exactly 3 requirements", () => {
      expect(MANDATORY_SECURITY_REQUIREMENTS).toHaveLength(3);
    });

    it("should have all required fields on each requirement", () => {
      for (const req of MANDATORY_SECURITY_REQUIREMENTS) {
        expect(req).toHaveProperty("field");
        expect(req).toHaveProperty("description");
        expect(req).toHaveProperty("check");
        expect(req).toHaveProperty("remediation");
        expect(typeof req.field).toBe("string");
        expect(typeof req.description).toBe("string");
        expect(typeof req.check).toBe("function");
        expect(typeof req.remediation).toBe("string");
      }
    });
  });

  describe("gateway.auth.mode requirement", () => {
    it("should pass with token mode", () => {
      const config: OpenClawConfig = {
        gateway: {
          auth: { mode: "token", token: "test-token" },
          securityConfigured: true,
        },
      };
      const req = MANDATORY_SECURITY_REQUIREMENTS[0];
      expect(req.check(config)).toBe(true);
    });

    it("should pass with password mode", () => {
      const config: OpenClawConfig = {
        gateway: {
          auth: { mode: "password", password: "test-password" },
          securityConfigured: true,
        },
      };
      const req = MANDATORY_SECURITY_REQUIREMENTS[0];
      expect(req.check(config)).toBe(true);
    });

    it("should pass with trusted-proxy mode", () => {
      const config: OpenClawConfig = {
        gateway: {
          auth: {
            mode: "trusted-proxy",
            trustedProxy: { userHeader: "x-forwarded-user" },
          },
          securityConfigured: true,
        },
      };
      const req = MANDATORY_SECURITY_REQUIREMENTS[0];
      expect(req.check(config)).toBe(true);
    });

    it("should fail with undefined mode", () => {
      const config: OpenClawConfig = {
        gateway: { auth: {} },
      };
      const req = MANDATORY_SECURITY_REQUIREMENTS[0];
      expect(req.check(config)).toBe(false);
    });

    it("should fail with missing gateway config", () => {
      const config: OpenClawConfig = {};
      const req = MANDATORY_SECURITY_REQUIREMENTS[0];
      expect(req.check(config)).toBe(false);
    });

    it("should fail with missing auth config", () => {
      const config: OpenClawConfig = { gateway: {} };
      const req = MANDATORY_SECURITY_REQUIREMENTS[0];
      expect(req.check(config)).toBe(false);
    });
  });

  describe("gateway.auth.credential requirement", () => {
    it("should pass with token in config", () => {
      const config: OpenClawConfig = {
        gateway: {
          auth: { mode: "token", token: "test-token" },
          securityConfigured: true,
        },
      };
      const req = MANDATORY_SECURITY_REQUIREMENTS[1];
      expect(req.check(config)).toBe(true);
    });

    it("should pass with token in env var", () => {
      delete process.env.OPENCLAW_GATEWAY_TOKEN;
      process.env.OPENCLAW_GATEWAY_TOKEN = "env-token";
      const config: OpenClawConfig = {
        gateway: {
          auth: { mode: "token" },
          securityConfigured: true,
        },
      };
      const req = MANDATORY_SECURITY_REQUIREMENTS[1];
      expect(req.check(config)).toBe(true);
    });

    it("should pass with password in config", () => {
      const config: OpenClawConfig = {
        gateway: {
          auth: { mode: "password", password: "test-password" },
          securityConfigured: true,
        },
      };
      const req = MANDATORY_SECURITY_REQUIREMENTS[1];
      expect(req.check(config)).toBe(true);
    });

    it("should pass with password in env var", () => {
      delete process.env.OPENCLAW_GATEWAY_PASSWORD;
      process.env.OPENCLAW_GATEWAY_PASSWORD = "env-password";
      const config: OpenClawConfig = {
        gateway: {
          auth: { mode: "password" },
          securityConfigured: true,
        },
      };
      const req = MANDATORY_SECURITY_REQUIREMENTS[1];
      expect(req.check(config)).toBe(true);
    });

    it("should pass with trusted-proxy userHeader", () => {
      const config: OpenClawConfig = {
        gateway: {
          auth: {
            mode: "trusted-proxy",
            trustedProxy: { userHeader: "x-forwarded-user" },
          },
          securityConfigured: true,
        },
      };
      const req = MANDATORY_SECURITY_REQUIREMENTS[1];
      expect(req.check(config)).toBe(true);
    });

    it("should fail with token mode but no token", () => {
      delete process.env.OPENCLAW_GATEWAY_TOKEN;
      const config: OpenClawConfig = {
        gateway: {
          auth: { mode: "token" },
          securityConfigured: true,
        },
      };
      const req = MANDATORY_SECURITY_REQUIREMENTS[1];
      expect(req.check(config)).toBe(false);
    });

    it("should fail with password mode but no password", () => {
      delete process.env.OPENCLAW_GATEWAY_PASSWORD;
      const config: OpenClawConfig = {
        gateway: {
          auth: { mode: "password" },
          securityConfigured: true,
        },
      };
      const req = MANDATORY_SECURITY_REQUIREMENTS[1];
      expect(req.check(config)).toBe(false);
    });

    it("should fail with trusted-proxy mode but no userHeader", () => {
      const config: OpenClawConfig = {
        gateway: {
          auth: { mode: "trusted-proxy" },
          securityConfigured: true,
        },
      };
      const req = MANDATORY_SECURITY_REQUIREMENTS[1];
      expect(req.check(config)).toBe(false);
    });

    it("should fail with undefined mode", () => {
      const config: OpenClawConfig = {
        gateway: { auth: {} },
      };
      const req = MANDATORY_SECURITY_REQUIREMENTS[1];
      expect(req.check(config)).toBe(false);
    });
  });

  describe("gateway.securityConfigured requirement", () => {
    it("should pass when set to true", () => {
      const config: OpenClawConfig = {
        gateway: {
          auth: { mode: "token", token: "test-token" },
          securityConfigured: true,
        },
      };
      const req = MANDATORY_SECURITY_REQUIREMENTS[2];
      expect(req.check(config)).toBe(true);
    });

    it("should fail when set to false", () => {
      const config: OpenClawConfig = {
        gateway: {
          auth: { mode: "token", token: "test-token" },
          securityConfigured: false,
        },
      };
      const req = MANDATORY_SECURITY_REQUIREMENTS[2];
      expect(req.check(config)).toBe(false);
    });

    it("should fail when undefined", () => {
      const config: OpenClawConfig = {
        gateway: {
          auth: { mode: "token", token: "test-token" },
        },
      };
      const req = MANDATORY_SECURITY_REQUIREMENTS[2];
      expect(req.check(config)).toBe(false);
    });

    it("should fail when gateway config is missing", () => {
      const config: OpenClawConfig = {};
      const req = MANDATORY_SECURITY_REQUIREMENTS[2];
      expect(req.check(config)).toBe(false);
    });
  });

  describe("validateSecurityRequirements", () => {
    it("should return valid=true with fully configured security", () => {
      const config: OpenClawConfig = {
        gateway: {
          auth: { mode: "token", token: "test-token" },
          securityConfigured: true,
        },
      };
      const result = validateSecurityRequirements(config);
      expect(result.valid).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it("should return valid=false with missing auth mode", () => {
      const config: OpenClawConfig = {
        gateway: {
          securityConfigured: true,
        },
      };
      const result = validateSecurityRequirements(config);
      expect(result.valid).toBe(false);
      expect(result.failures.length).toBeGreaterThan(0);
      expect(result.failures.some((f) => f.field === "gateway.auth.mode")).toBe(true);
    });

    it("should return valid=false with missing credential", () => {
      delete process.env.OPENCLAW_GATEWAY_TOKEN;
      const config: OpenClawConfig = {
        gateway: {
          auth: { mode: "token" },
          securityConfigured: true,
        },
      };
      const result = validateSecurityRequirements(config);
      expect(result.valid).toBe(false);
      expect(result.failures.length).toBeGreaterThan(0);
      expect(result.failures.some((f) => f.field === "gateway.auth.credential")).toBe(true);
    });

    it("should return valid=false with missing securityConfigured", () => {
      const config: OpenClawConfig = {
        gateway: {
          auth: { mode: "token", token: "test-token" },
        },
      };
      const result = validateSecurityRequirements(config);
      expect(result.valid).toBe(false);
      expect(result.failures.length).toBeGreaterThan(0);
      expect(result.failures.some((f) => f.field === "gateway.securityConfigured")).toBe(true);
    });

    it("should return all failing requirements in empty config", () => {
      const config: OpenClawConfig = {};
      const result = validateSecurityRequirements(config);
      expect(result.valid).toBe(false);
      expect(result.failures).toHaveLength(3);
    });

    it("should work with password mode from env var", () => {
      delete process.env.OPENCLAW_GATEWAY_PASSWORD;
      process.env.OPENCLAW_GATEWAY_PASSWORD = "secure-password";
      const config: OpenClawConfig = {
        gateway: {
          auth: { mode: "password" },
          securityConfigured: true,
        },
      };
      const result = validateSecurityRequirements(config);
      expect(result.valid).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it("should work with trusted-proxy mode", () => {
      const config: OpenClawConfig = {
        gateway: {
          auth: {
            mode: "trusted-proxy",
            trustedProxy: {
              userHeader: "x-forwarded-user",
              requiredHeaders: ["x-forwarded-proto"],
              allowUsers: ["user@example.com"],
            },
          },
          securityConfigured: true,
        },
      };
      const result = validateSecurityRequirements(config);
      expect(result.valid).toBe(true);
      expect(result.failures).toHaveLength(0);
    });
  });

  describe("formatSecurityFailures", () => {
    it("should format failures with header and remediation", () => {
      const failures = MANDATORY_SECURITY_REQUIREMENTS.slice(0, 2);
      const output = formatSecurityFailures(failures);
      expect(output).toContain("Gateway startup blocked");
      expect(output).toContain("gateway.auth.mode");
      expect(output).toContain("gateway.auth.credential");
      expect(output).toContain("openclaw configure");
      expect(output).toContain("openclaw security audit");
    });

    it("should include all failure details", () => {
      const failures = [MANDATORY_SECURITY_REQUIREMENTS[0]];
      const output = formatSecurityFailures(failures);
      expect(output).toContain(failures[0].field);
      expect(output).toContain(failures[0].description);
      expect(output).toContain(failures[0].remediation);
    });

    it("should format empty failures list", () => {
      const output = formatSecurityFailures([]);
      expect(output).toContain("Gateway startup blocked");
      expect(output).toContain("openclaw security audit");
    });

    it("should use consistent formatting", () => {
      const failures = MANDATORY_SECURITY_REQUIREMENTS;
      const output = formatSecurityFailures(failures);
      const lines = output.split("\n");
      expect(lines[0]).toContain("Gateway startup blocked");
      expect(lines[1]).toBe("");
      // Each failure should have field line, remediation line, and blank line
      expect(output.match(/✗/g)?.length).toBe(3);
      expect(output.match(/→/g)?.length).toBe(3);
    });
  });

  describe("edge cases", () => {
    it("should handle partial gateway config", () => {
      const config: OpenClawConfig = {
        gateway: {
          port: 18789,
          bind: "loopback",
        },
      };
      const result = validateSecurityRequirements(config);
      expect(result.valid).toBe(false);
      expect(result.failures).toHaveLength(3);
    });

    it("should handle empty auth object", () => {
      const config: OpenClawConfig = {
        gateway: {
          auth: {},
        },
      };
      const result = validateSecurityRequirements(config);
      expect(result.valid).toBe(false);
      expect(result.failures.length).toBeGreaterThanOrEqual(2);
    });

    it("should handle env var precedence over config", () => {
      delete process.env.OPENCLAW_GATEWAY_TOKEN;
      process.env.OPENCLAW_GATEWAY_TOKEN = "env-token-value";
      const config: OpenClawConfig = {
        gateway: {
          auth: { mode: "token", token: "" }, // Empty string in config
          securityConfigured: true,
        },
      };
      const result = validateSecurityRequirements(config);
      // Env var should be picked up
      expect(result.valid).toBe(true);
    });

    it("should require non-empty userHeader for trusted-proxy", () => {
      const config: OpenClawConfig = {
        gateway: {
          auth: {
            mode: "trusted-proxy",
            trustedProxy: { userHeader: "" }, // Empty string
          },
          securityConfigured: true,
        },
      };
      const result = validateSecurityRequirements(config);
      expect(result.valid).toBe(false);
      expect(result.failures.some((f) => f.field === "gateway.auth.credential")).toBe(true);
    });
  });
});
