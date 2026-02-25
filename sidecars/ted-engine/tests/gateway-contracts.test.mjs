/**
 * QA-008 — Extension Gateway Contract Tests
 *
 * Static analysis test — reads source files, not the running system.
 * Verifies every gateway method in index.ts has a corresponding route
 * in route_contracts.json, and critical sidecar routes have gateway methods.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const contractsPath = resolve(__dirname, "../config/route_contracts.json");
const indexTsPath = resolve(__dirname, "../../../extensions/ted-sidecar/index.ts");

// Load route contracts
const contracts = JSON.parse(readFileSync(contractsPath, "utf-8"));
const contractRouteKeys = Object.keys(contracts.routes);

// Load index.ts source
const indexSource = readFileSync(indexTsPath, "utf-8");

// ─────────────────────────────────────────────────────────
// Extract gateway method registrations from index.ts
// ─────────────────────────────────────────────────────────

/**
 * Extract all api.registerGatewayMethod calls.
 * Strategy: find each registerGatewayMethod, extract the method name,
 * then scan the handler body for callAuthenticatedTed*Route to find the route path.
 *
 * Signatures:
 *  callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body)
 *  callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath)
 *
 * Route path may be:
 *  - String literal: "/deals/list"
 *  - Template literal: `/deals/${encodeURIComponent(dealId)}/update`
 *  - Variable reference: routePath  (requires resolving const routePath = "..." in the block)
 */
function extractGatewayMethods(source) {
  const methods = new Map();

  // Find all registerGatewayMethod positions
  const positions = [];
  const regMethodRegex = /api\.registerGatewayMethod\(/g;
  let rmMatch;
  while ((rmMatch = regMethodRegex.exec(source)) !== null) {
    positions.push(rmMatch.index);
  }

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1] : Math.min(source.length, start + 5000);
    const block = source.slice(start, end);

    // Extract method name — could be on same line or next line
    const nameMatch = block.match(/registerGatewayMethod\(\s*\n?\s*["']([^"']+)["']/);
    if (!nameMatch) {
      continue;
    }
    const name = nameMatch[1];

    // Try to extract route from callAuthenticatedTedGetRoute or callAuthenticatedTedRoute
    const routeInfo = extractRouteFromBlock(block);
    methods.set(name, routeInfo);
  }

  return methods;
}

/**
 * Extract route info from a handler block.
 * Returns { method: "GET"|"POST"|null, route: string|null }
 */
