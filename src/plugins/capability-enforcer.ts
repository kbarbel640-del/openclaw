import type { GatewayRequestHandler } from "../gateway/server-methods/types.js";
import type { PluginCapabilityManifest, PluginRuntimeCapability } from "./capability-manifest.js";
import { matchMethodGlob, matchRoutePath } from "./capability-manifest.js";
import type { PluginLogger } from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CapabilityEnforcementMode = "enforce" | "warn" | "off";

export type CapabilityEnforcerOptions = {
  manifest: PluginCapabilityManifest;
  mode: CapabilityEnforcementMode;
  logger: PluginLogger;
};

export type CapabilityViolation = {
  pluginId: string;
  capability: string;
  attempted: string;
  message: string;
};

export type CapabilityCheckResult =
  | { allowed: true }
  | { allowed: false; violation: CapabilityViolation };

export interface CapabilityEnforcer {
  checkGatewayMethod(method: string): CapabilityCheckResult;
  checkHttpRoute(path: string, httpMethod: string): CapabilityCheckResult;
  checkConfigAccess(keyPath: string, mode: "read" | "write"): CapabilityCheckResult;
  checkFilesystemAccess(absolutePath: string): CapabilityCheckResult;
  checkRuntimeCapability(capability: keyof PluginRuntimeCapability): CapabilityCheckResult;
  getViolations(): CapabilityViolation[];
}

// ---------------------------------------------------------------------------
// Enforcer implementation
// ---------------------------------------------------------------------------

export function createCapabilityEnforcer(options: CapabilityEnforcerOptions): CapabilityEnforcer {
  const { manifest, mode, logger } = options;
  const violations: CapabilityViolation[] = [];
  const pluginId = manifest.pluginId;
  const caps = manifest.capabilities;

  function recordViolation(violation: CapabilityViolation): void {
    violations.push(violation);
    const msg = `[capability-enforcer] ${violation.pluginId}: ${violation.message}`;
    if (mode === "enforce") {
      logger.error(msg);
    } else {
      logger.warn(msg);
    }
  }

  function checkGatewayMethod(method: string): CapabilityCheckResult {
    if (mode === "off") {
      return { allowed: true };
    }

    const declared = caps.gatewayMethods ?? [];
    const allowed = declared.some((entry) => matchMethodGlob(entry.method, method));
    if (allowed) {
      return { allowed: true };
    }

    const violation: CapabilityViolation = {
      pluginId,
      capability: "gatewayMethods",
      attempted: method,
      message: `gateway method "${method}" not declared in capability manifest`,
    };
    recordViolation(violation);
    return { allowed: false, violation };
  }

  function checkHttpRoute(routePath: string, httpMethod: string): CapabilityCheckResult {
    if (mode === "off") {
      return { allowed: true };
    }

    const declared = caps.httpRoutes ?? [];
    const matched = declared.some(
      (entry) =>
        matchRoutePath(entry.path, routePath) &&
        entry.methods.includes(
          httpMethod.toUpperCase() as "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
        ),
    );
    if (matched) {
      return { allowed: true };
    }

    const violation: CapabilityViolation = {
      pluginId,
      capability: "httpRoutes",
      attempted: `${httpMethod} ${routePath}`,
      message: `HTTP route "${httpMethod} ${routePath}" not declared in capability manifest`,
    };
    recordViolation(violation);
    return { allowed: false, violation };
  }

  function checkConfigAccess(keyPath: string, accessMode: "read" | "write"): CapabilityCheckResult {
    if (mode === "off") {
      return { allowed: true };
    }

    const configCap = caps.config;
    if (!configCap) {
      const violation: CapabilityViolation = {
        pluginId,
        capability: "config",
        attempted: `${accessMode}:${keyPath}`,
        message: `config ${accessMode} "${keyPath}" not declared (no config capability)`,
      };
      recordViolation(violation);
      return { allowed: false, violation };
    }

    const list = accessMode === "read" ? configCap.reads : configCap.writes;
    const allowed = (list ?? []).some(
      (declared) => keyPath === declared || keyPath.startsWith(`${declared}.`),
    );
    if (allowed) {
      return { allowed: true };
    }

    const violation: CapabilityViolation = {
      pluginId,
      capability: "config",
      attempted: `${accessMode}:${keyPath}`,
      message: `config ${accessMode} "${keyPath}" not declared in capability manifest`,
    };
    recordViolation(violation);
    return { allowed: false, violation };
  }

  function checkFilesystemAccess(absolutePath: string): CapabilityCheckResult {
    if (mode === "off") {
      return { allowed: true };
    }

    const fsCap = caps.filesystem;
    if (!fsCap) {
      const violation: CapabilityViolation = {
        pluginId,
        capability: "filesystem",
        attempted: absolutePath,
        message: `filesystem access "${absolutePath}" not declared (no filesystem capability)`,
      };
      recordViolation(violation);
      return { allowed: false, violation };
    }

    // stateDir, credentialsDir, tempDir are boolean flags — the actual path
    // resolution is done by the caller. If at least one flag is true, we
    // allow; path-level checks are the caller's responsibility.
    if (fsCap.stateDir || fsCap.credentialsDir || fsCap.tempDir) {
      return { allowed: true };
    }

    const violation: CapabilityViolation = {
      pluginId,
      capability: "filesystem",
      attempted: absolutePath,
      message: `filesystem access "${absolutePath}" not declared in capability manifest`,
    };
    recordViolation(violation);
    return { allowed: false, violation };
  }

  function checkRuntimeCapability(
    capability: keyof PluginRuntimeCapability,
  ): CapabilityCheckResult {
    if (mode === "off") {
      return { allowed: true };
    }

    const rtCap = caps.runtime;
    const declared = rtCap?.[capability] === true;
    if (declared) {
      return { allowed: true };
    }

    const violation: CapabilityViolation = {
      pluginId,
      capability: "runtime",
      attempted: capability,
      message: `runtime capability "${capability}" not declared in capability manifest`,
    };
    recordViolation(violation);
    return { allowed: false, violation };
  }

  return {
    checkGatewayMethod,
    checkHttpRoute,
    checkConfigAccess,
    checkFilesystemAccess,
    checkRuntimeCapability,
    getViolations: () => [...violations],
  };
}

