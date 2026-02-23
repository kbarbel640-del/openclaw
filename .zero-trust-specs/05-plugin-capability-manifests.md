# Spec 05: Plugin Capability Manifests

## Agent Assignment: Agent 5 — "Sandbox Agent"

## Objective

Introduce a capability manifest system for plugins/extensions so that each plugin must **declare** what it needs (gateway methods, HTTP routes, config access, filesystem paths) and the gateway **enforces** those declarations at runtime. This converts the current "plugins are fully trusted in-process code" model into a "plugins declare capabilities, gateway verifies" model. Addresses **T-PERSIST-001** (Malicious Skill Installation, rated Critical).

---

## Threat Context

| Field              | Value                                                                    |
| ------------------ | ------------------------------------------------------------------------ |
| Threat ID          | T-PERSIST-001                                                            |
| ATLAS ID           | AML.T0010.001 (Supply Chain: AI Software)                                |
| Current risk       | Critical — no sandboxing, limited review                                 |
| Attack vector      | Malicious plugin published, installed, runs with full gateway privileges |
| Current mitigation | `plugins.allow` allowlist (optional), pattern-based moderation           |

---

## Scope of Changes

### Files to CREATE

| File                                      | Purpose                                            |
| ----------------------------------------- | -------------------------------------------------- |
| `src/plugins/capability-manifest.ts`      | Manifest schema, parsing, validation               |
| `src/plugins/capability-manifest.test.ts` | Unit tests                                         |
| `src/plugins/capability-enforcer.ts`      | Runtime capability enforcement (proxy/guard layer) |
| `src/plugins/capability-enforcer.test.ts` | Unit tests                                         |

### Files to MODIFY

| File                                 | Lines | What to change                                                                                        |
| ------------------------------------ | ----- | ----------------------------------------------------------------------------------------------------- |
| `src/plugins/loader.ts`              | 536   | Load and validate manifest during plugin load; reject plugins without manifest when enforcement is on |
| `src/gateway/server-plugins.ts`      | 49    | Wrap plugin gateway handlers with capability enforcer                                                 |
| `src/gateway/server/plugins-http.ts` | 61    | Wrap plugin HTTP handlers with capability enforcer                                                    |
| `src/config/types.gateway.ts`        | 337   | Add `PluginCapabilityConfig` type                                                                     |
| `src/security/audit.ts`              | 677   | Add audit checks for plugins without manifests, overly broad capabilities                             |

### Files to READ (do not modify)

| File                            | Why                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| `src/plugin-sdk/index.ts`       | ~405 lines — understand the full plugin SDK surface to define capability categories |
| `src/plugin-sdk/run-command.ts` | Understand `runPluginCommandWithTimeout` — needs capability gate                    |
| `src/plugin-sdk/file-lock.ts`   | Understand file operations plugins can do                                           |
| `src/gateway/method-scopes.ts`  | 204 lines — reuse scope model for plugin capabilities                               |
| `src/gateway/role-policy.ts`    | 24 lines — understand role model                                                    |

---

## Design

### Manifest Schema

Each plugin declares capabilities in its `package.json` under an `openclaw` key, or in a separate `openclaw-manifest.json` at the plugin root:

```typescript
type PluginCapabilityManifest = {
  manifestVersion: 1;
  pluginId: string; // must match plugin ID
  capabilities: PluginCapabilities;
  permissions?: PluginPermissions; // human-readable permission descriptions
};

type PluginCapabilities = {
  gatewayMethods?: PluginGatewayMethodCapability[];
  httpRoutes?: PluginHttpRouteCapability[];
  config?: PluginConfigCapability;
  filesystem?: PluginFilesystemCapability;
  network?: PluginNetworkCapability;
  runtime?: PluginRuntimeCapability;
  channels?: PluginChannelCapability;
};

type PluginGatewayMethodCapability = {
  method: string; // exact method name or glob, e.g. "msteams.*"
  description: string;
};

type PluginHttpRouteCapability = {
  path: string; // route path pattern, e.g. "/api/channels/msteams/*"
  methods: ("GET" | "POST" | "PUT" | "DELETE" | "PATCH")[];
  auth?: "gateway" | "plugin" | "none"; // who handles auth for this route
  description: string;
};

type PluginConfigCapability = {
  reads?: string[]; // config key paths the plugin reads, e.g. ["channels.msteams"]
  writes?: string[]; // config key paths the plugin writes (rare, should be empty for most)
};

type PluginFilesystemCapability = {
  stateDir?: boolean; // needs access to plugin state dir (~/.openclaw/extensions/<id>/)
  credentialsDir?: boolean; // needs access to credentials dir
  tempDir?: boolean; // needs temp file access
  customPaths?: string[]; // additional paths (must be under stateDir)
};

type PluginNetworkCapability = {
  outbound?: boolean; // makes outbound HTTP/WS requests
  webhookInbound?: boolean; // receives inbound webhooks
  ports?: number[]; // binds to specific ports (rare)
};

type PluginRuntimeCapability = {
  runCommands?: boolean; // uses runPluginCommandWithTimeout
  spawnProcesses?: boolean; // spawns child processes
  timers?: boolean; // uses setInterval/setTimeout for long-running tasks
};

type PluginChannelCapability = {
  channelIds: string[]; // channel IDs this plugin provides, e.g. ["msteams"]
  inbound?: boolean; // handles inbound messages
  outbound?: boolean; // sends outbound messages
};

type PluginPermissions = {
  summary: string; // one-line summary shown during install
  details?: string[]; // detailed permission descriptions
};
```

