/**
 * QA-007 — Contract Validation Tests
 *
 * Two-section test suite:
 *  1. Static validation of route_contracts.json structure (always runs)
 *  2. Live contract testing against running sidecar (skipped if sidecar not available)
 *
 * Dynamically generates one test per route from the contract registry.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test, expect, beforeAll } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const contractsPath = resolve(__dirname, "../config/route_contracts.json");

let contracts;
try {
  contracts = JSON.parse(readFileSync(contractsPath, "utf-8"));
} catch {
  throw new Error(`Cannot load route_contracts.json from ${contractsPath}`);
}

const routeEntries = Object.entries(contracts.routes);
const BASE_URL = "http://127.0.0.1:48080";

// ─────────────────────────────────────────────────────────
// Section 1: Static Contract Registry Validation
// ─────────────────────────────────────────────────────────

describe("Contract Registry — structure", () => {
  test("has _config_version", () => {
    expect(contracts._config_version).toBe(1);
  });

  test("has description", () => {
    expect(typeof contracts.description).toBe("string");
    expect(contracts.description.length).toBeGreaterThan(0);
  });

  test("has routes object with entries", () => {
    expect(typeof contracts.routes).toBe("object");
    expect(routeEntries.length).toBeGreaterThan(100);
  });

  test("route count matches expected range (155-170)", () => {
    expect(routeEntries.length).toBeGreaterThanOrEqual(155);
    expect(routeEntries.length).toBeLessThanOrEqual(170);
  });
});

describe("Contract Registry — per-route shape", () => {
  test.each(routeEntries)("%s has valid status_codes array", (routeKey, contract) => {
    expect(Array.isArray(contract.status_codes)).toBe(true);
    expect(contract.status_codes.length).toBeGreaterThan(0);
    for (const code of contract.status_codes) {
      expect(typeof code).toBe("number");
      expect(code).toBeGreaterThanOrEqual(200);
      expect(code).toBeLessThan(600);
    }
  });

  test.each(routeEntries)("%s has required_fields array", (routeKey, contract) => {
    expect(Array.isArray(contract.required_fields)).toBe(true);
    for (const field of contract.required_fields) {
      expect(typeof field).toBe("string");
      expect(field.length).toBeGreaterThan(0);
    }
  });

  test.each(routeEntries)("%s has content_type application/json", (routeKey, contract) => {
    expect(contract.content_type).toBe("application/json");
  });

  test.each(routeEntries)("%s route key matches METHOD /path pattern", (routeKey) => {
    expect(routeKey).toMatch(/^(GET|POST|PUT|PATCH|DELETE)\s+\//);
  });
});

describe("Contract Registry — method coverage", () => {
  const methods = routeEntries.map(([key]) => key.split(" ")[0]);

  test("includes GET routes", () => {
    expect(methods.filter((m) => m === "GET").length).toBeGreaterThan(20);
  });

  test("includes POST routes", () => {
    expect(methods.filter((m) => m === "POST").length).toBeGreaterThan(40);
  });
});

describe("Contract Registry — path namespace coverage", () => {
  const paths = routeEntries.map(([key]) => key.split(" ")[1]);

  const requiredPrefixes = [
    "/status",
    "/doctor",
    "/ops/",
    "/triage/",
    "/deals/",
    "/graph/",
    "/drafts/",
    "/commitments/",
    "/gtd/",
    "/meeting/",
    "/filing/",
    "/improvement/",
    "/reporting/",
    "/governance/",
    "/events/",
  ];

  test.each(requiredPrefixes)("has routes under %s", (prefix) => {
    const matching = paths.filter((p) => p.startsWith(prefix) || p === prefix);
    expect(matching.length).toBeGreaterThan(0);
  });

  test("covers builder-lane routes", () => {
    const bl = paths.filter((p) => p.includes("builder-lane"));
    expect(bl.length).toBeGreaterThanOrEqual(6);
  });

  test("covers self-healing routes", () => {
    const sh = paths.filter((p) => p.includes("self-healing"));
    expect(sh.length).toBeGreaterThanOrEqual(6);
  });

  test("covers evaluation routes", () => {
    const ev = paths.filter((p) => p.includes("evaluation"));
    expect(ev.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Contract Registry — field uniqueness", () => {
  test("no duplicate route keys", () => {
    const keys = routeEntries.map(([k]) => k);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });
});

describe("Contract Registry — critical routes have required_fields", () => {
  const criticalRoutes = [
    "GET /status",
    "GET /doctor",
    "GET /triage/list",
    "GET /deals/list",
    "GET /commitments/list",
    "GET /gtd/actions/list",
    "GET /reporting/morning-brief",
    "GET /reporting/eod-digest",
    "GET /ops/builder-lane/status",
    "GET /ops/self-healing/status",
  ];

  test.each(criticalRoutes)("%s has non-empty required_fields", (routeKey) => {
    const contract = contracts.routes[routeKey];
    expect(contract).toBeDefined();
    expect(contract.required_fields.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────
// Section 2: Live Contract Testing Against Running Sidecar
// ─────────────────────────────────────────────────────────

// Routes that are safe to call without authentication or external deps.
// Only GET routes that read from local ledgers (no Graph API, no LLM calls).
const SAFE_GET_ROUTES = [
  "GET /status",
  "GET /doctor",
  "GET /triage/list",
  "GET /triage/patterns",
  "GET /deals/list",
  "GET /deals/stale-owners",
  "GET /commitments/list",
  "GET /gtd/actions/list",
  "GET /gtd/waiting-for/list",
  "GET /drafts/queue",
  "GET /filing/suggestions/list",
  "GET /filing/para/structure",
  "GET /facility/alerts/list",
  "GET /improvement/proposals",
  "GET /improvement/failure-aggregation",
  "GET /ops/scheduler",
  "GET /ops/pending-deliveries",
  "GET /ops/notification-budget",
  "GET /ops/tool-usage",
  "GET /ops/llm-provider",
  "GET /ops/ingestion/status",
  "GET /ops/onboarding/discovery-status",
  "GET /ops/builder-lane/patterns",
  "GET /ops/builder-lane/status",
  "GET /ops/builder-lane/improvement-metrics",
  "GET /ops/self-healing/status",
  "GET /ops/self-healing/circuit-breakers",
  "GET /ops/self-healing/provider-health",
  "GET /ops/self-healing/correction-taxonomy",
  "GET /ops/self-healing/engagement-insights",
  "GET /ops/self-healing/noise-level",
  "GET /ops/self-healing/autonomy-status",
  "GET /ops/evaluation/status",
  "GET /events/stats",
  "GET /events/recent",
  "GET /meeting/upcoming",
  "GET /reporting/deep-work-metrics",
  "GET /reporting/trust-metrics",
  "GET /trust/autonomy/evaluate",
];

/**
 * Detect if the sidecar is running by trying to fetch /status.
 */