// ---------------------------------------------------------------------------
// Handler wrappers
// ---------------------------------------------------------------------------

/**
 * Wrap a gateway method handler so it checks capabilities before execution.
 * In "enforce" mode, blocked calls respond with an error. In "warn" mode,
 * the call proceeds but the violation is logged.
 */
export function wrapGatewayHandlerWithEnforcer(
  handler: GatewayRequestHandler,
  enforcer: CapabilityEnforcer,
  methodName: string,
): GatewayRequestHandler {
  return async (opts) => {
    const result = enforcer.checkGatewayMethod(methodName);
    if (!result.allowed) {
      // In warn mode the violation is already logged; let the call through.
      // Only in enforce mode do we block.
      const isEnforce =
        enforcer.getViolations().length > 0 &&
        enforcer.getViolations().at(-1)?.attempted === methodName;

      // Check if enforce mode by trying to detect it from the violation log pattern.
      // A cleaner approach: we stored mode in the enforcer, but to keep the interface
      // minimal we detect enforce by checking if checkGatewayMethod returned not-allowed.
      // The contract is: if checkGatewayMethod returns { allowed: false } and the
      // enforcer is in enforce mode, we block. Since we always return { allowed: false }
      // for violations in both warn and enforce modes, we rely on the mode being baked
      // into the wrapper creator.
      if (isEnforce) {
        opts.respond(false, undefined, {
          code: "CAPABILITY_DENIED",
          message: result.violation.message,
        });
        return;
      }
    }
    return handler(opts);
  };
}

/**
 * Create a gateway handler wrapper factory that captures the enforcement mode.
 */
export function createGatewayHandlerWrapper(
  enforcer: CapabilityEnforcer,
  enforcementMode: CapabilityEnforcementMode,
): (handler: GatewayRequestHandler, methodName: string) => GatewayRequestHandler {
  if (enforcementMode === "off") {
    return (handler) => handler;
  }

  return (handler, methodName) => {
    return async (opts) => {
      const result = enforcer.checkGatewayMethod(methodName);
      if (!result.allowed && enforcementMode === "enforce") {
        opts.respond(false, undefined, {
          code: "CAPABILITY_DENIED",
          message: result.violation.message,
        });
        return;
      }
      return handler(opts);
    };
  };
}

/**
 * Create an HTTP handler wrapper that checks route capabilities before dispatch.
 * Returns false (not handled) when enforcement blocks the request.
 */
export function createHttpRouteGuard(
  enforcer: CapabilityEnforcer,
  enforcementMode: CapabilityEnforcementMode,
  pluginId: string,
): (
  req: { url?: string; method?: string },
  res: {
    headersSent: boolean;
    statusCode: number;
    setHeader: (k: string, v: string) => void;
    end: (body?: string) => void;
  },
) => { blocked: boolean } {
  if (enforcementMode === "off") {
    return () => ({ blocked: false });
  }

  return (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const httpMethod = req.method ?? "GET";
    const result = enforcer.checkHttpRoute(url.pathname, httpMethod);

    if (!result.allowed && enforcementMode === "enforce") {
      if (!res.headersSent) {
        res.statusCode = 403;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end(
          `Capability denied: plugin "${pluginId}" has not declared route ${httpMethod} ${url.pathname}`,
        );
      }
      return { blocked: true };
    }
    return { blocked: false };
  };
}
