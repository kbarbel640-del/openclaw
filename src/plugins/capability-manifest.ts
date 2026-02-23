import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Manifest types
// ---------------------------------------------------------------------------

export type PluginCapabilityManifest = {
  manifestVersion: 1;
  pluginId: string;
  capabilities: PluginCapabilities;
  permissions?: PluginPermissions;
};

export type PluginCapabilities = {
  gatewayMethods?: PluginGatewayMethodCapability[];
  httpRoutes?: PluginHttpRouteCapability[];
  config?: PluginConfigCapability;
  filesystem?: PluginFilesystemCapability;
  network?: PluginNetworkCapability;
  runtime?: PluginRuntimeCapability;
  channels?: PluginChannelCapability;
};

export type PluginGatewayMethodCapability = {
  method: string;
  description: string;
};

export type PluginHttpRouteCapability = {
  path: string;
  methods: HttpMethod[];
  auth?: "gateway" | "plugin" | "none";
  description: string;
};

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export type PluginConfigCapability = {
  reads?: string[];
  writes?: string[];
};

export type PluginFilesystemCapability = {
  stateDir?: boolean;
  credentialsDir?: boolean;
  tempDir?: boolean;
  customPaths?: string[];
};

export type PluginNetworkCapability = {
  outbound?: boolean;
  webhookInbound?: boolean;
  ports?: number[];
};

export type PluginRuntimeCapability = {
  runCommands?: boolean;
  spawnProcesses?: boolean;
  timers?: boolean;
};

export type PluginChannelCapability = {
  channelIds: string[];
  inbound?: boolean;
  outbound?: boolean;
};

export type PluginPermissions = {
  summary: string;
  details?: string[];
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ManifestValidationResult =
  | { ok: true; manifest: PluginCapabilityManifest }
  | { ok: false; errors: string[] };

const VALID_HTTP_METHODS = new Set<string>(["GET", "POST", "PUT", "DELETE", "PATCH"]);
const VALID_AUTH_VALUES = new Set<string>(["gateway", "plugin", "none"]);

/**
 * Validate a parsed manifest object. Returns a typed result with the manifest
 * or an array of human-readable error strings.
 */
export function validateCapabilityManifest(
  raw: unknown,
  expectedPluginId: string,
): ManifestValidationResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["manifest must be a JSON object"] };
  }

  const obj = raw as Record<string, unknown>;

  if (obj.manifestVersion !== 1) {
    errors.push(`manifestVersion must be 1, got ${JSON.stringify(obj.manifestVersion)}`);
  }

  if (typeof obj.pluginId !== "string" || !obj.pluginId.trim()) {
    errors.push("pluginId is required and must be a non-empty string");
  } else if (obj.pluginId !== expectedPluginId) {
    errors.push(
      `pluginId "${obj.pluginId}" does not match expected plugin id "${expectedPluginId}"`,
    );
  }

  if (
    !obj.capabilities ||
    typeof obj.capabilities !== "object" ||
    Array.isArray(obj.capabilities)
  ) {
    errors.push("capabilities is required and must be an object");
  } else {
    const caps = obj.capabilities as Record<string, unknown>;
    validateGatewayMethods(caps.gatewayMethods, errors);
    validateHttpRoutes(caps.httpRoutes, errors);
    validateConfigCapability(caps.config, errors);
    validateFilesystemCapability(caps.filesystem, errors);
    validateNetworkCapability(caps.network, errors);
    validateRuntimeCapability(caps.runtime, errors);
    validateChannelCapability(caps.channels, errors);
  }

  if (obj.permissions !== undefined) {
    validatePermissions(obj.permissions, errors);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, manifest: raw as PluginCapabilityManifest };
}

function validateGatewayMethods(value: unknown, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    errors.push("capabilities.gatewayMethods must be an array");
    return;
  }
  for (let i = 0; i < value.length; i++) {
    const entry = value[i];
    if (!entry || typeof entry !== "object") {
      errors.push(`capabilities.gatewayMethods[${i}] must be an object`);
      continue;
    }
    const e = entry as Record<string, unknown>;
    if (typeof e.method !== "string" || !e.method.trim()) {
      errors.push(`capabilities.gatewayMethods[${i}].method is required`);
    } else if (!isValidMethodGlob(e.method)) {
      errors.push(
        `capabilities.gatewayMethods[${i}].method "${e.method}" is not a valid method glob`,
      );
    }
    if (typeof e.description !== "string") {
      errors.push(`capabilities.gatewayMethods[${i}].description is required`);
    }
  }
}

