# OpenClaw-MABOS Plugin System and Extension Architecture

**Technical Reference Document**
**Version:** 1.0
**Date:** 2026-02-24
**Status:** Definitive Reference
**Audience:** Core developers, extension authors, system architects
**Scope:** Complete plugin/extension infrastructure — discovery, loading, registration, hooks, tools, services, HTTP routes, channels, slots, security, and extension patterns

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Plugin Definition Contract](#3-plugin-definition-contract)
4. [Discovery System](#4-discovery-system)
5. [Manifest System](#5-manifest-system)
6. [Loading Pipeline](#6-loading-pipeline)
7. [Plugin Registry](#7-plugin-registry)
8. [Plugin API (OpenClawPluginApi)](#8-plugin-api-openclawpluginapi)
9. [Plugin Runtime](#9-plugin-runtime)
10. [Tool Registration](#10-tool-registration)
11. [Hook System](#11-hook-system)
12. [Service Lifecycle](#12-service-lifecycle)
13. [HTTP Route Registration](#13-http-route-registration)
14. [Channel Registration](#14-channel-registration)
15. [Provider Registration](#15-provider-registration)
16. [Slash Command System](#16-slash-command-system)
17. [Exclusive Slot System](#17-exclusive-slot-system)
18. [Security Architecture](#18-security-architecture)
19. [Bundled Extensions Catalog](#19-bundled-extensions-catalog)
20. [Extension Development Guide](#20-extension-development-guide)
21. [MABOS as Reference Implementation](#21-mabos-as-reference-implementation)
22. [File Inventory](#22-file-inventory)
23. [Data Flow Diagrams](#23-data-flow-diagrams)
24. [Configuration](#24-configuration)
25. [Diagnostics and Troubleshooting](#25-diagnostics-and-troubleshooting)
26. [References to Companion Documents](#26-references-to-companion-documents)

---

## 1. Executive Summary

The OpenClaw-MABOS plugin system is a modular, security-first extension architecture that enables the platform to be extended with tools, hooks, channels, services, HTTP routes, authentication providers, slash commands, and exclusive slot-based subsystems. It is the foundational abstraction through which all non-core functionality is delivered — including all 25+ messaging channel integrations, both memory backends, the full MABOS cognitive system, voice capabilities, and authentication adapters.

### Design Philosophy

The plugin system is built around five core principles:

1. **TypeScript-native development** — Plugins are authored in TypeScript and loaded at runtime via `jiti` without requiring a pre-compilation step. This eliminates build toolchain friction and enables rapid iteration.

2. **Registration-based composition** — Plugins do not subclass or inherit from framework classes. Instead, they receive an `OpenClawPluginApi` object and call registration methods (`registerTool`, `registerHook`, `registerChannel`, etc.) to declaratively compose their capabilities into the host system.

3. **Security by default** — The discovery and installation pipeline enforces path containment checks, symlink escape detection, world-writable path blocking, suspicious UID ownership detection, and install-time security scanning. Untrusted code cannot silently infiltrate the plugin graph.

4. **Deterministic lifecycle** — Plugins proceed through a well-defined lifecycle: discovery, manifest validation, enable-state resolution, config schema validation, module loading, registration, and runtime execution. Services start sequentially and stop in reverse order for clean teardown.

5. **Exclusive slot arbitration** — For subsystems where exactly one implementation must be active (e.g., memory backends), the slot system ensures mutual exclusion with deterministic selection and clear diagnostics.

### Scale

The system manages 80 TypeScript source files across the `src/plugins/` directory, supports 41 bundled extensions, and exposes 24 lifecycle hooks. The flagship MABOS extension alone registers 99 tools across 21 modules, demonstrating that the architecture scales to complex, deeply-integrated extensions.

---

## 2. Architecture Overview

### High-Level Lifecycle

The plugin system operates as a pipeline with four major phases:

```
 PHASE 1: DISCOVERY          PHASE 2: LOADING           PHASE 3: REGISTRATION       PHASE 4: RUNTIME
 ==================          ================           =====================       ================

 +----------------+          +----------------+         +-------------------+        +----------------+
 | Config paths   |          | Resolve enable |         | register(api) or  |        | Hook execution |
 | (.loadPaths)   |---+      | state per      |         | activate(api)     |        | Tool calls     |
 +----------------+   |      | origin         |         | called by loader  |        | Service loop   |
                      |      +-------+--------+         +--------+----------+        | HTTP serving   |
 +----------------+   |              |                            |                   | Channel I/O    |
 | Workspace dir  |   |      +-------v--------+         +--------v----------+        +----------------+
 | .openclaw/     |---+----->| Validate config|-------->| Plugin calls:     |
 |  extensions/   |   |      | schemas (AJV)  |         |  registerTool()   |
 +----------------+   |      +-------+--------+         |  registerHook()   |
                      |              |                   |  registerChannel()|
 +----------------+   |      +-------v--------+         |  registerService()|
 | Global dir     |   |      | Load module    |         |  registerCommand()|
 | ~/.config/     |---+      | via jiti       |         |  registerHttp*()  |
 |  openclaw/     |   |      | (TS at runtime)|         |  registerProvider |
 |  extensions/   |   |      +-------+--------+         |  registerCli()    |
 +----------------+   |              |                   |  on()             |
                      |      +-------v--------+         +--------+----------+
 +----------------+   |      | Resolve export |                  |
 | Bundled dir    |---+      | register() or  |         +--------v----------+
 | (shipped w/    |          | activate()     |         | PluginRegistry    |
 |  package)      |          +----------------+         | populated with    |
 +----------------+                                     | all registrations |
                                                        +-------------------+
```

### Component Dependency Graph

```
                          +-------------------+
                          |   loader.ts       |
                          | (orchestrator)    |
                          +--------+----------+
                                   |
              +--------------------+--------------------+
              |                    |                    |
     +--------v--------+  +-------v--------+  +-------v--------+
     |  discovery.ts   |  | manifest.ts    |  | config-state.ts|
     | (4 origins)     |  | manifest-      |  | (enable/       |
     |                 |  |  registry.ts   |  |  disable)      |
     +--------+--------+  +-------+--------+  +-------+--------+
              |                    |                    |
              |            +------v---------+          |
              +----------->| schema-        |<---------+
                           | validator.ts   |
                           | config-        |
                           |  schema.ts     |
                           +----------------+

     +-------------------+        +-------------------+
     |   registry.ts     |<-------| types.ts          |
     | (central hub)     |        | (type system)     |
     +--------+----------+        +-------------------+
              |
   +----------+----------+----------+----------+----------+
   |          |          |          |          |          |
+--v---+ +---v----+ +---v----+ +---v----+ +---v----+ +--v-----+
|tools | |hooks   | |services| |http-   | |commands| |slots   |
|.ts   | |.ts     | |.ts     | |registry| |.ts     | |.ts     |
+------+ +--------+ +--------+ |.ts     | +--------+ +--------+
                                +--------+
```

### Subsystem Interconnections

The registry serves as the central nervous system. Every registration method on `OpenClawPluginApi` writes into a specific collection within the `PluginRegistry`. At runtime, the host system reads from these collections to:

- Resolve available tools for the LLM agent context
- Execute hook handlers at lifecycle boundaries
- Start and stop background services
- Mount HTTP routes on the gateway server
- Route incoming messages to the correct channel plugin
- Authenticate requests via provider plugins
- Dispatch slash commands from user input

---

## 3. Plugin Definition Contract

Every plugin must export a conforming `OpenClawPluginDefinition` object as its default export. This is the contract between the plugin and the host system.

### Type Definition

```typescript
interface OpenClawPluginDefinition {
  /**
   * Unique plugin identifier. Must be globally unique across all
   * discovery origins. Used as the key in the plugin registry,
   * configuration, and diagnostic output.
   */
  id: string;

  /**
   * Human-readable display name. Used in CLI output, dashboards,
   * and diagnostic messages. Defaults to `id` if not provided.
   */
  name: string;

  /**
   * Optional description of what the plugin does.
   */
  description?: string;

  /**
   * Semantic version string. Used for update detection and
   * compatibility checking.
   */
  version?: string;

  /**
   * Plugin kind for exclusive slot arbitration.
   * Currently only "memory" is supported. When set, the plugin
   * participates in the exclusive slot system and only one plugin
   * of this kind can be active at a time.
   */
  kind?: "memory" | undefined;

  /**
   * JSON Schema object describing the plugin's configuration.
   * Validated at load time via AJV. Plugins with invalid config
   * against their schema will fail to load.
   */
  configSchema?: object;

  /**
   * Primary registration function. The loader calls this with
   * an OpenClawPluginApi instance. The plugin uses the API to
   * register tools, hooks, channels, services, etc.
   *
   * May be synchronous or asynchronous.
   */
  register(api: OpenClawPluginApi): void | Promise<void>;

  /**
   * Alternative to register(). If the plugin exports `activate`
   * instead of `register`, the loader will call `activate`.
   * This is a legacy/alternative naming convention.
   */
  activate?(api: OpenClawPluginApi): void | Promise<void>;
}
```

### Minimal Plugin Example

```typescript
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

export default {
  id: "my-plugin",
  name: "My Plugin",
  version: "1.0.0",
  register(api: OpenClawPluginApi) {
    api.registerTool({
      name: "my_tool",
      description: "Does something useful",
      parameters: { type: "object", properties: {} },
      execute: async (args, context) => {
        return { result: "done" };
      },
    });
  },
};
```

### Contract Rules

1. The `id` field is mandatory and must be unique. Duplicate IDs across origins trigger a diagnostic warning in the manifest registry.
2. Either `register` or `activate` must be provided. If both exist, `register` takes precedence.
3. The `register`/`activate` function receives a single argument: the `OpenClawPluginApi` instance bound to that plugin's ID.
4. Registration is synchronous-safe: the loader awaits the return value, so async registration is supported.
5. Plugins must not perform side effects outside of their registration methods. All capabilities must be declared through the API.
6. The `kind` field triggers exclusive slot behavior. Only `"memory"` is currently recognized.

---

## 4. Discovery System

**Source file:** `src/plugins/discovery.ts`

The discovery system scans four origin directories in a defined order to locate plugin candidates. It produces a list of `PluginCandidate` objects that feed into the manifest registry and loader.

### Discovery Origins

Plugins are discovered from four origins, scanned in the following order:

| Priority | Origin      | Location                                             | Use Case                          |
| -------- | ----------- | ---------------------------------------------------- | --------------------------------- |
| 1        | `config`    | Paths specified in `plugins.loadPaths` configuration | User-specified plugin directories |
| 2        | `workspace` | `.openclaw/extensions/` relative to workspace root   | Project-specific extensions       |
| 3        | `global`    | `~/.config/openclaw/extensions/`                     | User-global extensions            |
| 4        | `bundled`   | Built-in directory shipped with the package          | Core platform extensions          |

**Order matters for precedence.** When multiple origins provide a plugin with the same ID, the enable/disable state resolution uses origin precedence to determine which takes effect.

### PluginCandidate Type

Each discovered plugin produces a candidate object:

```typescript
interface PluginCandidate {
  /** Plugin ID derived from the directory name */
  idHint: string;

  /** Source classification */
  source: "npm" | "local" | "bundled";

  /** Absolute filesystem path to the plugin root directory */
  rootDir: string;

  /** Which discovery origin found this candidate */
  origin: "config" | "workspace" | "global" | "bundled";

  /** Package name from package.json, if present */
  packageName?: string;

  /** Package version from package.json, if present */
  packageVersion?: string;
}
```

### Directory Scanning Logic

For each origin directory, the discovery system:

1. Checks that the directory exists and is accessible.
2. Enumerates immediate subdirectories (each subdirectory is a potential plugin).
3. For each subdirectory, checks for the presence of:
   - `openclaw.plugin.json` (manifest file), OR
   - `package.json` with an `openclaw` key, OR
   - An `index.ts` or `index.js` entry point
4. Constructs a `PluginCandidate` with the `idHint` derived from the directory name.
5. Reads package metadata (name, version) from `package.json` if present.

### Security Checks During Discovery

The discovery system performs three categories of security validation:

**Symlink escape detection:**

- All candidate paths are resolved to their real paths using safe realpath.
- If a symlink target resolves to a location outside the allowed origin directory, the candidate is rejected.
- This prevents an attacker from placing a symlink in `.openclaw/extensions/` that points to an arbitrary location on the filesystem.

**World-writable path blocking:**

- The discovery system checks filesystem permissions on candidate directories.
- If a candidate's root directory is world-writable (mode includes `o+w`), the candidate is rejected.
- This prevents loading plugins from directories where any user on the system could have injected malicious code.

**Suspicious UID ownership detection:**

- File ownership is inspected during discovery.
- Candidates owned by unexpected UIDs (not the current user, not root) generate warnings.
- This is a defense-in-depth measure against privilege escalation attacks.

### Bundled Plugin Resolution

The `bundled-dir.ts` module resolves the path to bundled plugins:

```typescript
// bundled-dir.ts
export function getBundledPluginsDir(): string {
  // Resolves the absolute path to the bundled extensions directory
  // shipped with the OpenClaw package installation
}
```

Bundled plugins are always discovered last (lowest priority) but are always available. They cannot be uninstalled — only disabled.

---

## 5. Manifest System

**Source files:** `src/plugins/manifest.ts`, `src/plugins/manifest-registry.ts`

The manifest system provides structured metadata about plugins beyond what is available in their TypeScript module exports. It supports both dedicated manifest files and `package.json` integration.

### Manifest File Format

The canonical manifest file is `openclaw.plugin.json`, located at the root of the plugin directory:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "description": "A description of what this plugin does",
  "version": "1.0.0",
  "kind": "memory",
  "configSchema": {
    "type": "object",
    "properties": {
      "apiKey": { "type": "string" },
      "maxRetries": { "type": "number", "default": 3 }
    },
    "required": ["apiKey"]
  },
  "channels": [
    {
      "id": "my-channel",
      "label": "My Channel",
      "docs": "https://docs.example.com/my-channel",
      "blurb": "Integration with My Channel messaging platform",
      "order": 50,
      "aliases": ["mc"]
    }
  ],
  "providers": ["my-auth-provider"],
  "skills": ["my-skill"],
  "uiHints": {
    "icon": "chat",
    "category": "messaging"
  }
}
```

### PluginManifest Type

```typescript
interface PluginManifest {
  /** Unique plugin identifier — must match the definition's id */
  id: string;

  /** Human-readable name */
  name?: string;

  /** Plugin description */
  description?: string;

  /** Semantic version */
  version?: string;

  /** Plugin kind for exclusive slot system */
  kind?: "memory";

  /** JSON Schema for plugin configuration validation */
  configSchema?: object;

  /** Channel metadata for channel plugins */
  channels?: PluginPackageChannel[];

  /** Provider identifiers this plugin registers */
  providers?: string[];

  /** Skill identifiers this plugin provides */
  skills?: string[];

  /** UI rendering hints */
  uiHints?: object;
}
```

### Package.json Integration

Plugins can embed their manifest metadata in `package.json` under the `openclaw` key:

```json
{
  "name": "@openclaw/plugin-discord",
  "version": "2.1.0",
  "openclaw": {
    "extensions": {
      "id": "discord",
      "name": "Discord"
    },
    "channel": {
      "label": "Discord",
      "docs": "https://docs.openclaw.dev/channels/discord",
      "blurb": "Full Discord integration with threads, embeds, and reactions",
      "order": 10,
      "aliases": ["dc"]
    },
    "install": {
      "npmSpec": "@openclaw/plugin-discord",
      "localPath": "./extensions/discord"
    }
  }
}
```

The `channel` sub-key provides rich metadata:

| Field     | Type     | Description                             |
| --------- | -------- | --------------------------------------- |
| `label`   | string   | Display name in UI and CLI              |
| `docs`    | string   | URL to channel documentation            |
| `blurb`   | string   | Short description for channel selection |
| `order`   | number   | Sort order in channel listings          |
| `aliases` | string[] | Alternative names for CLI commands      |

The `install` sub-key provides installation source information:

| Field       | Type   | Description                                      |
| ----------- | ------ | ------------------------------------------------ |
| `npmSpec`   | string | npm package specifier for remote installation    |
| `localPath` | string | Relative path for local/development installation |

### Manifest Registry

`manifest-registry.ts` builds a consolidated registry from all discovered candidates:

```typescript
function buildManifestRegistry(candidates: PluginCandidate[]): ManifestRegistry;
```

The build process:

1. Iterates all candidates in discovery order.
2. For each candidate, loads the manifest from `openclaw.plugin.json` or falls back to `package.json` openclaw metadata.
3. Validates manifest structure.
4. Detects duplicate IDs across origins — the first-seen candidate wins, and a diagnostic warning is emitted for duplicates.
5. Returns a `ManifestRegistry` map keyed by plugin ID.

**Duplicate detection** is critical because a workspace plugin with ID `"discord"` would shadow the bundled Discord plugin. The diagnostic output clearly reports which origin won and which was shadowed.

---

## 6. Loading Pipeline

**Source file:** `src/plugins/loader.ts`

The loader is the central orchestrator that transforms discovered candidates into live, registered plugins. It is implemented as the `loadOpenClawPlugins()` function.

### Loading Stages

```
  discoverOpenClawPlugins()
           |
           v
  buildManifestRegistry()
           |
           v
  resolveEnableState()          <-- config-state.ts
           |
           v
  validateConfigSchemas()       <-- config-schema.ts, schema-validator.ts
           |
           v
  loadModuleViaJiti()           <-- jiti runtime TS loader
           |
           v
  resolveExportFunction()       <-- register() or activate()
           |
           v
  createApi(pluginId)           <-- registry.ts
           |
           v
  call register(api)            <-- Plugin's registration function
           |
           v
  trackProvenance()             <-- Warn about untracked plugins
           |
           v
  applyExclusiveSlots()         <-- slots.ts
```

### Step 1: Discovery

Calls `discoverOpenClawPlugins()` to produce the candidate list from all four origins. See [Section 4](#4-discovery-system).

### Step 2: Manifest Registry

Calls `buildManifestRegistry()` to consolidate manifests and detect duplicates. See [Section 5](#5-manifest-system).

### Step 3: Enable State Resolution

The `resolveEnableState()` function (from `config-state.ts`) determines which plugins should be loaded:

```typescript
function resolveEnableState(
  candidates: PluginCandidate[],
  config: PluginConfig,
): Map<string, EnableState>;
```

Enable state is determined by origin precedence:

- Explicit `plugins.enabled` / `plugins.disabled` configuration takes highest precedence.
- Workspace-level configuration overrides global defaults.
- Bundled plugins are enabled by default unless explicitly disabled.

The `config-state.ts` module handles normalization of various enable/disable representations:

- Boolean values: `true` / `false`
- String arrays: `["discord", "slack"]` for batch enable/disable
- Object notation: `{ "discord": true, "slack": false }`

### Step 4: Config Schema Validation

For plugins with a `configSchema` defined (either in the manifest or the plugin definition), the loader validates the runtime configuration against the schema using AJV:

```typescript
// config-schema.ts
function validatePluginConfig(pluginId: string, config: unknown, schema: object): ValidationResult;
```

The `schema-validator.ts` module provides a cached AJV instance to avoid recompiling schemas on every load:

```typescript
// schema-validator.ts
class SchemaValidator {
  private cache: Map<string, ValidateFunction>;

  validate(schema: object, data: unknown): ValidationResult;
}
```

Plugins with invalid configuration against their declared schema will fail to load with a descriptive diagnostic error.

### Step 5: Module Loading via jiti

The loader uses `jiti` (Just-In-Time TypeScript Interpreter) to load plugin modules at runtime:

```
Plugin source (.ts)  -->  jiti  -->  Compiled module  -->  Default export
```

This is a critical design choice:

- **No build step required.** Plugin authors write TypeScript and the system loads it directly.
- **Full TypeScript support.** Decorators, enums, path aliases — everything works.
- **Source maps preserved.** Error stack traces point to the original TypeScript source.
- **Hot-path optimized.** jiti caches compiled modules for subsequent loads.

### Step 6: Export Resolution

The loader inspects the loaded module for a conforming export:

```typescript
function resolveExportFunction(
  module: unknown,
): ((api: OpenClawPluginApi) => void | Promise<void>) | null;
```

Resolution order:

1. If the module has a `register` function, use it.
2. Else if the module has an `activate` function, use it.
3. Else, emit a diagnostic error and skip the plugin.

### Step 7: API Creation and Registration

The registry's `createApi(pluginId)` factory produces a scoped `OpenClawPluginApi` instance bound to the plugin's ID. Every registration call through this API is automatically tagged with the originating plugin ID.

```typescript
const api = createApi("my-plugin");
await plugin.register(api);
```

### Step 8: Provenance Tracking

After registration, the loader checks for "untracked" plugins — those that were loaded but did not register any tools, hooks, channels, or other capabilities. This typically indicates a plugin that:

- Has a registration function that silently fails
- Is misconfigured
- Is a development stub

Untracked plugins generate diagnostic warnings.

### Step 9: Exclusive Slot Application

After all plugins are loaded, `applyExclusiveSlotSelection()` is called for each slot type to ensure mutual exclusion. See [Section 17](#17-exclusive-slot-system).

### Registry Cache

The loader maintains a `registryCache` Map that prevents redundant loading:

```typescript
const registryCache = new Map<string, PluginRecord>();
```

If a plugin ID has already been loaded (e.g., due to duplicate discovery across origins), the cached record is reused and the module is not loaded again.

---

## 7. Plugin Registry

**Source file:** `src/plugins/registry.ts`

The plugin registry is the central data structure that holds all registrations from all loaded plugins. It is the single source of truth for the host system to query available capabilities.

### PluginRegistry Type

```typescript
interface PluginRegistry {
  /** Map of plugin ID to PluginRecord */
  plugins: Map<string, PluginRecord>;

  /** All registered tool definitions across all plugins */
  tools: ToolRegistration[];

  /** Hook handler registrations (legacy registerHook style) */
  hooks: HookRegistration[];

  /** Typed hook registrations (via on() method) */
  typedHooks: TypedHookRegistration[];

  /** Channel plugin registrations */
  channels: ChannelRegistration[];

  /** Auth provider registrations */
  providers: ProviderRegistration[];

  /** Gateway method handler registrations */
  gatewayHandlers: GatewayHandlerRegistration[];

  /** HTTP request handler registrations */
  httpHandlers: HttpHandlerRegistration[];

  /** HTTP route metadata registrations */
  httpRoutes: HttpRouteRegistration[];

  /** CLI command registrar functions */
  cliRegistrars: CliRegistrar[];

  /** Background service registrations */
  services: ServiceRegistration[];

  /** Slash command registrations */
  commands: CommandRegistration[];

  /** Loading and registration diagnostics */
  diagnostics: PluginDiagnostic[];
}
```

### PluginRecord

Each loaded plugin is tracked by a `PluginRecord`:

```typescript
interface PluginRecord {
  /** Unique plugin identifier */
  id: string;

  /** Display name */
  name: string;

  /** Semantic version */
  version: string;

  /** Discovery origin */
  origin: "config" | "workspace" | "global" | "bundled";

  /** Current status */
  status: "loaded" | "failed" | "disabled";

  /** Names of tools registered by this plugin */
  toolNames: string[];

  /** Names of hooks registered by this plugin */
  hookNames: string[];

  /** IDs of channels registered by this plugin */
  channelIds: string[];

  /** JSON Schema for plugin configuration */
  configSchema?: object;

  /** Diagnostic messages from loading/registration */
  diagnostics: PluginDiagnostic[];
}
```

### Registry Factory

```typescript
function createPluginRegistry(): {
  registry: PluginRegistry;
  createApi: (pluginId: string) => OpenClawPluginApi;
};
```

The factory returns two things:

1. The `registry` object — populated by plugin registrations.
2. The `createApi` function — produces scoped API instances for each plugin.

Every `createApi(pluginId)` call returns an `OpenClawPluginApi` where:

- All `register*` methods automatically tag registrations with `pluginId`.
- The `resolvePath()` method is scoped to the plugin's root directory.
- The `runtime` property provides access to `PluginRuntime`.

### Registration Flow

```
Plugin code:                          Registry internals:
-----------                          -------------------

api.registerTool({                   registry.tools.push({
  name: "my_tool",        ------>      pluginId: "my-plugin",
  ...                                  name: "my_tool",
})                                     ...
                                     })
                                     record.toolNames.push("my_tool")

api.registerHook(                    registry.hooks.push({
  "before_tool_call",     ------>      pluginId: "my-plugin",
  handler,                             hookName: "before_tool_call",
  priority                             handler,
)                                      priority
                                     })
                                     record.hookNames.push("before_tool_call")
```

---

## 8. Plugin API (OpenClawPluginApi)

**Source file:** `src/plugins/types.ts`

The `OpenClawPluginApi` is the interface every plugin receives in its `register()` function. It is the only sanctioned way for plugins to interact with the host system.

### Complete API Surface

```typescript
interface OpenClawPluginApi {
  /**
   * Register an LLM-callable tool.
   * The tool becomes available to the agent for function calling.
   */
  registerTool(tool: ToolDefinition): void;

  /**
   * Register a lifecycle hook handler.
   * @param hookName - One of the 24 supported hook names
   * @param handler - Function to execute when the hook fires
   * @param priority - Numeric priority (higher = runs first for modifying hooks)
   */
  registerHook(hookName: string, handler: HookHandler, priority?: number): void;

  /**
   * Register an HTTP request handler on the gateway server.
   * @param method - HTTP method (GET, POST, PUT, DELETE, PATCH)
   * @param path - URL path (will be normalized and prefixed)
   * @param handler - Request handler function
   */
  registerHttpHandler(method: string, path: string, handler: HttpHandler): void;

  /**
   * Register HTTP route metadata for documentation/discovery.
   * This provides route metadata without necessarily mounting a handler.
   */
  registerHttpRoute(route: HttpRouteDefinition): void;

  /**
   * Register a messaging channel integration.
   * The channel plugin handles message I/O for a specific platform.
   */
  registerChannel(channel: ChannelDefinition): void;

  /**
   * Register a gateway method handler.
   * Extends the gateway server's RPC capabilities.
   */
  registerGatewayMethod(method: GatewayMethodDefinition): void;

  /**
   * Register CLI subcommands.
   * The registrar function receives the CLI program object
   * and can attach commands, options, and arguments.
   */
  registerCli(registrar: CliRegistrar): void;

  /**
   * Register a background service.
   * Services are started after all plugins are loaded and stopped
   * during graceful shutdown.
   */
  registerService(service: ServiceDefinition): void;

  /**
   * Register an authentication provider.
   * Provider plugins handle auth flows for external services.
   */
  registerProvider(provider: ProviderDefinition): void;

  /**
   * Register a slash command.
   * Commands are invokable by users via /command syntax.
   */
  registerCommand(command: CommandDefinition): void;

  /**
   * Type-safe hook registration using the on() pattern.
   * Provides better TypeScript inference than registerHook().
   */
  on<H extends HookName>(hookName: H, handler: TypedHookHandler<H>): void;

  /**
   * Resolve a relative path against the plugin's root directory.
   * Ensures plugins can locate their own assets without hardcoding paths.
   */
  resolvePath(relative: string): string;

  /**
   * Access to the PluginRuntime object.
   * Provides access to all core subsystems: config, events,
   * media processing, TTS, memory, logging, state, and
   * per-channel operations.
   */
  runtime: PluginRuntime;
}
```

### Method Categories

The API methods fall into distinct categories:

**Capability Registration:**

- `registerTool()` — Adds tools to the LLM's function-calling repertoire
- `registerHook()` / `on()` — Attaches handlers to lifecycle events
- `registerChannel()` — Integrates a messaging platform
- `registerProvider()` — Adds an authentication mechanism
- `registerCommand()` — Adds a user-facing slash command

**Infrastructure Registration:**

- `registerHttpHandler()` — Mounts HTTP endpoints
- `registerHttpRoute()` — Declares HTTP route metadata
- `registerGatewayMethod()` — Extends the gateway RPC surface
- `registerCli()` — Adds CLI subcommands
- `registerService()` — Starts a background service

**Utilities:**

- `resolvePath()` — Plugin-relative path resolution
- `runtime` — Subsystem access

### Scoping

Every `OpenClawPluginApi` instance is scoped to a specific plugin ID. This scoping is transparent to the plugin author — they simply call `api.registerTool(...)` and the registration is automatically tagged. This scoping enables:

- **Diagnostics:** Knowing which plugin registered which capability.
- **Conflict detection:** Identifying when two plugins register tools with the same name.
- **Selective disabling:** Removing all registrations from a specific plugin.
- **Audit logging:** Tracking which plugin initiated which action.

---

## 9. Plugin Runtime

**Source files:** `src/plugins/runtime/index.ts`, `src/plugins/runtime/types.ts`

The `PluginRuntime` object provides plugins with access to all core subsystems of the OpenClaw platform. It is available via `api.runtime` during and after registration.

### Runtime Factory

```typescript
function createPluginRuntime(options: RuntimeOptions): PluginRuntime;
```

The factory assembles the runtime by wiring together references to all active subsystems. The resulting object is shared across all plugins (it is not scoped per-plugin like the API).

### Core Subsystems

#### Configuration

```typescript
runtime.config; // Access to platform configuration
```

Provides read access to the current configuration state, including plugin-specific configuration sections.

#### System Events

```typescript
runtime.events; // EventEmitter-style system event bus
```

The event bus enables plugins to listen for and emit system-wide notifications beyond the structured hook system. This is used for low-level coordination between subsystems.

#### Media Processing

```typescript
runtime.media; // Image, audio, and video processing (sharp)
```

Provides media manipulation capabilities powered by the `sharp` library:

- Image resizing, cropping, and format conversion
- Audio processing
- Video frame extraction
- Thumbnail generation

#### Text-to-Speech

```typescript
runtime.tts; // Text-to-speech synthesis
```

Provides TTS capabilities for voice-enabled extensions:

- Text-to-speech synthesis
- Voice selection
- Audio format options

#### Memory Tools

```typescript
runtime.memory; // Memory search and retrieval
```

Provides access to the active memory backend:

- Semantic search across stored memories
- Memory retrieval by ID or query
- Memory storage and updates

#### Logging

```typescript
runtime.logging; // Plugin-scoped logging
```

The `logger.ts` module provides plugin-scoped loggers that automatically prefix log messages with the plugin ID:

```typescript
// logger.ts
function createPluginLogger(pluginId: string): PluginLogger;
```

Log output is structured and filterable:

```
[plugin:discord] Connected to gateway
[plugin:mabos] BDI heartbeat started (interval: 30s)
```

#### State Persistence

```typescript
runtime.state; // Plugin state persistence
```

Provides key-value state persistence for plugins to maintain state across sessions and restarts.

#### Channel Operations

The runtime provides a full API surface for each supported channel. Channel operations are organized by platform and provide idiomatic access to platform-specific features:

**Discord:**

```typescript
runtime.discord.sendMessage(channelId, content);
runtime.discord.editMessage(channelId, messageId, content);
runtime.discord.addReaction(channelId, messageId, emoji);
runtime.discord.createEmbed(channelId, embed);
runtime.discord.createThread(channelId, name, options);
```

**Slack:**

```typescript
runtime.slack.postMessage(channel, text, options);
runtime.slack.sendBlocks(channel, blocks);
runtime.slack.replyInThread(channel, threadTs, text);
runtime.slack.addReaction(channel, timestamp, name);
```

**Telegram:**

```typescript
runtime.telegram.sendMessage(chatId, text, options);
runtime.telegram.sendMedia(chatId, media);
runtime.telegram.sendInlineKeyboard(chatId, text, keyboard);
```

**Signal:**

```typescript
runtime.signal.sendMessage(recipient, message);
runtime.signal.sendGroupMessage(groupId, message);
runtime.signal.addReaction(recipient, messageTimestamp, emoji);
```

**iMessage (via BlueBubbles):**

```typescript
runtime.imessage.sendMessage(chatId, text);
```

**WhatsApp:**

```typescript
runtime.whatsapp.sendMessage(chatId, text);
runtime.whatsapp.sendMedia(chatId, media);
runtime.whatsapp.sendToGroup(groupId, text);
```

Note: WhatsApp operations are lazily loaded to avoid unnecessary initialization when WhatsApp is not configured.

**LINE:**

```typescript
runtime.line.sendMessage(to, message);
runtime.line.sendFlexMessage(to, flexContent);
```

### Native Dependencies

The `runtime/native-deps.ts` module provides install hints for native dependencies that some plugins require:

```typescript
// native-deps.ts
function getNativeDependencyHint(dep: string): string | null;
```

This handles cases where plugins need platform-specific native modules (e.g., `sharp` for image processing) and provides user-friendly installation instructions when they are missing.

---

## 10. Tool Registration

**Source file:** `src/plugins/tools.ts`

Tool registration is the mechanism by which plugins add LLM-callable functions to the agent's capabilities. The tool resolution system handles conflict detection, allowlisting, and integration with the agent context.

### Registration

Plugins register tools via `api.registerTool()`:

```typescript
api.registerTool({
  name: "search_knowledge_base",
  description: "Search the knowledge base for relevant information",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      limit: { type: "number", description: "Max results", default: 10 },
    },
    required: ["query"],
  },
  execute: async (args, context) => {
    const results = await searchKnowledgeBase(args.query, args.limit);
    return { results };
  },
});
```

### Tool Resolution

The `resolvePluginTools()` function is called at agent context assembly time to produce the final list of available tools:

```typescript
function resolvePluginTools(
  registry: PluginRegistry,
  options: ToolResolutionOptions,
): ResolvedTool[];
```

**Resolution pipeline:**

1. **Fast-path check:** If plugins are disabled (e.g., in unit tests), returns an empty array immediately. This avoids unnecessary iteration over an empty registry.

2. **Collect all registered tools** from `registry.tools`.

3. **Apply allowlisting:**
   - If `group:plugins` is in the allowlist, all plugin tools are permitted.
   - Individual tool names can be allowlisted: `["search_knowledge_base", "create_note"]`.
   - Individual plugin IDs can be allowlisted: `["mabos", "memory-core"]`, which permits all tools from those plugins.

4. **Conflict detection:**
   - Tool names that conflict with core built-in tool names are blocked.
   - Two plugins registering tools with the same name triggers a diagnostic error.
   - The first-registered tool wins in case of conflict.

5. **Return resolved tools** with full metadata including the originating plugin ID.

### Tool Definition Structure

```typescript
interface ToolDefinition {
  /** Unique tool name — must not conflict with core tools */
  name: string;

  /** Description shown to the LLM for function selection */
  description: string;

  /** JSON Schema describing the tool's parameters */
  parameters: object;

  /** Execution function called when the LLM invokes the tool */
  execute: (args: any, context: ToolContext) => Promise<any>;
}
```

---

## 11. Hook System

**Source files:** `src/plugins/hooks.ts`, `src/plugins/hook-runner-global.ts`

The hook system is the primary mechanism for plugins to observe and modify the behavior of the agent lifecycle. It supports 24 distinct hooks organized across six categories, with three different execution strategies.

### Execution Strategies

#### Void Hooks (Parallel Execution)

```typescript
async function runVoidHook(hookName: string, payload: any): Promise<void>;
```

Void hooks fire all handlers in **parallel** via `Promise.all()`. They are used for notification and logging purposes where:

- Handlers do not return meaningful values.
- Handler execution order does not matter.
- One handler's failure should not block others.

**Error handling:** Individual handler failures are logged but do not propagate. Other handlers continue executing.

#### Modifying Hooks (Sequential Execution)

```typescript
async function runModifyingHook<T>(hookName: string, payload: T): Promise<T>;
```

Modifying hooks execute handlers **sequentially** in **priority order** (higher priority number runs first). Each handler receives the output of the previous handler, forming a transformation pipeline:

```
Input payload
     |
     v
Handler (priority: 100) --> modified payload
     |
     v
Handler (priority: 50)  --> further modified payload
     |
     v
Handler (priority: 10)  --> final payload
     |
     v
Output payload
```

**Result merging:** Each handler returns a (possibly modified) version of the payload. The hook runner merges the result with the input, so handlers can return partial modifications.

#### Synchronous Hooks

```typescript
function runToolResultPersist(payload: any): any;
function runBeforeMessageWrite(payload: any): any;
```

Two hooks are intentionally **synchronous** for hot-path performance:

- `tool_result_persist` — Called on every tool result storage operation.
- `before_message_write` — Called before every message write to the conversation history.

These hooks run in the critical path of message processing and cannot afford the overhead of async scheduling. Handlers for these hooks must not perform I/O or other async operations.

### Global Hook Runner

The `hook-runner-global.ts` module exports a global singleton hook runner:

```typescript
// hook-runner-global.ts
export const globalHookRunner: HookRunner;
```

This singleton is initialized during application startup and is used by all subsystems to fire hooks. It holds references to all registered hook handlers from all plugins.

### Complete Hook Reference

#### Agent Lifecycle Hooks

| Hook                   | Type      | Payload                     | Purpose                                                                                                      |
| ---------------------- | --------- | --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `before_model_resolve` | Modifying | `{ modelId, context }`      | Override model selection. Plugins can redirect to a different model based on context.                        |
| `before_prompt_build`  | Modifying | `{ systemPrompt, context }` | Inject additional context into the system prompt. MABOS uses this for persona/goal injection.                |
| `before_agent_start`   | Void      | `{ agentConfig }`           | Legacy notification before agent starts. Used for initialization tasks.                                      |
| `llm_input`            | Modifying | `{ messages }`              | Transform the messages array before sending to the LLM. Enables message filtering, injection, and rewriting. |
| `llm_output`           | Modifying | `{ response }`              | Transform the LLM response before processing. Enables response filtering and augmentation.                   |
| `agent_end`            | Void      | `{ result }`                | Notification when the agent completes its run. Used for cleanup and logging.                                 |
| `before_compaction`    | Void      | `{ context }`               | Notification before conversation compaction. Plugins can save state before history is condensed.             |
| `after_compaction`     | Void      | `{ context }`               | Notification after compaction completes. Plugins can update internal state to reflect the new context.       |
| `before_reset`         | Void      | `{ context }`               | Notification before conversation reset. Plugins can perform cleanup.                                         |

#### Message Hooks

| Hook               | Type      | Payload                | Purpose                                                                                                  |
| ------------------ | --------- | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `message_received` | Modifying | `{ message, channel }` | Transform incoming messages from any channel. Enables content filtering, translation, and preprocessing. |
| `message_sending`  | Modifying | `{ message, channel }` | Transform outgoing messages before they are sent. Enables formatting, censoring, and augmentation.       |
| `message_sent`     | Void      | `{ message, channel }` | Notification after a message has been sent. Used for analytics, logging, and delivery tracking.          |

#### Tool Hooks

| Hook                   | Type      | Payload                               | Purpose                                                                                                                |
| ---------------------- | --------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `before_tool_call`     | Modifying | `{ toolName, args, context }`         | Transform or block tool calls before execution. Enables argument validation, policy enforcement, and call redirection. |
| `after_tool_call`      | Modifying | `{ toolName, args, result, context }` | Transform tool results after execution. MABOS uses this for BDI audit trail recording.                                 |
| `tool_result_persist`  | Sync      | `{ toolName, result }`                | Synchronous hook for tool result persistence. Called on the hot path — must not perform I/O.                           |
| `before_message_write` | Sync      | `{ message }`                         | Synchronous hook before message write. Called on the hot path — must not perform I/O.                                  |

#### Session Hooks

| Hook            | Type | Payload         | Purpose                                                                             |
| --------------- | ---- | --------------- | ----------------------------------------------------------------------------------- |
| `session_start` | Void | `{ sessionId }` | Notification when a new session begins. Used for session-scoped initialization.     |
| `session_end`   | Void | `{ sessionId }` | Notification when a session ends. Used for cleanup and session-scoped finalization. |

#### Subagent Hooks

| Hook                       | Type      | Payload               | Purpose                                                                                                                           |
| -------------------------- | --------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `subagent_spawning`        | Modifying | `{ config }`          | Transform subagent configuration before spawning. Enables tool filtering, model override, and context injection for child agents. |
| `subagent_delivery_target` | Modifying | `{ target }`          | Override where subagent results are delivered. Enables routing of subagent output to different channels or handlers.              |
| `subagent_spawned`         | Void      | `{ agentId, config }` | Notification when a subagent has been spawned. Used for tracking and monitoring.                                                  |
| `subagent_ended`           | Void      | `{ agentId, result }` | Notification when a subagent has completed. Used for result aggregation and cleanup.                                              |

#### Gateway Hooks

| Hook            | Type | Payload      | Purpose                                                                            |
| --------------- | ---- | ------------ | ---------------------------------------------------------------------------------- |
| `gateway_start` | Void | `{ config }` | Notification when the gateway server starts. Used for post-startup initialization. |
| `gateway_stop`  | Void | `{}`         | Notification when the gateway server stops. Used for pre-shutdown cleanup.         |

### Hook Registration Examples

**Using registerHook (legacy style):**

```typescript
api.registerHook(
  "before_tool_call",
  async (payload) => {
    if (payload.toolName === "dangerous_tool") {
      return { ...payload, blocked: true, reason: "Policy violation" };
    }
    return payload;
  },
  100,
); // priority: 100 (runs early)
```

**Using on() (typed style):**

```typescript
api.on("before_prompt_build", async ({ systemPrompt, context }) => {
  const persona = await loadActivePersona();
  return {
    systemPrompt: systemPrompt + `\n\n${persona.instructions}`,
    context,
  };
});
```

---

## 12. Service Lifecycle

**Source file:** `src/plugins/services.ts`

The service subsystem manages long-running background tasks registered by plugins. Services have a structured lifecycle with ordered startup and shutdown.

### Service Definition

```typescript
interface ServiceDefinition {
  /** Unique service name */
  name: string;

  /** Service start function — called during startup */
  start: () => Promise<void>;

  /** Service stop function — called during shutdown */
  stop: () => Promise<void>;
}
```

### Startup

```typescript
async function startPluginServices(registry: PluginRegistry): Promise<ServiceHandle>;
```

Services are started **sequentially** in registration order. This is intentional:

- Some services depend on others being available (e.g., a dashboard service may depend on a database service).
- Sequential startup provides deterministic initialization ordering.
- If a service fails to start, subsequent services still attempt to start (error isolation).

```
Service A start()  -->  Service B start()  -->  Service C start()
    [success]              [success]              [success]
```

### Shutdown

The returned `ServiceHandle` provides a `stop()` method:

```typescript
interface ServiceHandle {
  stop: () => Promise<void>;
}
```

Stop executes services in **reverse registration order** for clean teardown:

```
Service C stop()  -->  Service B stop()  -->  Service A stop()
```

This ensures that services which were started last (and may depend on earlier services) are stopped first.

### Error Isolation

Both startup and shutdown errors are isolated per-service:

```
Service A start()  -->  Service B start() [FAILS]  -->  Service C start()
    [success]            [error logged]                    [success]
```

A failing service:

- Has its error logged with full context (plugin ID, service name, error details).
- Does not prevent other services from starting/stopping.
- Is marked as failed in the plugin diagnostics.

### Service Examples

**MABOS BDI Heartbeat Service:**

```typescript
api.registerService({
  name: "bdi-heartbeat",
  start: async () => {
    heartbeatInterval = setInterval(async () => {
      await processIntentionQueue();
      await evaluateGoalProgress();
    }, 30_000);
  },
  stop: async () => {
    clearInterval(heartbeatInterval);
    await flushAuditTrail();
  },
});
```

---

## 13. HTTP Route Registration

**Source files:** `src/plugins/http-registry.ts`, `src/plugins/http-path.ts`

Plugins can mount HTTP endpoints on the gateway server for webhooks, REST APIs, dashboards, and other HTTP-accessible functionality.

### Two Registration Methods

#### Handler Registration

```typescript
api.registerHttpHandler(method, path, handler);
```

This mounts an actual HTTP request handler:

```typescript
api.registerHttpHandler("POST", "/webhooks/github", async (req, res) => {
  const event = req.headers["x-github-event"];
  const payload = req.body;
  await processGitHubWebhook(event, payload);
  res.status(200).json({ ok: true });
});

api.registerHttpHandler("GET", "/api/status", async (req, res) => {
  const status = await getSystemStatus();
  res.json(status);
});
```

#### Route Metadata Registration

```typescript
api.registerHttpRoute(route);
```

This registers route metadata for documentation and discovery without necessarily mounting a handler:

```typescript
api.registerHttpRoute({
  method: "GET",
  path: "/api/v1/goals",
  description: "List all active BDI goals",
  auth: "bearer",
  parameters: [{ name: "status", in: "query", type: "string" }],
});
```

### Path Normalization

The `http-path.ts` module normalizes all registered paths:

```typescript
function normalizeHttpPath(path: string): string;
```

Normalization rules:

- Ensures paths start with `/`.
- Removes trailing slashes.
- Collapses duplicate slashes (`//` becomes `/`).
- Plugin paths are automatically prefixed with the plugin namespace.

### Deduplication

The `http-registry.ts` module prevents duplicate route registrations:

- If two plugins attempt to register the same method + path combination, the second registration is rejected with a diagnostic warning.
- The first-registered handler wins.
- This prevents accidental route collisions between plugins.

### Gateway Mounting

Registered HTTP handlers are mounted on the gateway server during its startup phase. The gateway:

1. Collects all `httpHandlers` from the registry.
2. Groups them by method.
3. Mounts them on the appropriate Express/Fastify route.
4. Applies any authentication middleware specified in the route metadata.

---

## 14. Channel Registration

**Source file:** `src/plugins/registry.ts` (channel collection), plus individual channel extensions

Channel plugins are the primary mechanism for integrating messaging platforms with OpenClaw. They follow a consistent pattern across all 25+ supported platforms.

### Channel Plugin Pattern

Every channel extension follows this structure:

```typescript
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

export default {
  id: "channel-name",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    // 1. Set the channel runtime reference
    setChannelRuntime(api.runtime);

    // 2. Register the channel plugin
    api.registerChannel({
      plugin: channelPlugin,
    });

    // 3. Optional: register additional capabilities
    api.registerHook("subagent_spawning", handleSubagentConfig);
    api.registerTool({
      /* channel-specific tools */
    });
  },
};
```

### Channel Plugin Interface

The `channelPlugin` object implements the channel contract:

```typescript
interface ChannelPlugin {
  /** Channel identifier */
  id: string;

  /** Initialize the channel connection */
  connect: () => Promise<void>;

  /** Disconnect from the channel */
  disconnect: () => Promise<void>;

  /** Send a message through the channel */
  sendMessage: (target: string, message: ChannelMessage) => Promise<void>;

  /** Handle incoming messages (callback registration) */
  onMessage: (handler: MessageHandler) => void;
}
```

### Channel Metadata

Channel metadata is provided via the manifest or `package.json`:

```typescript
interface PluginPackageChannel {
  id: string; // e.g., "discord"
  label: string; // e.g., "Discord"
  docs: string; // URL to setup documentation
  blurb: string; // Short description
  order: number; // Sort order in listings
  aliases: string[]; // e.g., ["dc"] for CLI shortcuts
}
```

### Supported Channels

The platform ships with channel integrations for:

| Channel        | ID               | Platform Features                                    |
| -------------- | ---------------- | ---------------------------------------------------- |
| Discord        | `discord`        | Messages, embeds, threads, reactions, slash commands |
| Slack          | `slack`          | Messages, blocks, threads, reactions, app mentions   |
| Telegram       | `telegram`       | Messages, media, inline keyboards, groups            |
| Signal         | `signal`         | Messages, groups, reactions, disappearing messages   |
| WhatsApp       | `whatsapp`       | Messages, media, groups (lazily loaded)              |
| iMessage       | `imessage`       | Messages via BlueBubbles bridge                      |
| LINE           | `line`           | Messages, flex messages, rich menus                  |
| Matrix         | `matrix`         | Messages, rooms, E2E encryption                      |
| IRC            | `irc`            | Messages, channels, nick management                  |
| Nostr          | `nostr`          | Messages, relay management                           |
| Feishu         | `feishu`         | Messages, cards, groups                              |
| Google Chat    | `googlechat`     | Messages, cards, spaces                              |
| MS Teams       | `msteams`        | Messages, cards, channels                            |
| Mattermost     | `mattermost`     | Messages, channels, threads                          |
| Nextcloud Talk | `nextcloud-talk` | Messages, rooms                                      |
| Synology Chat  | `synology-chat`  | Messages, channels                                   |
| Tlon           | `tlon`           | Messages, groups                                     |
| Twitch         | `twitch`         | Chat messages, commands                              |
| Zalo           | `zalo`           | Messages, groups                                     |
| BlueBubbles    | `bluebubbles`    | iMessage bridge                                      |

---

## 15. Provider Registration

**Source file:** `src/plugins/providers.ts`

Provider plugins implement authentication flows for external services. They enable the platform to authenticate against third-party APIs, LLM providers, and other services that require credentials.

### Provider Resolution

```typescript
function resolveProvider(
  registry: PluginRegistry,
  providerId: string,
): ProviderRegistration | undefined;
```

The provider resolution function looks up a registered provider by ID. If multiple plugins register the same provider ID, the first registration wins.

### Bundled Auth Providers

| Provider           | Plugin ID                 | Purpose                              |
| ------------------ | ------------------------- | ------------------------------------ |
| Copilot Proxy      | `copilot-proxy`           | GitHub Copilot API authentication    |
| Google Antigravity | `google-antigravity-auth` | Google AI/Antigravity authentication |
| Google Gemini CLI  | `google-gemini-cli-auth`  | Google Gemini CLI authentication     |
| Minimax Portal     | `minimax-portal-auth`     | Minimax AI portal authentication     |
| Qwen Portal        | `qwen-portal-auth`        | Qwen AI portal authentication        |

### Provider Definition

```typescript
interface ProviderDefinition {
  /** Unique provider identifier */
  id: string;

  /** Human-readable provider name */
  name: string;

  /** Authentication function */
  authenticate: (options: AuthOptions) => Promise<AuthResult>;

  /** Token refresh function (for OAuth flows) */
  refresh?: (token: string) => Promise<AuthResult>;

  /** Revocation function */
  revoke?: (token: string) => Promise<void>;
}
```

---

## 16. Slash Command System

**Source file:** `src/plugins/commands.ts`

The slash command system enables plugins to register user-facing commands that are invokable via `/command` syntax in the chat interface.

### Command Definition

```typescript
interface OpenClawPluginCommandDefinition {
  /** Command name (without the leading slash) */
  name: string;

  /** Command description shown in help */
  description: string;

  /** Argument schema */
  args?: CommandArgSchema;

  /** Required permissions for this command */
  requiredAuth?: string[];

  /** Match function — determines if input matches this command */
  match: (input: string) => boolean;

  /** Execute function — runs the command logic */
  execute: (args: ParsedArgs, context: CommandContext) => Promise<CommandResult>;
}
```

### Auth Gating

Commands can declare required permissions via `requiredAuth`. The command dispatcher checks the user's permissions before executing:

```typescript
api.registerCommand({
  name: "admin-reset",
  description: "Reset the system state (admin only)",
  requiredAuth: ["admin"],
  match: (input) => input.startsWith("/admin-reset"),
  execute: async (args, context) => {
    await resetSystemState();
    return { message: "System state reset complete." };
  },
});
```

If the user lacks the required permissions, the command is not executed and an appropriate error message is returned.

### Argument Sanitization

The command system sanitizes arguments before passing them to the execute function:

- HTML entities are escaped.
- Shell metacharacters are neutralized.
- Excessively long arguments are truncated.
- Null bytes are stripped.

This prevents command injection and other input-based attacks.

### Command Registration

```typescript
api.registerCommand({
  name: "goals",
  description: "List active BDI goals",
  args: {
    status: { type: "string", choices: ["active", "completed", "failed"] },
  },
  match: (input) => /^\/goals(\s|$)/.test(input),
  execute: async (args, context) => {
    const goals = await listGoals(args.status);
    return { message: formatGoalList(goals) };
  },
});
```

---

## 17. Exclusive Slot System

**Source file:** `src/plugins/slots.ts`

The exclusive slot system ensures that for certain plugin categories, exactly one implementation is active at any time. This prevents conflicts when multiple plugins provide the same capability.

### Design

A "slot" is a named capability category where mutual exclusion is required. Currently, the only slot is `"memory"`, but the architecture is designed to support additional slots.

### Memory Slot

The memory slot ensures only one memory backend is active:

- **Default:** `"memory-core"` (SQLite-based memory)
- **Alternative:** `"memory-lancedb"` (LanceDB vector-based memory)

Plugins declare their slot participation via the `kind` field:

```typescript
export default {
  id: "memory-lancedb",
  kind: "memory", // participates in the memory slot
  register(api) {
    // Register memory tools and services
  },
};
```

### Slot Selection

```typescript
function applyExclusiveSlotSelection(
  slotName: string,
  selectedPluginId: string,
  registry: PluginRegistry,
): void;
```

The selection process:

1. Identifies all plugins with `kind` matching the slot name.
2. Activates the selected plugin (by ID).
3. Disables all competing plugins for that slot.
4. Emits diagnostic messages for any disabled competitors.

```
Before slot selection:
  memory-core:    enabled
  memory-lancedb: enabled  <-- selected

After slot selection:
  memory-core:    DISABLED (slot conflict with memory-lancedb)
  memory-lancedb: enabled  (active memory slot)
```

### Configuration

The active slot selection is configured via:

```json
{
  "plugins": {
    "slots": {
      "memory": "memory-lancedb"
    }
  }
}
```

If no slot configuration is provided, the default value for each slot is used (`"memory-core"` for the memory slot).

---

## 18. Security Architecture

**Source files:** `src/plugins/path-safety.ts`, `src/plugins/discovery.ts`, `src/plugins/install.ts`

The plugin system implements defense-in-depth security across the entire plugin lifecycle.

### Path Safety

The `path-safety.ts` module provides two critical functions:

#### Path Containment

```typescript
function isPathInside(child: string, parent: string): boolean;
```

Checks whether a resolved path is contained within a parent directory. Used to:

- Prevent plugins from accessing files outside their root directory.
- Validate that `resolvePath()` results stay within bounds.
- Ensure symlinks do not escape containment.

#### Safe Realpath

```typescript
function safeRealpath(path: string): string | null;
```

Resolves a path to its real location (following symlinks) with safety checks:

- Returns `null` if the path does not exist.
- Returns `null` if resolution would cross security boundaries.
- Handles TOCTOU (time-of-check-time-of-use) race conditions gracefully.

### Discovery-Time Security

During plugin discovery, three security checks are performed:

**1. Symlink Escape Detection**

```
.openclaw/extensions/evil-plugin -> /etc/shadow   BLOCKED
.openclaw/extensions/evil-plugin -> ../../secrets  BLOCKED
.openclaw/extensions/good-plugin -> ./lib/plugin   ALLOWED (stays inside)
```

All candidate paths are resolved through `safeRealpath()`. If the resolved path escapes the origin directory, the candidate is rejected with a security diagnostic.

**2. World-Writable Path Blocking**

```
drwxrwxrwx  /tmp/plugins/evil-plugin    BLOCKED (world-writable)
drwxr-xr-x  /home/user/.openclaw/ext    ALLOWED (not world-writable)
```

Directories with world-writable permissions (`o+w`) are considered insecure because any user on the system could have injected malicious code. Candidates from such directories are rejected.

**3. Suspicious UID Ownership**

```
owner: root    (uid 0)      ALLOWED (trusted)
owner: user    (uid 1000)   ALLOWED (current user)
owner: nobody  (uid 65534)  WARNING (suspicious)
```

Files owned by UIDs other than the current user or root generate warnings. This is a defense-in-depth measure that does not block loading but alerts administrators to potential issues.

### Install-Time Security

The `install.ts` module performs security scanning when installing plugins from external sources:

**Archive scanning:**

- Archives (`.tar.gz`, `.zip`) are scanned for path traversal attacks (`../` in filenames).
- Zip slip protection prevents extracting files outside the target directory.
- Excessively large archives are rejected.

**npm security:**

- npm packages are installed in a sandboxed directory.
- Post-install scripts are monitored.
- Known vulnerability databases are consulted.

**Directory installation:**

- Linked plugins (via symlink) are never deleted during uninstall — `uninstall.ts` explicitly checks for this.
- File permissions are validated.
- `.env` files and credential patterns are flagged.

### Runtime Security

- **Tool allowlisting:** Only explicitly allowed tools are available to the LLM agent.
- **Command auth gating:** Slash commands can require specific permissions.
- **Argument sanitization:** All user input through the command system is sanitized.
- **HTTP route isolation:** Plugin HTTP handlers are namespaced to prevent collisions.

---

## 19. Bundled Extensions Catalog

OpenClaw ships with 41 bundled extensions. These are pre-installed and always available (though they can be disabled).

### By Category

#### Channel Integrations (25+ extensions)

| Extension      | ID               | Description                                                  |
| -------------- | ---------------- | ------------------------------------------------------------ |
| Discord        | `discord`        | Full Discord bot integration with embeds, threads, reactions |
| Slack          | `slack`          | Slack app with blocks, threads, reactions                    |
| Telegram       | `telegram`       | Telegram bot with media, keyboards, groups                   |
| WhatsApp       | `whatsapp`       | WhatsApp integration with media and groups                   |
| Signal         | `signal`         | Signal messenger with groups and reactions                   |
| iMessage       | `imessage`       | macOS iMessage integration                                   |
| BlueBubbles    | `bluebubbles`    | iMessage bridge for non-macOS                                |
| LINE           | `line`           | LINE messaging with flex messages                            |
| Matrix         | `matrix`         | Matrix protocol with E2E encryption                          |
| IRC            | `irc`            | IRC protocol support                                         |
| Nostr          | `nostr`          | Nostr protocol integration                                   |
| Feishu         | `feishu`         | Feishu/Lark messaging                                        |
| Google Chat    | `googlechat`     | Google Chat spaces integration                               |
| MS Teams       | `msteams`        | Microsoft Teams integration                                  |
| Mattermost     | `mattermost`     | Mattermost server integration                                |
| Nextcloud Talk | `nextcloud-talk` | Nextcloud Talk rooms                                         |
| Synology Chat  | `synology-chat`  | Synology Chat integration                                    |
| Tlon           | `tlon`           | Tlon/Urbit messaging                                         |
| Twitch         | `twitch`         | Twitch chat integration                                      |
| Zalo           | `zalo`           | Zalo OA integration                                          |
| Zalo User      | `zalouser`       | Zalo user-level integration                                  |

#### Memory Backends (2 extensions)

| Extension      | ID               | Description                                        |
| -------------- | ---------------- | -------------------------------------------------- |
| Memory Core    | `memory-core`    | Default SQLite-based memory storage (default slot) |
| Memory LanceDB | `memory-lancedb` | LanceDB vector-based memory with semantic search   |

These participate in the exclusive `"memory"` slot. Only one can be active at a time.

#### Authentication Providers (5 extensions)

| Extension               | ID                        | Description                             |
| ----------------------- | ------------------------- | --------------------------------------- |
| Copilot Proxy           | `copilot-proxy`           | GitHub Copilot API authentication proxy |
| Google Antigravity Auth | `google-antigravity-auth` | Google AI Antigravity authentication    |
| Google Gemini CLI Auth  | `google-gemini-cli-auth`  | Google Gemini CLI authentication        |
| Minimax Portal Auth     | `minimax-portal-auth`     | Minimax AI portal authentication        |
| Qwen Portal Auth        | `qwen-portal-auth`        | Qwen AI portal authentication           |

#### Cognitive System (1 extension)

| Extension | ID      | Description                                                                   |
| --------- | ------- | ----------------------------------------------------------------------------- |
| MABOS     | `mabos` | Full BDI cognitive system — 99 tools, 21 modules, heartbeat service, REST API |

See [Section 21](#21-mabos-as-reference-implementation) for a detailed breakdown.

#### Voice and Phone (3 extensions)

| Extension     | ID              | Description                     |
| ------------- | --------------- | ------------------------------- |
| Voice Call    | `voice-call`    | Voice call handling             |
| Talk Voice    | `talk-voice`    | Voice synthesis and recognition |
| Phone Control | `phone-control` | Phone call control              |

#### Infrastructure (6+ extensions)

| Extension        | ID                 | Description                               |
| ---------------- | ------------------ | ----------------------------------------- |
| Diagnostics OTEL | `diagnostics-otel` | OpenTelemetry diagnostics and tracing     |
| Device Pair      | `device-pair`      | Device pairing and management             |
| LLM Task         | `llm-task`         | LLM task orchestration                    |
| Lobster          | `lobster`          | Advanced orchestration capabilities       |
| Open Prose       | `open-prose`       | Prose generation and editing tools        |
| Shared           | `shared`           | Shared utilities and common functionality |
| Thread Ownership | `thread-ownership` | Thread ownership and routing management   |

---

## 20. Extension Development Guide

This section provides patterns and guidance for building new extensions.

### Minimal Extension

```typescript
// extensions/my-extension/index.ts
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

export default {
  id: "my-extension",
  name: "My Extension",
  version: "0.1.0",
  register(api: OpenClawPluginApi) {
    // Registration logic here
  },
};
```

### Pattern: Channel Extension

```typescript
// extensions/my-channel/index.ts
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { channelPlugin, setChannelRuntime } from "./channel";

export default {
  id: "my-channel",
  name: "My Channel",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    // Wire the runtime into the channel module
    setChannelRuntime(api.runtime);

    // Register the channel plugin
    api.registerChannel({ plugin: channelPlugin });

    // Optionally handle subagent configuration
    api.registerHook("subagent_spawning", async (payload) => {
      // Customize subagent config for this channel
      return payload;
    });
  },
};
```

### Pattern: Tool Extension

```typescript
// extensions/my-tools/index.ts
export default {
  id: "my-tools",
  name: "My Tools",
  register(api) {
    api.registerTool({
      name: "analyze_data",
      description: "Analyze a dataset and return insights",
      parameters: {
        type: "object",
        properties: {
          dataPath: { type: "string", description: "Path to the dataset" },
          format: { type: "string", enum: ["csv", "json", "parquet"] },
        },
        required: ["dataPath"],
      },
      execute: async (args, context) => {
        const data = await loadDataset(args.dataPath, args.format);
        const analysis = await runAnalysis(data);
        return { insights: analysis.summary, metrics: analysis.metrics };
      },
    });

    api.registerTool({
      name: "generate_chart",
      description: "Generate a chart from analyzed data",
      parameters: {
        type: "object",
        properties: {
          data: { type: "object", description: "Chart data" },
          chartType: { type: "string", enum: ["bar", "line", "scatter"] },
        },
        required: ["data", "chartType"],
      },
      execute: async (args, context) => {
        const chart = await renderChart(args.data, args.chartType);
        return { chartUrl: chart.url };
      },
    });
  },
};
```

### Pattern: Service Extension

```typescript
// extensions/my-service/index.ts
export default {
  id: "my-service",
  name: "My Background Service",
  register(api) {
    let intervalHandle: NodeJS.Timeout;

    api.registerService({
      name: "data-sync",
      start: async () => {
        // Perform initial sync
        await performFullSync();

        // Schedule periodic sync
        intervalHandle = setInterval(async () => {
          await performIncrementalSync();
        }, 60_000); // every minute
      },
      stop: async () => {
        clearInterval(intervalHandle);
        await flushPendingWrites();
      },
    });
  },
};
```

### Pattern: Hook Extension

```typescript
// extensions/my-hooks/index.ts
export default {
  id: "my-hooks",
  name: "My Hook Extension",
  register(api) {
    // Inject custom context into every prompt
    api.on("before_prompt_build", async ({ systemPrompt, context }) => {
      const customContext = await loadCustomContext();
      return {
        systemPrompt: systemPrompt + "\n\n" + customContext,
        context,
      };
    });

    // Log all tool calls
    api.registerHook(
      "after_tool_call",
      async (payload) => {
        console.log(`Tool called: ${payload.toolName}`, payload.args);
        return payload;
      },
      0,
    ); // low priority — runs after most other handlers

    // Filter outgoing messages
    api.on("message_sending", async ({ message, channel }) => {
      const filtered = await applyContentPolicy(message);
      return { message: filtered, channel };
    });
  },
};
```

### Pattern: HTTP API Extension

```typescript
// extensions/my-api/index.ts
export default {
  id: "my-api",
  name: "My API Extension",
  register(api) {
    // REST endpoint
    api.registerHttpHandler("GET", "/api/my-data", async (req, res) => {
      const data = await fetchData(req.query);
      res.json({ data });
    });

    // Webhook receiver
    api.registerHttpHandler("POST", "/webhooks/my-service", async (req, res) => {
      const signature = req.headers["x-signature"];
      if (!verifySignature(req.body, signature)) {
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
      await processWebhook(req.body);
      res.status(200).json({ ok: true });
    });

    // Route metadata for documentation
    api.registerHttpRoute({
      method: "GET",
      path: "/api/my-data",
      description: "Fetch data from the custom data store",
      auth: "bearer",
    });
  },
};
```

### Pattern: Combined Extension

A plugin can combine multiple patterns:

```typescript
export default {
  id: "full-featured",
  name: "Full-Featured Extension",
  configSchema: {
    type: "object",
    properties: {
      apiEndpoint: { type: "string" },
      syncInterval: { type: "number", default: 60 },
    },
    required: ["apiEndpoint"],
  },
  register(api) {
    // Tools
    api.registerTool({ name: "feature_search" /* ... */ });
    api.registerTool({ name: "feature_create" /* ... */ });

    // Hooks
    api.on("before_prompt_build", promptInjector);
    api.on("after_tool_call", auditLogger);

    // Service
    api.registerService({ name: "feature-sync" /* ... */ });

    // HTTP
    api.registerHttpHandler("GET", "/api/features", listFeatures);
    api.registerHttpHandler("POST", "/api/features", createFeature);

    // Commands
    api.registerCommand({ name: "features" /* ... */ });

    // CLI
    api.registerCli((program) => {
      program
        .command("features")
        .description("Manage features from the CLI")
        .action(handleFeaturesCommand);
    });
  },
};
```

### Installation Methods

Extensions can be installed via several methods (handled by `install.ts`):

1. **Local directory:** Place the extension in `.openclaw/extensions/` or `~/.config/openclaw/extensions/`.
2. **npm package:** `openclaw install @scope/plugin-name` (downloads and installs from npm).
3. **Archive:** `openclaw install ./plugin.tar.gz` (extracts and installs).
4. **Symlink (development):** Symlink the extension directory into an extensions directory. The uninstaller (`uninstall.ts`) will never delete symlinked plugins.

### Configuration

Extensions with a `configSchema` receive validated configuration at load time. The configuration can be set in:

- Workspace config: `.openclaw/config.json`
- Global config: `~/.config/openclaw/config.json`

```json
{
  "plugins": {
    "config": {
      "my-extension": {
        "apiEndpoint": "https://api.example.com",
        "syncInterval": 120
      }
    }
  }
}
```

---

## 21. MABOS as Reference Implementation

The MABOS extension (`index.ts`, 3270 lines) is the most comprehensive extension in the OpenClaw ecosystem. It demonstrates full utilization of the plugin API and serves as the definitive reference for building complex extensions.

### Registration Overview

MABOS uses every major registration method:

```
registerTool()          x99  (across 21+ modules)
registerHook()          x3+  (prompt build, tool audit, lifecycle)
registerService()       x1   (BDI heartbeat)
registerHttpHandler()   x20+ (REST API endpoints)
registerHttpRoute()     x20+ (route metadata)
registerCli()           x1   (CLI subcommands)
```

### Tool Organization (99 Tools, 21+ Modules)

MABOS organizes its 99 tools across functional modules:

| Module               | Tool Count | Description                                                |
| -------------------- | ---------- | ---------------------------------------------------------- |
| Goal Management      | ~8         | Create, update, decompose, prioritize BDI goals            |
| Belief Management    | ~6         | Query, assert, retract beliefs in the knowledge base       |
| Intention Management | ~5         | Create, schedule, monitor agent intentions                 |
| Plan Management      | ~6         | Define, select, execute BDI plans                          |
| Desire Management    | ~4         | Manage agent desires and preference ordering               |
| Context Analysis     | ~5         | Analyze situational context and environmental state        |
| Task Execution       | ~6         | Execute multi-step tasks with progress tracking            |
| Knowledge Graph      | ~8         | Query and manipulate the TypeDB knowledge graph            |
| Persona System       | ~4         | Manage agent personas and personality profiles             |
| Memory Integration   | ~5         | Deep memory search, episodic recall, memory consolidation  |
| Communication        | ~4         | Inter-agent messaging and coordination                     |
| Reasoning            | ~5         | Logical inference, abductive reasoning, hypothesis testing |
| Learning             | ~4         | Skill acquisition, experience recording                    |
| Emotional Model      | ~3         | Emotional state tracking and regulation                    |
| Social Model         | ~3         | Social relationship management                             |
| Temporal Reasoning   | ~4         | Time-based planning and scheduling                         |
| Spatial Reasoning    | ~3         | Spatial awareness and navigation                           |
| Meta-Cognition       | ~4         | Self-reflection and strategy adjustment                    |
| Resource Management  | ~3         | Resource allocation and constraint satisfaction            |
| Event Processing     | ~4         | Event detection, correlation, and response                 |
| Audit & Compliance   | ~3         | Audit trail and compliance reporting                       |

### BDI Heartbeat Service

The heartbeat service is the core of the MABOS cognitive loop:

```typescript
api.registerService({
  name: "bdi-heartbeat",
  start: async () => {
    // Initialize TypeDB connection
    await initializeTypeDB();

    // Start the cognitive loop
    heartbeatInterval = setInterval(async () => {
      // 1. Process the intention queue
      await processIntentionQueue();

      // 2. Evaluate goal progress
      await evaluateGoalProgress();

      // 3. Update belief state from environment
      await updateBeliefState();

      // 4. Deliberate on new desires
      await deliberateDesires();

      // 5. Generate new intentions from plans
      await generateIntentions();
    }, 30_000);
  },
  stop: async () => {
    clearInterval(heartbeatInterval);
    await flushAuditTrail();
    await closeTypeDB();
  },
});
```

### HTTP REST API

MABOS exposes a comprehensive REST API via `registerHttpHandler()`:

```
GET    /api/v1/goals           List all goals
POST   /api/v1/goals           Create a new goal
GET    /api/v1/goals/:id       Get goal by ID
PUT    /api/v1/goals/:id       Update a goal
DELETE /api/v1/goals/:id       Delete a goal

GET    /api/v1/beliefs         Query beliefs
POST   /api/v1/beliefs         Assert a belief
DELETE /api/v1/beliefs/:id     Retract a belief

GET    /api/v1/intentions      List active intentions
POST   /api/v1/intentions      Create an intention
GET    /api/v1/plans           List available plans
GET    /api/v1/audit           Query audit trail

GET    /api/v1/dashboard/sse   SSE stream for real-time dashboard events
GET    /api/v1/status          System status
POST   /api/v1/heartbeat       Trigger manual heartbeat cycle
```

### Gateway Authentication

MABOS sets up gateway authentication for its HTTP routes:

```typescript
api.registerHttpHandler("POST", "/auth/mabos", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!(await validateMABOSToken(token))) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  // Token valid — proceed
  req.mabosAuth = { validated: true };
});
```

### Prompt Injection via Hook

MABOS uses `before_prompt_build` to inject the active persona and goal context into every agent interaction:

```typescript
api.registerHook(
  "before_prompt_build",
  async ({ systemPrompt, context }) => {
    const persona = await getActivePersona();
    const goals = await getActiveGoals();
    const beliefs = await getRelevantBeliefs(context);

    const injection = [
      `## Active Persona: ${persona.name}`,
      persona.instructions,
      `## Active Goals`,
      goals.map((g) => `- [${g.priority}] ${g.description}`).join("\n"),
      `## Relevant Beliefs`,
      beliefs.map((b) => `- ${b.content}`).join("\n"),
    ].join("\n\n");

    return {
      systemPrompt: systemPrompt + "\n\n" + injection,
      context,
    };
  },
  50,
);
```

### BDI Audit Trail via Hook

MABOS uses `after_tool_call` to record every tool execution in the BDI audit trail:

```typescript
api.registerHook(
  "after_tool_call",
  async (payload) => {
    await recordAuditEntry({
      timestamp: Date.now(),
      toolName: payload.toolName,
      args: payload.args,
      result: payload.result,
      activeGoals: await getActiveGoalIds(),
      activeIntention: await getCurrentIntention(),
    });
    return payload;
  },
  10,
);
```

### CLI Subcommands

```typescript
api.registerCli((program) => {
  const mabos = program.command("mabos").description("MABOS cognitive system management");

  mabos
    .command("goals")
    .description("List active BDI goals")
    .action(async () => {
      /* ... */
    });

  mabos
    .command("heartbeat")
    .description("Trigger a manual heartbeat cycle")
    .action(async () => {
      /* ... */
    });

  mabos
    .command("status")
    .description("Show MABOS system status")
    .action(async () => {
      /* ... */
    });
});
```

### SSE Streaming

MABOS provides Server-Sent Events for real-time dashboard updates:

```typescript
api.registerHttpHandler("GET", "/api/v1/dashboard/sse", async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const listener = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  api.runtime.events.on("mabos:state-change", listener);

  req.on("close", () => {
    api.runtime.events.off("mabos:state-change", listener);
  });
});
```

### TypeDB Integration

MABOS initializes a TypeDB connection during service startup for its knowledge graph:

```typescript
// During service start
const typedbClient = await TypeDB.coreClient("localhost:1729");
const session = await typedbClient.session("mabos", SessionType.DATA);
```

All knowledge graph tools (beliefs, goals, intentions, plans) operate through this TypeDB session, providing ACID-compliant graph database operations for the BDI architecture.

---

## 22. File Inventory

All 80 TypeScript files in `src/plugins/`, organized by subsystem.

### Core Infrastructure (9 files)

| File                   | Lines | Purpose                                                         |
| ---------------------- | ----- | --------------------------------------------------------------- |
| `discovery.ts`         | ~250  | Plugin discovery from 4 origins with security checks            |
| `loader.ts`            | ~400  | Main loading orchestrator — discovery through registration      |
| `registry.ts`          | ~300  | Central plugin registry and API factory                         |
| `manifest.ts`          | ~150  | Manifest file loading and validation                            |
| `manifest-registry.ts` | ~180  | Builds manifest registry with duplicate detection               |
| `types.ts`             | ~500  | Full type system — OpenClawPluginApi, definitions, all 24 hooks |
| `config-schema.ts`     | ~120  | Plugin config schema validation (AJV-based)                     |
| `config-state.ts`      | ~200  | Enable/disable state normalization and origin precedence        |
| `schema-validator.ts`  | ~100  | JSON Schema validation with compiled schema caching             |

### Hook System (2 files)

| File                    | Lines | Purpose                                                           |
| ----------------------- | ----- | ----------------------------------------------------------------- |
| `hooks.ts`              | ~350  | Core hook runner — void, modifying, and sync execution strategies |
| `hook-runner-global.ts` | ~50   | Global singleton hook runner instance                             |

### Plugin Lifecycle (4 files)

| File           | Lines | Purpose                                                               |
| -------------- | ----- | --------------------------------------------------------------------- |
| `install.ts`   | ~300  | Install from archives, directories, files, npm with security scanning |
| `installs.ts`  | ~100  | Install metadata tracking and persistence                             |
| `uninstall.ts` | ~120  | Remove plugins (never deletes linked/symlinked plugins)               |
| `update.ts`    | ~150  | Update npm-installed plugins to latest versions                       |
| `enable.ts`    | ~80   | Enable plugins in configuration                                       |

### Registration Subsystems (7 files)

| File               | Lines | Purpose                                                      |
| ------------------ | ----- | ------------------------------------------------------------ |
| `tools.ts`         | ~200  | Tool resolution with conflict detection and allowlisting     |
| `services.ts`      | ~150  | Service lifecycle — sequential start, reverse-order stop     |
| `http-registry.ts` | ~130  | HTTP route registration with deduplication                   |
| `http-path.ts`     | ~60   | HTTP path normalization rules                                |
| `slots.ts`         | ~120  | Exclusive slot system (memory slot arbitration)              |
| `providers.ts`     | ~80   | Provider plugin resolution                                   |
| `commands.ts`      | ~200  | Slash command registry with auth gating and arg sanitization |

### Runtime (3 files)

| File                     | Lines | Purpose                                             |
| ------------------------ | ----- | --------------------------------------------------- |
| `runtime/index.ts`       | ~400  | Creates PluginRuntime with all subsystem references |
| `runtime/types.ts`       | ~250  | Runtime type definitions for all exposed subsystems |
| `runtime/native-deps.ts` | ~80   | Native dependency install hints                     |

### Utilities (5 files)

| File                | Lines | Purpose                                     |
| ------------------- | ----- | ------------------------------------------- |
| `bundled-dir.ts`    | ~40   | Resolves the bundled plugins directory path |
| `cli.ts`            | ~100  | Plugin CLI command registration             |
| `logger.ts`         | ~60   | Plugin-scoped logger factory                |
| `path-safety.ts`    | ~80   | Path containment and safe realpath          |
| `source-display.ts` | ~40   | Plugin source path formatting for display   |
| `status.ts`         | ~120  | Plugin status diagnostics and health checks |

### Bundled Extensions (41 directories)

Each extension directory typically contains:

- `index.ts` — Plugin definition with `register()` function
- Additional TypeScript modules for the extension's logic
- `openclaw.plugin.json` or `package.json` with `openclaw` key
- Optional asset files (templates, schemas, etc.)

Notable extension sizes:

- `mabos/index.ts` — 3270 lines (flagship cognitive system)
- Channel extensions — typically 200-800 lines each
- Auth providers — typically 100-300 lines each
- Memory backends — typically 300-600 lines each

---

## 23. Data Flow Diagrams

### Plugin Lifecycle Flow

```
                    +-----------+
                    |  Platform |
                    |  Startup  |
                    +-----+-----+
                          |
                    +-----v-----+
                    | Discovery |
                    | (4 origins)|
                    +-----+-----+
                          |
               +----------+----------+
               |                     |
        +------v------+    +--------v--------+
        |  Manifest   |    |  Enable State   |
        |  Registry   |    |  Resolution     |
        +------+------+    +--------+--------+
               |                     |
               +----------+----------+
                          |
                    +-----v-----+
                    |  Config   |
                    |  Schema   |
                    | Validation|
                    +-----+-----+
                          |
                    +-----v-----+
                    |  jiti     |
                    |  Module   |
                    |  Loading  |
                    +-----+-----+
                          |
                    +-----v-----+
                    | register()|
                    | / activate|
                    | called    |
                    +-----+-----+
                          |
         +----------------+----------------+
         |        |       |       |        |
     +---v---+ +--v--+ +-v--+ +--v--+ +---v---+
     | Tools | |Hooks| |HTTP| |Svc  | |Channel|
     +-------+ +-----+ +----+ +-----+ +-------+
                          |
                    +-----v-----+
                    |  Slot     |
                    | Selection |
                    +-----+-----+
                          |
                    +-----v-----+
                    |  Plugin   |
                    |  Ready    |
                    +-----------+
```

### Hook Execution Flow (Modifying Hook)

```
                    +----------+
                    |  Event   |
                    |  Source  |
                    +----+-----+
                         |
                   +-----v------+
                   | runModifying|
                   | Hook()     |
                   +-----+------+
                         |
              +----------+-----------+
              |     Sort by priority |
              |     (high to low)    |
              +----------+-----------+
                         |
                   +-----v------+
                   | Handler A  |  priority: 100
                   | (plugin-1) |
                   +-----+------+
                         |
                   +-----v------+
                   | merge()    |
                   +-----+------+
                         |
                   +-----v------+
                   | Handler B  |  priority: 50
                   | (plugin-2) |
                   +-----+------+
                         |
                   +-----v------+
                   | merge()    |
                   +-----+------+
                         |
                   +-----v------+
                   | Handler C  |  priority: 10
                   | (plugin-3) |
                   +-----+------+
                         |
                   +-----v------+
                   | merge()    |
                   +-----+------+
                         |
                   +-----v------+
                   | Final      |
                   | Payload    |
                   +------------+
```

### Hook Execution Flow (Void Hook)

```
                    +----------+
                    |  Event   |
                    |  Source  |
                    +----+-----+
                         |
                   +-----v------+
                   | runVoidHook|
                   +-----+------+
                         |
            +------------+------------+
            |            |            |
      +-----v-----+ +---v-----+ +---v-----+
      | Handler A | | Handler B| | Handler C|
      | (async)   | | (async)  | | (async)  |
      +-----+-----+ +----+----+ +----+-----+
            |             |           |
            +------+------+-----------+
                   |
            Promise.all()
                   |
             +-----v-----+
             |   Done     |
             +-----------+
```

### Tool Resolution Flow

```
              +------------------+
              | Agent Context    |
              | Assembly         |
              +--------+---------+
                       |
              +--------v---------+
              | resolvePlugin    |
              | Tools()          |
              +--------+---------+
                       |
              +--------v---------+
              | Plugins enabled? |---NO---> return []
              +--------+---------+
                       |YES
              +--------v---------+
              | Collect all      |
              | registry.tools   |
              +--------+---------+
                       |
              +--------v---------+
              | Apply allowlist  |
              | (group:plugins   |
              |  or individual)  |
              +--------+---------+
                       |
              +--------v---------+
              | Conflict check   |
              | vs core tools    |
              +--------+---------+
                       |
              +--------v---------+
              | Conflict check   |
              | between plugins  |
              +--------+---------+
                       |
              +--------v---------+
              | Return resolved  |
              | tool array       |
              +------------------+
```

### Service Lifecycle Flow

```
       STARTUP                              SHUTDOWN
       =======                              ========

  +-------------+                      +-------------+
  | Service A   |                      | Service C   |
  | start()     |                      | stop()      |
  +------+------+                      +------+------+
         |                                    |
  +------v------+                      +------v------+
  | Service B   |                      | Service B   |
  | start()     |                      | stop()      |
  +------+------+                      +------+------+
         |                                    |
  +------v------+                      +------v------+
  | Service C   |                      | Service A   |
  | start()     |                      | stop()      |
  +------+------+                      +------+------+
         |                                    |
    Sequential                           Reverse order
    (dependencies)                       (clean teardown)
```

---

## 24. Configuration

### Plugin Configuration File

Plugin behavior is controlled through the main configuration file (`.openclaw/config.json` or `~/.config/openclaw/config.json`):

```json
{
  "plugins": {
    "loadPaths": ["/custom/plugin/directory", "/another/plugin/path"],
    "enabled": {
      "discord": true,
      "slack": true,
      "mabos": true,
      "memory-lancedb": true
    },
    "disabled": {
      "irc": true,
      "nostr": true
    },
    "slots": {
      "memory": "memory-lancedb"
    },
    "config": {
      "mabos": {
        "typedbHost": "localhost",
        "typedbPort": 1729,
        "heartbeatInterval": 30000
      },
      "discord": {
        "token": "BOT_TOKEN",
        "guildId": "GUILD_ID"
      }
    },
    "tools": {
      "allowlist": ["group:plugins", "search_knowledge_base", "mabos"]
    }
  }
}
```

### Configuration Precedence

Configuration is resolved with the following precedence (highest to lowest):

1. **Explicit per-plugin enable/disable** in `plugins.enabled` / `plugins.disabled`
2. **Workspace-level configuration** (`.openclaw/config.json`)
3. **Global-level configuration** (`~/.config/openclaw/config.json`)
4. **Default values** (bundled plugins enabled, others disabled)

### Load Paths

The `plugins.loadPaths` array specifies additional directories to scan for plugins. These are scanned as the `config` origin (highest priority).

```json
{
  "plugins": {
    "loadPaths": ["/home/user/my-plugins", "/shared/team-plugins"]
  }
}
```

### Tool Allowlisting

The `plugins.tools.allowlist` controls which plugin tools are available to the LLM:

- `"group:plugins"` — Allow all tools from all plugins.
- `"plugin-id"` — Allow all tools from a specific plugin.
- `"tool_name"` — Allow a specific tool by name.

If no allowlist is configured, no plugin tools are available (secure by default).

### Slot Configuration

The `plugins.slots` object maps slot names to the plugin ID that should fill each slot:

```json
{
  "plugins": {
    "slots": {
      "memory": "memory-lancedb"
    }
  }
}
```

### Enable/Disable State

Plugins can be enabled or disabled in several formats:

**Boolean map:**

```json
{
  "plugins": {
    "enabled": { "discord": true, "slack": true },
    "disabled": { "irc": true }
  }
}
```

**Array shorthand:**

```json
{
  "plugins": {
    "enabled": ["discord", "slack"],
    "disabled": ["irc"]
  }
}
```

The `config-state.ts` module normalizes all representations into a consistent internal format.

---

## 25. Diagnostics and Troubleshooting

### Plugin Status

The `status.ts` module provides diagnostic information about loaded plugins:

```typescript
function getPluginStatus(registry: PluginRegistry): PluginStatusReport;
```

The status report includes:

- All loaded plugins with their status (`loaded`, `failed`, `disabled`)
- Registered capabilities per plugin (tools, hooks, channels, etc.)
- Configuration validation results
- Slot assignments
- Discovery origin for each plugin

### Diagnostic Messages

Throughout the loading pipeline, diagnostic messages are collected:

```typescript
interface PluginDiagnostic {
  level: "info" | "warn" | "error";
  pluginId: string;
  message: string;
  details?: any;
}
```

Common diagnostics:

| Level   | Message                  | Cause                                           |
| ------- | ------------------------ | ----------------------------------------------- |
| `warn`  | Duplicate plugin ID      | Two origins provide same plugin ID              |
| `warn`  | Untracked plugin         | Plugin registered no capabilities               |
| `warn`  | Suspicious UID ownership | Plugin files owned by unexpected user           |
| `error` | Config validation failed | Plugin config does not match schema             |
| `error` | Module load failed       | TypeScript compilation or import error          |
| `error` | Tool name conflict       | Plugin tool name collides with core tool        |
| `error` | Symlink escape           | Plugin symlink points outside allowed directory |
| `error` | World-writable path      | Plugin directory is world-writable              |
| `info`  | Slot selection           | Plugin selected for exclusive slot              |
| `info`  | Plugin disabled          | Plugin explicitly disabled in config            |

### Source Display

The `source-display.ts` module formats plugin source paths for human-readable output:

```
bundled:discord        (built-in)
workspace:my-plugin    (.openclaw/extensions/my-plugin)
global:custom-tool     (~/.config/openclaw/extensions/custom-tool)
config:vendor-plugin   (/custom/path/vendor-plugin)
```

### Common Troubleshooting

**Plugin not loading:**

1. Check discovery — is the plugin in a scanned directory?
2. Check enable state — is the plugin explicitly disabled?
3. Check config schema — does the config pass validation?
4. Check module syntax — does the TypeScript compile?
5. Check export — does the module export `register` or `activate`?

**Tool not available:**

1. Check tool allowlist — is the tool or its plugin allowlisted?
2. Check for name conflicts — does the tool name collide with a core tool?
3. Check plugin status — is the plugin loaded successfully?

**Service not starting:**

1. Check plugin load status — service registration requires successful loading.
2. Check startup order — does the service depend on another that failed?
3. Check error isolation — examine diagnostic messages for the service.

**Slot conflicts:**

1. Check slot configuration — which plugin is selected for the slot?
2. Check for multiple `kind: "memory"` plugins — only one can be active.
3. Verify the selected plugin is enabled and loaded.

---

## 26. References to Companion Documents

This document is part of a comprehensive documentation suite for the OpenClaw-MABOS platform. Related documents cover:

- **System Architecture Overview** — High-level platform architecture, subsystem boundaries, and deployment topology.
- **Agent Runtime Documentation** — The LLM agent loop, message processing, compaction, and tool execution.
- **Channel Integration Guide** — Detailed setup instructions for each supported messaging platform.
- **MABOS BDI Architecture** — Deep dive into the Belief-Desire-Intention cognitive architecture, TypeDB schema, and heartbeat loop.
- **Gateway Server Documentation** — HTTP server configuration, middleware, authentication, and routing.
- **Memory System Documentation** — Memory storage backends, semantic search, and memory lifecycle.
- **Security Model** — Platform-wide security architecture, authentication, authorization, and threat model.
- **CLI Reference** — Command-line interface documentation for all built-in and plugin-provided commands.
- **Configuration Reference** — Complete configuration schema documentation with all options and defaults.
- **API Reference** — TypeScript API documentation generated from source types.

---

_This document describes the OpenClaw-MABOS plugin system as implemented in the `src/plugins/` directory. It is intended to be the definitive reference for understanding, extending, and maintaining the plugin infrastructure._