function extractRouteFromBlock(block) {
  // Collapse the block to single line for easier regex matching
  // (template literals and function calls may span multiple lines)
  const collapsed = block.replace(/\n\s*/g, " ");

  // Pattern 1: string literal or template literal as 3rd arg
  const getRouteMatch = collapsed.match(
    /callAuthenticatedTedGetRoute\([^,]+,\s*[^,]+,\s*(?:["']([^"']+)["']|`([^`]+)`)/,
  );
  const postRouteMatch = collapsed.match(
    /callAuthenticatedTedRoute\([^,]+,\s*[^,]+,\s*(?:["']([^"']+)["']|`([^`]+)`)/,
  );

  if (getRouteMatch) {
    const rawRoute = getRouteMatch[1] || getRouteMatch[2];
    return { method: "GET", route: normalizeTemplateRoute(rawRoute) };
  }
  if (postRouteMatch) {
    const rawRoute = postRouteMatch[1] || postRouteMatch[2];
    return { method: "POST", route: normalizeTemplateRoute(rawRoute) };
  }

  // Pattern 2: variable reference as 3rd arg (e.g. routePath)
  const getVarMatch = collapsed.match(
    /callAuthenticatedTedGetRoute\([^,]+,\s*[^,]+,\s*(\w+)\s*[,)]/,
  );
  const postVarMatch = collapsed.match(/callAuthenticatedTedRoute\([^,]+,\s*[^,]+,\s*(\w+)\s*,/);

  if (getVarMatch) {
    const varName = getVarMatch[1];
    const resolved = resolveVariableInBlock(collapsed, varName);
    if (resolved) {
      return { method: "GET", route: normalizeTemplateRoute(resolved) };
    }
  }
  if (postVarMatch) {
    const varName = postVarMatch[1];
    const resolved = resolveVariableInBlock(collapsed, varName);
    if (resolved) {
      return { method: "POST", route: normalizeTemplateRoute(resolved) };
    }
  }

  // Not a sidecar-routed method
  return { method: null, route: null };
}

/**
 * Resolve a variable assignment in the block.
 * e.g. `const routePath = "/deals/list"` or `const routePath = \`/deals/${x}\``
 */
function resolveVariableInBlock(block, varName) {
  // String literal: const varName = "/path"
  const strMatch = block.match(new RegExp(`const\\s+${varName}\\s*=\\s*["']([^"']+)["']`));
  if (strMatch) {
    return strMatch[1];
  }

  // Template literal: const varName = `/path/${x}`
  const tplMatch = block.match(new RegExp(`const\\s+${varName}\\s*=\\s*\`([^\`]+)\``));
  if (tplMatch) {
    return tplMatch[1];
  }

  return null;
}

/**
 * Normalize a template literal route into a path pattern.
 * e.g. `/deals/${encodeURIComponent(dealId)}/update` -> `/deals/{dealId}/update`
 * e.g. `/events/recent${queryString}` -> `/events/recent`
 */
function normalizeTemplateRoute(route) {
  if (!route) {
    return null;
  }

  // Strip trailing query-string expressions. These may be:
  //  - Full: ${queryString}  ${qsStr ? `?${qsStr}` : ""}
  //  - Partial (due to nested backtick truncation): ${qsStr   ${queryString
  // We strip everything from the first occurrence of ${qsStr, ${queryString, or ${queryParams onwards.
  let normalized = route
    .replace(/\$\{qsStr\b.*$/, "")
    .replace(/\$\{queryString\b.*$/, "")
    .replace(/\$\{queryParams\b.*$/, "");

  // Now normalize path parameters
  normalized = normalized
    // ${encodeURIComponent(String(xxx))} -> {xxx}
    .replace(/\$\{encodeURIComponent\(String\(([^)]+)\)\)\}/g, "{$1}")
    // ${encodeURIComponent(xxx)} -> {xxx}
    .replace(/\$\{encodeURIComponent\(([^)]+)\)\}/g, "{$1}")
    // ${xxx} -> {xxx}  (remaining template expressions are path params)
    .replace(/\$\{([^}]+)\}/g, "{$1}");

  // Strip query strings (explicit ? in literals)
  normalized = normalized.split("?")[0];

  // Clean up any trailing empty braces
  normalized = normalized.replace(/\{\}$/, "");

  return normalized;
}

const gatewayMethods = extractGatewayMethods(indexSource);

// ─────────────────────────────────────────────────────────
// Normalize route patterns for comparison
// ─────────────────────────────────────────────────────────

/**
 * Replace all {param} segments with {*} for matching,
 * since gateway and contract may use different param names.
 */
function normalizeForComparison(route) {
  if (!route) {
    return null;
  }
  return route.replace(/\{[^}]+\}/g, "{*}");
}

function parseContractKey(key) {
  const spaceIdx = key.indexOf(" ");
  return { method: key.slice(0, spaceIdx), path: key.slice(spaceIdx + 1) };
}

// Build normalized contract lookup: "METHOD /path/{*}/..." -> original key
const normalizedContractPaths = new Map();
for (const key of contractRouteKeys) {
  const { method, path } = parseContractKey(key);
  const normalKey = `${method} ${normalizeForComparison(path)}`;
  normalizedContractPaths.set(normalKey, key);
}

// Build reverse: normalized route -> gateway method names
const routeToGateway = new Map();
for (const [name, info] of gatewayMethods) {
  if (!info.route) {
    continue;
  }
  const normalizedRoute = normalizeForComparison(info.route);
  const key = `${info.method} ${normalizedRoute}`;
  if (!routeToGateway.has(key)) {
    routeToGateway.set(key, []);
  }
  routeToGateway.get(key).push(name);
}

// ─────────────────────────────────────────────────────────
// Gateway methods that DON'T call sidecar routes (local ops)
// ─────────────────────────────────────────────────────────

const LOCAL_ONLY_METHODS = new Set([
  "ted.docs.read",
  "ted.gates.set",
  "ted.intake.recommend",
  "ted.jobcards.detail",
  "ted.policy.read",
  "ted.policy.preview_update",
  "ted.policy.update",
  "ted.workbench",
  "ted.onboarding.archetype_select",
  "ted.onboarding.voice_extract",
  "ted.onboarding.voice_extract_status",
]);

// ─────────────────────────────────────────────────────────
// Section 1: Gateway Method Discovery
// ─────────────────────────────────────────────────────────

describe("Gateway — discovery", () => {
  test("extracts gateway methods from index.ts", () => {
    expect(gatewayMethods.size).toBeGreaterThan(100);
  });

  test("method count in expected range (140-175)", () => {
    expect(gatewayMethods.size).toBeGreaterThanOrEqual(140);
    expect(gatewayMethods.size).toBeLessThanOrEqual(175);
  });

  test("all method names start with ted.", () => {
    for (const [name] of gatewayMethods) {
      expect(name.startsWith("ted.")).toBe(true);
    }
  });

  test("routes were actually extracted (not all null)", () => {
    const routed = Array.from(gatewayMethods.values()).filter((info) => info.route !== null);
    expect(routed.length).toBeGreaterThan(100);
  });
});

// ─────────────────────────────────────────────────────────
// Section 2: Gateway → Sidecar Route Coverage
// ─────────────────────────────────────────────────────────

describe("Gateway → Sidecar — every routed gateway method has a matching contract", () => {
  const routedMethods = Array.from(gatewayMethods.entries())
    .filter(([name, info]) => info.route !== null && !LOCAL_ONLY_METHODS.has(name))
    .map(([name, info]) => [name, info.method, info.route]);

  test("majority of gateway methods have sidecar routes", () => {
    expect(routedMethods.length).toBeGreaterThan(120);
  });

  test.each(routedMethods)("%s (%s %s) has matching route contract", (name, method, route) => {
    const normalized = normalizeForComparison(route);
    const lookupKey = `${method} ${normalized}`;
    const contractKey = normalizedContractPaths.get(lookupKey);
    expect(contractKey).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────
// Section 3: Critical routes have gateway methods
// ─────────────────────────────────────────────────────────

describe("Sidecar → Gateway — critical sidecar routes have gateway methods", () => {
  const criticalRoutes = [
    "GET /triage/list",
    "GET /deals/list",
    "GET /commitments/list",
    "GET /gtd/actions/list",
    "GET /gtd/waiting-for/list",
    "GET /drafts/queue",
    "GET /reporting/morning-brief",
    "GET /reporting/eod-digest",
    "GET /ops/scheduler",
    "GET /ops/builder-lane/status",
    "GET /ops/self-healing/status",
    "GET /ops/evaluation/status",
    "GET /events/stats",
    "GET /improvement/proposals",
    "GET /filing/suggestions/list",
    "GET /facility/alerts/list",
    "POST /triage/ingest",
    "POST /deals/create",
    "POST /commitments/create",
    "POST /gtd/actions/create",
  ];

  test.each(criticalRoutes)("%s has at least one gateway method", (routeKey) => {
    const { method, path } = parseContractKey(routeKey);
    const normalizedPath = normalizeForComparison(path);
    const lookupKey = `${method} ${normalizedPath}`;
    const gatewayNames = routeToGateway.get(lookupKey);
    expect(gatewayNames).toBeDefined();
    expect(gatewayNames.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────
// Section 4: HTTP Method Consistency
// ─────────────────────────────────────────────────────────

describe("Gateway — HTTP method consistency", () => {
  const routedMethods = Array.from(gatewayMethods.entries()).filter(
    ([, info]) => info.route !== null,
  );

  test("has GET gateway methods", () => {
    const getMethods = routedMethods.filter(([, info]) => info.method === "GET");
    expect(getMethods.length).toBeGreaterThan(30);
  });

  test("has POST gateway methods", () => {
    const postMethods = routedMethods.filter(([, info]) => info.method === "POST");
    expect(postMethods.length).toBeGreaterThan(40);
  });

  test("no PUT or PATCH methods (sidecar uses POST for all mutations)", () => {
    for (const [, info] of routedMethods) {
      if (info.method) {
        expect(["GET", "POST"]).toContain(info.method);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────
// Section 5: Namespace Coverage
// ─────────────────────────────────────────────────────────

describe("Gateway — namespace coverage", () => {
  const methodNames = Array.from(gatewayMethods.keys());

  const requiredNamespaces = [
    "ted.triage",
    "ted.deals",
    "ted.commitments",
    "ted.gtd",
    "ted.drafts",
    "ted.meeting",
    "ted.filing",
    "ted.improvement",
    "ted.reporting",
    "ted.governance",
    "ted.ops",
    "ted.builder_lane",
    "ted.self_healing",
    "ted.events",
    "ted.sharepoint",
    "ted.sync",
    "ted.planner",
    "ted.todo",
  ];

  test.each(requiredNamespaces)("has methods under %s namespace", (ns) => {
    const matching = methodNames.filter((m) => m.startsWith(ns));
    expect(matching.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────
// Section 6: Local-only methods documented
// ─────────────────────────────────────────────────────────

describe("Gateway — local-only methods", () => {
  test("local-only methods are a small minority", () => {
    const unrouted = Array.from(gatewayMethods.entries()).filter(([, info]) => info.route === null);
    // Local-only should be < 15% of total methods
    expect(unrouted.length / gatewayMethods.size).toBeLessThan(0.15);
  });
});