async function isSidecarRunning() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(`${BASE_URL}/status`, { signal: controller.signal });
    clearTimeout(timeout);
    return resp.ok;
  } catch {
    return false;
  }
}

let sidecarAvailable = false;

beforeAll(async () => {
  sidecarAvailable = await isSidecarRunning();
});

describe("Live Contract Tests — safe GET routes", () => {
  // Build the test entries only for routes that exist in the contracts
  const testableRoutes = SAFE_GET_ROUTES.filter((r) => contracts.routes[r]).map((routeKey) => {
    const contract = contracts.routes[routeKey];
    const path = routeKey.replace(/^GET\s+/, "");
    return [routeKey, path, contract];
  });

  test.skipIf(() => !sidecarAvailable).each(testableRoutes)(
    "%s — status code matches contract",
    async (routeKey, path, contract) => {
      const resp = await fetch(`${BASE_URL}${path}`);
      expect(contract.status_codes).toContain(resp.status);
    },
  );

  test.skipIf(() => !sidecarAvailable).each(testableRoutes)(
    "%s — content-type is application/json",
    async (_routeKey, path) => {
      const resp = await fetch(`${BASE_URL}${path}`);
      const ct = resp.headers.get("content-type") || "";
      expect(ct).toContain("application/json");
    },
  );

  test.skipIf(() => !sidecarAvailable).each(testableRoutes)(
    "%s — x-ted-api-version header present",
    async (_routeKey, path) => {
      const resp = await fetch(`${BASE_URL}${path}`);
      const version = resp.headers.get("x-ted-api-version");
      expect(version).toBeTruthy();
    },
  );

  test.skipIf(() => !sidecarAvailable).each(testableRoutes)(
    "%s — response contains all required_fields",
    async (_routeKey, path, contract) => {
      const resp = await fetch(`${BASE_URL}${path}`);
      const body = await resp.json();
      for (const field of contract.required_fields) {
        expect(body).toHaveProperty(field);
      }
    },
  );
});

// ─────────────────────────────────────────────────────────
// Section 3: Contract Consistency Checks
// ─────────────────────────────────────────────────────────

describe("Contract Registry — consistency", () => {
  test("every route with path params uses {param} syntax", () => {
    for (const [routeKey] of routeEntries) {
      const path = routeKey.split(" ")[1];
      // If the path has a segment starting with colon, it should use braces instead
      const segments = path.split("/");
      for (const seg of segments) {
        expect(seg.startsWith(":")).toBe(false);
      }
    }
  });

  test("every 200-only route has no error codes", () => {
    for (const [_routeKey, contract] of routeEntries) {
      if (contract.status_codes.length === 1 && contract.status_codes[0] === 200) {
        for (const code of contract.status_codes) {
          expect(code).toBeLessThan(400);
        }
      }
    }
  });

  test("POST routes that create resources include 200 or 201", () => {
    const createRoutes = routeEntries.filter(
      ([key]) => key.startsWith("POST") && (key.includes("/create") || key.includes("/ingest")),
    );
    for (const [_routeKey, contract] of createRoutes) {
      const hasSuccessCode = contract.status_codes.some((c) => c === 200 || c === 201);
      expect(hasSuccessCode).toBe(true);
    }
  });

  test("all graph routes include 400 status code for invalid profile", () => {
    const graphRoutes = routeEntries.filter(([key]) => key.includes("/graph/"));
    for (const [_routeKey, contract] of graphRoutes) {
      expect(contract.status_codes).toContain(400);
    }
  });

  test("auth routes include 401 or 400", () => {
    const authRoutes = routeEntries.filter(([key]) => key.includes("/auth/"));
    for (const [_routeKey, contract] of authRoutes) {
      const hasAuthCode = contract.status_codes.some((c) => c === 400 || c === 401);
      expect(hasAuthCode).toBe(true);
    }
  });
});