### Example manifest (`extensions/msteams/openclaw-manifest.json`)

```json
{
  "manifestVersion": 1,
  "pluginId": "msteams",
  "capabilities": {
    "gatewayMethods": [
      { "method": "msteams.*", "description": "Microsoft Teams channel operations" }
    ],
    "httpRoutes": [
      {
        "path": "/api/channels/msteams/*",
        "methods": ["GET", "POST"],
        "auth": "gateway",
        "description": "Teams webhook and API endpoints"
      }
    ],
    "config": {
      "reads": ["channels.msteams"],
      "writes": []
    },
    "filesystem": {
      "stateDir": true,
      "credentialsDir": true
    },
    "network": {
      "outbound": true,
      "webhookInbound": true
    },
    "runtime": {
      "runCommands": false,
      "spawnProcesses": false,
      "timers": true
    },
    "channels": {
      "channelIds": ["msteams"],
      "inbound": true,
      "outbound": true
    }
  },
  "permissions": {
    "summary": "Microsoft Teams channel integration (inbound + outbound messaging)",
    "details": [
      "Register gateway methods for Teams operations",
      "Receive webhook callbacks from Microsoft Teams",
      "Read Teams channel configuration",
      "Store Teams credentials and state"
    ]
  }
}
```

### Capability Enforcer (`src/plugins/capability-enforcer.ts`)

```typescript
export type CapabilityEnforcerOptions = {
  manifest: PluginCapabilityManifest;
  mode: "enforce" | "warn" | "off"; // enforce=block, warn=log, off=skip
  logger: { warn: (msg: string) => void; error: (msg: string) => void };
};

export type CapabilityViolation = {
  pluginId: string;
  capability: string;
  attempted: string;
  message: string;
};

export function createCapabilityEnforcer(options: CapabilityEnforcerOptions): CapabilityEnforcer;

export interface CapabilityEnforcer {
  // Check if a gateway method call is allowed
  checkGatewayMethod(method: string): { allowed: boolean; violation?: CapabilityViolation };

  // Check if an HTTP route is allowed
  checkHttpRoute(
    path: string,
    httpMethod: string,
  ): { allowed: boolean; violation?: CapabilityViolation };

  // Check if a config key access is allowed
  checkConfigAccess(
    keyPath: string,
    mode: "read" | "write",
  ): { allowed: boolean; violation?: CapabilityViolation };

  // Check if a filesystem path access is allowed
  checkFilesystemAccess(absolutePath: string): {
    allowed: boolean;
    violation?: CapabilityViolation;
  };

  // Check if a runtime capability is allowed
  checkRuntimeCapability(capability: keyof PluginRuntimeCapability): {
    allowed: boolean;
    violation?: CapabilityViolation;
  };

  // Get all violations recorded (for audit)
  getViolations(): CapabilityViolation[];
}

// Wrap a gateway handler with capability enforcement
export function wrapGatewayHandlerWithEnforcer(
  handler: GatewayRequestHandler,
  enforcer: CapabilityEnforcer,
  methodName: string,
): GatewayRequestHandler;

// Wrap an HTTP handler with capability enforcement
export function wrapHttpHandlerWithEnforcer(
  handler: PluginHttpRequestHandler,
  enforcer: CapabilityEnforcer,
  routePath: string,
): PluginHttpRequestHandler;
```

### Loader integration

In `src/plugins/loader.ts`, within `loadOpenClawPlugins`:

```typescript
// After loading plugin module, before registering handlers:

// 1. Load manifest
const manifest = loadPluginManifest(pluginDir, pluginId);

// 2. Validate manifest
if (manifest) {
  validatePluginManifest(manifest, pluginId);
} else if (enforcementMode === "enforce") {
  throw new Error(
    `Plugin ${pluginId} has no capability manifest. Required when enforcement is "enforce".`,
  );
} else if (enforcementMode === "warn") {
  logger.warn(`Plugin ${pluginId} has no capability manifest. Running without capability checks.`);
}

// 3. Create enforcer
const enforcer = manifest
  ? createCapabilityEnforcer({ manifest, mode: enforcementMode, logger })
  : null;

// 4. Store enforcer alongside plugin registry entry
pluginRecord.enforcer = enforcer;
```

### Config schema addition

```typescript
type PluginCapabilityConfig = {
  enforcement?: "enforce" | "warn" | "off"; // default: "warn"
  requireManifest?: boolean; // default: false (true in future major version)
  allowUnmanifested?: string[]; // plugin IDs allowed to run without manifest
};
```

