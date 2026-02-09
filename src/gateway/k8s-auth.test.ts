import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  K8sAuthenticator,
  getK8sAuthenticator,
  resetK8sAuthenticator,
  type K8sAuthConfig,
} from "./k8s-auth.js";

// Mock fs for token/cert reads
vi.mock("node:fs", async () => {
  const actual = await vi.importActual("node:fs");
  return {
    ...actual,
    existsSync: vi.fn((p: string) => {
      if (p.includes("ca.crt") || p.includes("token")) {
        return true;
      }
      return false;
    }),
    readFileSync: vi.fn((p: string) => {
      if (p.includes("ca.crt")) {
        return "-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----";
      }
      if (p.includes("token")) {
        return "fake-gateway-token";
      }
      throw new Error(`unexpected read: ${p}`);
    }),
  };
});

describe("K8sAuthenticator", () => {
  const baseConfig: K8sAuthConfig = {
    enabled: true,
    apiServer: "https://k8s-api.test",
    caCertPath: "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt",
    tokenPath: "/var/run/secrets/kubernetes.io/serviceaccount/token",
  };

  beforeEach(() => {
    resetK8sAuthenticator();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isAvailable", () => {
    it("returns true when token and CA cert exist", () => {
      const auth = new K8sAuthenticator(baseConfig);
      expect(auth.isAvailable()).toBe(true);
    });
  });

  describe("validateToken", () => {
    it("returns authenticated with parsed identity on success", async () => {
      const auth = new K8sAuthenticator(baseConfig);

      const mockResponse = {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({
          status: {
            authenticated: true,
            user: {
              username: "system:serviceaccount:openclaw:worker-node",
              uid: "pod-uid-123",
            },
          },
        }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      const result = await auth.validateToken("test-sa-jwt");
      expect(result).toEqual({
        authenticated: true,
        namespace: "openclaw",
        serviceAccount: "worker-node",
        podUid: "pod-uid-123",
      });

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      expect(fetchCall[0]).toBe("https://k8s-api.test/apis/authentication.k8s.io/v1/tokenreviews");
      const fetchOpts = fetchCall[1] as RequestInit;
      expect(fetchOpts.method).toBe("POST");
      expect(fetchOpts.headers).toMatchObject({
        Authorization: "Bearer fake-gateway-token",
        "Content-Type": "application/json",
      });
      const body = JSON.parse(fetchOpts.body as string);
      expect(body.spec.token).toBe("test-sa-jwt");
    });

    it("returns not authenticated when TokenReview rejects", async () => {
      const auth = new K8sAuthenticator(baseConfig);

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            status: { authenticated: false, error: "token expired" },
          }),
        }),
      );

      const result = await auth.validateToken("expired-token");
      expect(result.authenticated).toBe(false);
      expect(result.error).toBe("token expired");
    });

    it("handles HTTP error from API server", async () => {
      const auth = new K8sAuthenticator(baseConfig);

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          text: async () => "forbidden",
        }),
      );

      const result = await auth.validateToken("test-token");
      expect(result.authenticated).toBe(false);
      expect(result.error).toContain("HTTP 403");
    });

    it("handles network error", async () => {
      const auth = new K8sAuthenticator(baseConfig);

      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));

      const result = await auth.validateToken("test-token");
      expect(result.authenticated).toBe(false);
      expect(result.error).toContain("connection refused");
    });

    it("rejects unexpected username format", async () => {
      const auth = new K8sAuthenticator(baseConfig);

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            status: {
              authenticated: true,
              user: { username: "regular-user" },
            },
          }),
        }),
      );

      const result = await auth.validateToken("test-token");
      expect(result.authenticated).toBe(false);
      expect(result.error).toContain("Unexpected username format");
    });
  });

  describe("isIdentityAllowed", () => {
    it("allows any identity when no allowlist", () => {
      const auth = new K8sAuthenticator(baseConfig);
      expect(auth.isIdentityAllowed("any-ns", "any-sa", "node")).toBe(true);
    });

    it("allows matching identity", () => {
      const auth = new K8sAuthenticator({
        ...baseConfig,
        allowedIdentities: [
          { namespace: "openclaw", serviceAccount: "worker", allowedRoles: ["node"] },
        ],
      });
      expect(auth.isIdentityAllowed("openclaw", "worker", "node")).toBe(true);
    });

    it("rejects non-matching namespace", () => {
      const auth = new K8sAuthenticator({
        ...baseConfig,
        allowedIdentities: [
          { namespace: "openclaw", serviceAccount: "worker", allowedRoles: ["node"] },
        ],
      });
      expect(auth.isIdentityAllowed("other-ns", "worker", "node")).toBe(false);
    });

    it("rejects non-matching role", () => {
      const auth = new K8sAuthenticator({
        ...baseConfig,
        allowedIdentities: [
          { namespace: "openclaw", serviceAccount: "worker", allowedRoles: ["node"] },
        ],
      });
      expect(auth.isIdentityAllowed("openclaw", "worker", "operator")).toBe(false);
    });
  });

  describe("getK8sAuthenticator", () => {
    it("returns null when not configured", () => {
      expect(getK8sAuthenticator(undefined)).toBeNull();
      expect(getK8sAuthenticator({ enabled: false })).toBeNull();
    });

    it("returns authenticator when enabled", () => {
      const auth = getK8sAuthenticator(baseConfig);
      expect(auth).toBeInstanceOf(K8sAuthenticator);
    });

    it("returns cached instance on subsequent calls", () => {
      const a = getK8sAuthenticator(baseConfig);
      const b = getK8sAuthenticator(baseConfig);
      expect(a).toBe(b);
    });
  });
});
