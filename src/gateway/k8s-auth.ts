import { readFileSync, existsSync } from "node:fs";

/**
 * Configuration for Kubernetes ServiceAccount Trust authentication.
 * When enabled, pods presenting a valid K8s ServiceAccount JWT
 * can skip device pairing entirely.
 */
export type K8sAuthConfig = {
  /** Enable K8s ServiceAccount Trust authentication (default: false). */
  enabled?: boolean;
  /** K8s API server URL (default: https://kubernetes.default.svc). */
  apiServer?: string;
  /** Path to the CA cert for TLS to the API server. */
  caCertPath?: string;
  /** Path to the gateway's own ServiceAccount token (for TokenReview calls). */
  tokenPath?: string;
  /** Which identities are allowed to connect. */
  allowedIdentities?: K8sAllowedIdentity[];
  /** Don't persist device records for K8s-authenticated connections. */
  ephemeralSessions?: boolean;
  /** Log every K8s auth attempt. */
  auditLog?: boolean;
};

export type K8sAllowedIdentity = {
  namespace: string;
  serviceAccount: string;
  allowedRoles: string[];
};

export type K8sTokenReviewResult = {
  authenticated: boolean;
  namespace?: string;
  serviceAccount?: string;
  podUid?: string;
  error?: string;
};

const DEFAULT_API_SERVER = "https://kubernetes.default.svc";
const DEFAULT_CA_CERT_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt";
const DEFAULT_TOKEN_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/token";

/**
 * K8s ServiceAccount JWT authenticator.
 * Uses the TokenReview API to validate SA tokens presented by worker pods.
 */
export class K8sAuthenticator {
  private config: K8sAuthConfig;
  private gatewayTokenPath: string;
  private caCertPath: string;
  private apiServer: string;

  constructor(config: K8sAuthConfig) {
    this.config = config;
    this.apiServer = config.apiServer || DEFAULT_API_SERVER;
    this.caCertPath = config.caCertPath || DEFAULT_CA_CERT_PATH;
    this.gatewayTokenPath = config.tokenPath || DEFAULT_TOKEN_PATH;
  }

  /**
   * Check if this authenticator is operational (has access to K8s API credentials).
   */
  isAvailable(): boolean {
    return existsSync(this.gatewayTokenPath) && existsSync(this.caCertPath);
  }

  /**
   * Read the gateway's own SA token (refreshed by kubelet automatically).
   */
  private readGatewayToken(): string {
    return readFileSync(this.gatewayTokenPath, "utf8").trim();
  }

  /**
   * Validate a ServiceAccount JWT via the Kubernetes TokenReview API.
   */
  async validateToken(saToken: string): Promise<K8sTokenReviewResult> {
    const gatewayToken = this.readGatewayToken();
    // CA cert read for potential future use with custom TLS dispatcher;
    // currently relies on NODE_EXTRA_CA_CERTS at process level.
    const _caCert = readFileSync(this.caCertPath, "utf8");

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.apiServer}/apis/authentication.k8s.io/v1/tokenreviews`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gatewayToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiVersion: "authentication.k8s.io/v1",
          kind: "TokenReview",
          spec: { token: saToken },
        }),
        signal: controller.signal,
        // Node.js >= 22 can pass CA via dispatcher; for now, rely on NODE_EXTRA_CA_CERTS
        // or the default K8s in-cluster CA bundle.
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        return {
          authenticated: false,
          error: `TokenReview failed: HTTP ${response.status} ${text.slice(0, 200)}`,
        };
      }

      const result = (await response.json()) as {
        status?: {
          authenticated?: boolean;
          user?: { username?: string; uid?: string };
          error?: string;
        };
      };

      if (!result.status?.authenticated) {
        return {
          authenticated: false,
          error: result.status?.error || "Token not authenticated",
        };
      }

      // Parse "system:serviceaccount:NAMESPACE:SA_NAME"
      const username = result.status.user?.username || "";
      const parts = username.split(":");
      if (parts.length !== 4 || parts[0] !== "system" || parts[1] !== "serviceaccount") {
        return { authenticated: false, error: `Unexpected username format: ${username}` };
      }

      return {
        authenticated: true,
        namespace: parts[2],
        serviceAccount: parts[3],
        podUid: result.status.user?.uid,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { authenticated: false, error: `TokenReview request failed: ${msg}` };
    }
  }

  /**
   * Check if a validated identity is allowed per configuration.
   */
  isIdentityAllowed(namespace: string, serviceAccount: string, requestedRole: string): boolean {
    const identities = this.config.allowedIdentities;
    if (!identities || identities.length === 0) {
      // No allowlist = allow any namespace/SA (rely on NetworkPolicy for isolation)
      return true;
    }
    return identities.some(
      (identity) =>
        identity.namespace === namespace &&
        identity.serviceAccount === serviceAccount &&
        identity.allowedRoles.includes(requestedRole),
    );
  }
}

let cachedAuthenticator: K8sAuthenticator | null = null;

/**
 * Get or create the K8s authenticator singleton.
 * Returns null if k8sAuth is not configured.
 */
export function getK8sAuthenticator(config?: K8sAuthConfig): K8sAuthenticator | null {
  if (!config?.enabled) {
    return null;
  }
  if (!cachedAuthenticator) {
    cachedAuthenticator = new K8sAuthenticator(config);
  }
  return cachedAuthenticator;
}

/**
 * Reset the cached authenticator (for testing).
 */
export function resetK8sAuthenticator(): void {
  cachedAuthenticator = null;
}