function validateHttpRoutes(value: unknown, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    errors.push("capabilities.httpRoutes must be an array");
    return;
  }
  for (let i = 0; i < value.length; i++) {
    const entry = value[i];
    if (!entry || typeof entry !== "object") {
      errors.push(`capabilities.httpRoutes[${i}] must be an object`);
      continue;
    }
    const e = entry as Record<string, unknown>;
    if (typeof e.path !== "string" || !e.path.trim()) {
      errors.push(`capabilities.httpRoutes[${i}].path is required`);
    }
    if (!Array.isArray(e.methods) || e.methods.length === 0) {
      errors.push(`capabilities.httpRoutes[${i}].methods must be a non-empty array`);
    } else {
      for (const m of e.methods) {
        if (!VALID_HTTP_METHODS.has(m as string)) {
          errors.push(`capabilities.httpRoutes[${i}].methods contains invalid method "${m}"`);
        }
      }
    }
    if (e.auth !== undefined && !VALID_AUTH_VALUES.has(e.auth as string)) {
      errors.push(`capabilities.httpRoutes[${i}].auth must be "gateway", "plugin", or "none"`);
    }
    if (typeof e.description !== "string") {
      errors.push(`capabilities.httpRoutes[${i}].description is required`);
    }
  }
}

function validateConfigCapability(value: unknown, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push("capabilities.config must be an object");
    return;
  }
  const c = value as Record<string, unknown>;
  if (c.reads !== undefined && !isStringArray(c.reads)) {
    errors.push("capabilities.config.reads must be a string array");
  }
  if (c.writes !== undefined && !isStringArray(c.writes)) {
    errors.push("capabilities.config.writes must be a string array");
  }
}

function validateFilesystemCapability(value: unknown, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push("capabilities.filesystem must be an object");
    return;
  }
  const f = value as Record<string, unknown>;
  if (f.stateDir !== undefined && typeof f.stateDir !== "boolean") {
    errors.push("capabilities.filesystem.stateDir must be a boolean");
  }
  if (f.credentialsDir !== undefined && typeof f.credentialsDir !== "boolean") {
    errors.push("capabilities.filesystem.credentialsDir must be a boolean");
  }
  if (f.tempDir !== undefined && typeof f.tempDir !== "boolean") {
    errors.push("capabilities.filesystem.tempDir must be a boolean");
  }
  if (f.customPaths !== undefined && !isStringArray(f.customPaths)) {
    errors.push("capabilities.filesystem.customPaths must be a string array");
  }
}

function validateNetworkCapability(value: unknown, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push("capabilities.network must be an object");
    return;
  }
  const n = value as Record<string, unknown>;
  if (n.outbound !== undefined && typeof n.outbound !== "boolean") {
    errors.push("capabilities.network.outbound must be a boolean");
  }
  if (n.webhookInbound !== undefined && typeof n.webhookInbound !== "boolean") {
    errors.push("capabilities.network.webhookInbound must be a boolean");
  }
  if (n.ports !== undefined) {
    if (!Array.isArray(n.ports) || n.ports.some((p) => typeof p !== "number")) {
      errors.push("capabilities.network.ports must be a number array");
    }
  }
}

function validateRuntimeCapability(value: unknown, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push("capabilities.runtime must be an object");
    return;
  }
  const r = value as Record<string, unknown>;
  for (const key of ["runCommands", "spawnProcesses", "timers"] as const) {
    if (r[key] !== undefined && typeof r[key] !== "boolean") {
      errors.push(`capabilities.runtime.${key} must be a boolean`);
    }
  }
}