### Enforcement Modes

| Mode      | Behavior                                  | When to use                      |
| --------- | ----------------------------------------- | -------------------------------- |
| `off`     | No capability checking (current behavior) | Backward compat, development     |
| `warn`    | Log violations but don't block            | Migration period, default for v1 |
| `enforce` | Block violations, return error to caller  | Production hardening             |

---

## Integration Points with Other Specs

| Spec                  | Integration                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| 01 (Vault)            | Plugins with `filesystem.credentialsDir: true` can access credentials (vault decrypts transparently) |
| 02 (Scoped Tokens)    | Plugin gateway method calls go through the same scope check as scoped tokens                         |
| 03 (Rate Limiting)    | Plugin inbound messages go through the same rate limiter                                             |
| 04 (Config Integrity) | Manifest changes trigger config integrity hash update                                                |

---

## Security Audit Integration

| checkId                                | Severity | Condition                                                               |
| -------------------------------------- | -------- | ----------------------------------------------------------------------- |
| `plugins.no_manifest`                  | warn     | Plugin loaded without capability manifest                               |
| `plugins.enforcement_off`              | warn     | Capability enforcement disabled                                         |
| `plugins.broad_capabilities`           | info     | Plugin declares very broad capabilities (e.g., `gatewayMethods: ["*"]`) |
| `plugins.runtime_commands`             | warn     | Plugin declares `runCommands: true` or `spawnProcesses: true`           |
| `plugins.capability_violations`        | critical | Capability violations recorded in current session                       |
| `plugins.network_outbound_no_manifest` | warn     | Plugin makes outbound requests without declaring network capability     |

---

## Migration Path for Existing Plugins

1. **Phase 1 (this PR)**: `enforcement: "warn"` (default). Plugins without manifests work fine, violations logged.
2. **Phase 2 (future PR)**: Add manifests to all built-in extensions (`extensions/*`). Change default to `enforcement: "enforce"` for plugins with manifests, `"warn"` for those without.
3. **Phase 3 (future major version)**: `requireManifest: true` by default. Plugins without manifests are rejected.

For this PR, add manifests to **2-3 existing extensions** as examples:

- `extensions/msteams/openclaw-manifest.json`
- `extensions/matrix/openclaw-manifest.json`
- `extensions/voice-call/openclaw-manifest.json` (if it exists)

---

## Test Plan

### Unit tests (`src/plugins/capability-manifest.test.ts`)

1. **Valid manifest**: parse and validate successfully
2. **Missing required fields**: validation fails with clear error
3. **Invalid method glob**: validation fails
4. **Version mismatch**: wrong `manifestVersion` → rejected

### Enforcer tests (`src/plugins/capability-enforcer.test.ts`)

5. **Gateway method allowed**: declared method → `allowed: true`
6. **Gateway method blocked**: undeclared method → `allowed: false` with violation
7. **HTTP route allowed**: matching path + method → `allowed: true`
8. **HTTP route wrong method**: matching path, wrong HTTP method → `allowed: false`
9. **Config read allowed**: declared read path → `allowed: true`
10. **Config write blocked**: undeclared write path → `allowed: false`
11. **Filesystem in stateDir**: path under extension dir → `allowed: true`
12. **Filesystem outside stateDir**: path outside extension dir → `allowed: false`
13. **Runtime command blocked**: `runCommands: false` but command attempted → `allowed: false`
14. **Glob matching**: `msteams.*` matches `msteams.send`, doesn't match `slack.send`
15. **Enforce mode**: violation → handler call blocked
16. **Warn mode**: violation → handler call proceeds, violation logged
17. **Off mode**: no checking at all

### Integration tests

18. **Plugin load with manifest**: loads successfully, enforcer created
19. **Plugin load without manifest (warn mode)**: loads with warning
20. **Plugin load without manifest (enforce mode)**: load fails
21. **Gateway method call through enforcer**: allowed method succeeds, blocked method returns error
22. **HTTP route through enforcer**: allowed route succeeds, blocked route returns 403

---

## Dependencies

- No new npm dependencies (uses built-in JSON schema validation patterns already in codebase)
- Glob matching: use `minimatch` or simple prefix/suffix matching (minimatch is already in the dependency tree via other packages — verify before adding)

---

## Acceptance Criteria

- [ ] `PluginCapabilityManifest` schema defined and documented
- [ ] Manifests loaded and validated during plugin load
- [ ] Capability enforcer wraps gateway handlers and HTTP handlers
- [ ] Three enforcement modes: `off`, `warn`, `enforce`
- [ ] Default mode is `warn` (backward compatible)
- [ ] 2-3 existing extensions have example manifests
- [ ] `openclaw security audit` reports plugins without manifests and capability violations
- [ ] Violations logged with plugin ID, capability, and attempted action
- [ ] No new npm dependencies (or verify existing transitive dep)
- [ ] All tests pass
- [ ] Zero breaking changes — existing plugins work in `warn` and `off` modes