function validateChannelCapability(value: unknown, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push("capabilities.channels must be an object");
    return;
  }
  const ch = value as Record<string, unknown>;
  if (!Array.isArray(ch.channelIds) || !ch.channelIds.every((id) => typeof id === "string")) {
    errors.push("capabilities.channels.channelIds must be a string array");
  }
  if (ch.inbound !== undefined && typeof ch.inbound !== "boolean") {
    errors.push("capabilities.channels.inbound must be a boolean");
  }
  if (ch.outbound !== undefined && typeof ch.outbound !== "boolean") {
    errors.push("capabilities.channels.outbound must be a boolean");
  }
}

function validatePermissions(value: unknown, errors: string[]): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push("permissions must be an object");
    return;
  }
  const p = value as Record<string, unknown>;
  if (typeof p.summary !== "string" || !p.summary.trim()) {
    errors.push("permissions.summary is required");
  }
  if (p.details !== undefined && !isStringArray(p.details)) {
    errors.push("permissions.details must be a string array");
  }
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * Load a capability manifest from the plugin directory. Checks both
 * `openclaw-manifest.json` as a standalone file and the `openclaw.capabilityManifest`
 * key in `package.json`.
 */
export function loadCapabilityManifest(
  pluginDir: string,
  pluginId: string,
): PluginCapabilityManifest | null {
  // Standalone file takes precedence
  const standaloneManifest = path.join(pluginDir, "openclaw-manifest.json");
  if (fs.existsSync(standaloneManifest)) {
    try {
      const raw = JSON.parse(fs.readFileSync(standaloneManifest, "utf-8"));
      const result = validateCapabilityManifest(raw, pluginId);
      if (!result.ok) {
        throw new Error(`Invalid capability manifest: ${result.errors.join("; ")}`);
      }
      return result.manifest;
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error(`Failed to parse ${standaloneManifest}: ${err.message}`, { cause: err });
      }
      throw err;
    }
  }

  // Fallback: check package.json openclaw.capabilityManifest
  const pkgJsonPath = path.join(pluginDir, "package.json");
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
      const embedded = pkg?.openclaw?.capabilityManifest;
      if (embedded && typeof embedded === "object") {
        const result = validateCapabilityManifest(embedded, pluginId);
        if (!result.ok) {
          throw new Error(
            `Invalid capability manifest in package.json: ${result.errors.join("; ")}`,
          );
        }
        return result.manifest;
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        return null;
      }
      throw err;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Glob helpers
// ---------------------------------------------------------------------------

/**
 * Validate that a method pattern is a valid glob: either an exact name
 * (alphanumeric + dots + hyphens), a wildcard `*`, or a prefix glob like `msteams.*`.
 */
export function isValidMethodGlob(pattern: string): boolean {
  const trimmed = pattern.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed === "*") {
    return true;
  }
  // Allow patterns like "msteams.*" or "voicecall.*" (prefix + dot + star)
  if (trimmed.endsWith(".*")) {
    const prefix = trimmed.slice(0, -2);
    return /^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*$/.test(prefix);
  }
  // Exact method name
  return /^[a-zA-Z0-9_.-]+$/.test(trimmed);
}

/**
 * Match a concrete method name against a glob pattern.
 * Supports: exact match, `*` (matches everything), `prefix.*` (matches prefix.anything).
 */
export function matchMethodGlob(pattern: string, method: string): boolean {
  if (pattern === "*") {
    return true;
  }
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -1);
    return method.startsWith(prefix);
  }
  return pattern === method;
}

/**
 * Match an HTTP route path against a declared pattern.
 * Supports trailing wildcard: `/api/channels/msteams/*` matches `/api/channels/msteams/webhook`.
 */
export function matchRoutePath(pattern: string, actualPath: string): boolean {
  if (pattern === actualPath) {
    return true;
  }
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -1);
    return actualPath.startsWith(prefix) || actualPath === prefix.slice(0, -1);
  }
  return false;
}

/**
 * Check if a manifest declares overly broad capabilities (wildcard gateway methods).
 */
export function hasBroadCapabilities(manifest: PluginCapabilityManifest): boolean {
  const methods = manifest.capabilities.gatewayMethods;
  if (!methods) {
    return false;
  }
  return methods.some((m) => m.method === "*");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
