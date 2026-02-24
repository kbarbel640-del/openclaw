/**
 * ConfigCenter — tabbed configuration editor for the OpenClaw settings file.
 *
 * Tabs:
 *   General    — logging, update channel, diagnostics
 *   Gateway    — port, bind, auth mode, TLS, rate limiting
 *   Agents     — model defaults, maxTurns, temperature, tools
 *   Skills     — allowed bundles, install prefs, skill entries
 *   Security   — hardening flags (from security schema)
 *   JSON       — raw JSON editor with validation + diff view
 *
 * All writes go through elevation (re-auth). Reads are always live.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../App.js";
import { FormField, ConfigSection } from "./FormField.js";
import { JsonEditor } from "./JsonEditor.js";
import type { OcccBridge } from "../../../shared/ipc-types.js";

const occc = (window as unknown as { occc: OcccBridge }).occc;

type ConfigTab = "general" | "gateway" | "agents" | "skills" | "security" | "json";

const TABS: { id: ConfigTab; label: string; icon: string }[] = [
  { id: "general", label: "General", icon: "⚙" },
  { id: "gateway", label: "Gateway", icon: "◈" },
  { id: "agents", label: "Agents", icon: "◎" },
  { id: "skills", label: "Skills", icon: "◆" },
  { id: "security", label: "Security", icon: "🛡" },
  { id: "json", label: "JSON", icon: "{}" },
];

interface ValidationError { path: string; message: string }

export function ConfigCenter() {
  const { token, requireElevation } = useAuth();
  const [activeTab, setActiveTab] = useState<ConfigTab>("general");
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [checksum, setChecksum] = useState<string>("");
  const [configPath, setConfigPath] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ─── Load config ───────────────────────────────────────────────────

  const loadConfig = useCallback(async () => {
    if (!token) {return;}
    setLoading(true);
    try {
      const [result, cpath] = await Promise.all([
        occc.invoke("occc:config:read", token),
        occc.invoke("occc:config:path", token),
      ]) as [{ config?: Record<string, unknown>; checksum?: string }, string];
      setConfig(result.config ?? {});
      setChecksum(result.checksum ?? "");
      setConfigPath(cpath ?? "");
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Failed to load configuration");
    } finally {
      setLoading(false);
      setDirty(false);
    }
  }, [token]);

  useEffect(() => { void loadConfig(); }, [loadConfig]);

  // ─── Deep update helper ────────────────────────────────────────────

  const update = useCallback((path: string[], value: unknown) => {
    setConfig((prev) => {
      const next = { ...prev };
      let cur: Record<string, unknown> = next;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        cur[key] = cur[key] && typeof cur[key] === "object" ? { ...(cur[key] as Record<string, unknown>) } : {};
        cur = cur[key] as Record<string, unknown>;
      }
      const lastKey = path[path.length - 1];
      if (value === undefined || value === "") {
        delete cur[lastKey];
      } else {
        cur[lastKey] = value;
      }
      return next;
    });
    setDirty(true);
    setSaveError(null);
    setSaveSuccess(false);
  }, []);

  // ─── Save ──────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!token || !dirty) {return;}

    // Validate before saving
    try {
      const validation = await occc.invoke("occc:config:validate", token, config) as { valid: boolean; errors?: ValidationError[] };
      if (!validation.valid) {
        setValidationErrors(validation.errors ?? []);
        setSaveError(`${validation.errors?.length ?? 0} validation error(s). Fix them before saving.`);
        return;
      }
      setValidationErrors([]);
    } catch {
      // Validation unavailable — proceed without it
    }

    // Require elevation
    const elevated = await requireElevation("edit OpenClaw configuration");
    if (!elevated) {return;}

    setSaving(true);
    setSaveError(null);
    try {
      const result = await occc.invoke("occc:config:write", token, config, checksum) as { ok: boolean; error?: string; checksum: string };
      if (!result.ok) {
        setSaveError(result.error ?? "Save failed");
        return;
      }
      setChecksum(result.checksum);
      setDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [token, dirty, config, checksum, requireElevation]);

  const handleDiscard = useCallback(() => {
    void loadConfig();
  }, [loadConfig]);

  // ─── Render ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  const errorsOnTab = (tab: ConfigTab) =>
    validationErrors.filter((e) => e.path.startsWith(TAB_PATH_PREFIX[tab] ?? tab)).length;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h1>Configuration</h1>
            <p style={{ fontSize: "12px", color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", marginTop: "4px" }}>
              {configPath}
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {saveSuccess && (
              <span style={{ fontSize: "13px", color: "var(--accent-success)" }}>✓ Saved</span>
            )}
            {dirty && (
              <>
                <button style={btnSecondary} onClick={handleDiscard} disabled={saving}>
                  Discard
                </button>
                <button style={btnPrimary} onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </>
            )}
          </div>
        </div>
        {saveError && (
          <div style={{ marginTop: "12px", padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", fontSize: "13px", color: "var(--accent-danger)" }}>
            {saveError}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0" }}>
        {TABS.map((tab) => {
          const errCount = errorsOnTab(tab.id);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: "none",
                border: "none",
                borderBottom: activeTab === tab.id ? "2px solid var(--accent-primary)" : "2px solid transparent",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id ? "var(--accent-primary-hover)" : "var(--text-secondary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 150ms",
                marginBottom: "-1px",
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {errCount > 0 && (
                <span style={{ background: "var(--accent-danger)", color: "white", borderRadius: "10px", padding: "1px 6px", fontSize: "10px" }}>
                  {errCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ maxWidth: "760px" }}>
        {activeTab === "general" && (
          <GeneralTab config={config} update={update} errors={validationErrors} />
        )}
        {activeTab === "gateway" && (
          <GatewayTab config={config} update={update} errors={validationErrors} />
        )}
        {activeTab === "agents" && (
          <AgentsTab config={config} update={update} errors={validationErrors} />
        )}
        {activeTab === "skills" && (
          <SkillsTab config={config} update={update} errors={validationErrors} />
        )}
        {activeTab === "security" && (
          <SecurityTab config={config} update={update} errors={validationErrors} />
        )}
        {activeTab === "json" && (
          <JsonEditor
            config={config}
            onChange={(next) => { setConfig(next); setDirty(true); }}
            validationErrors={validationErrors}
          />
        )}
      </div>
    </div>
  );
}

// ─── Path prefix per tab for error filtering ──────────────────────────────

const TAB_PATH_PREFIX: Partial<Record<ConfigTab, string>> = {
  general: "logging",
  gateway: "gateway",
  agents: "agents",
  skills: "skills",
  security: "security",
};

/** Safely get a nested config section as a typed record. */
function cfgGet(config: Record<string, unknown>, key: string): Record<string, unknown> {
  const v = config[key];
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

// ─── General Tab ──────────────────────────────────────────────────────────

function GeneralTab({ config, update, errors }: TabProps) {
  const logging = cfgGet(config, "logging");
  const update_ = cfgGet(config, "update");
  const diagnostics = cfgGet(config, "diagnostics");

  const err = (path: string) => errors.find((e) => e.path === path)?.message;

  return (
    <>
      <ConfigSection title="Logging" icon="📋">
        <FormField
          label="Log Level"
          description="Verbosity of the OpenClaw gateway logs."
          value={logging.level}
          type={{ kind: "enum", options: ["silent", "fatal", "error", "warn", "info", "debug", "trace"] }}
          onChange={(v) => update(["logging", "level"], v)}
          error={err("logging.level")}
        />
        <FormField
          label="Console Style"
          description="Output format for the console log."
          value={logging.consoleStyle}
          type={{ kind: "enum", options: ["pretty", "compact", "json"] }}
          onChange={(v) => update(["logging", "consoleStyle"], v)}
        />
        <FormField
          label="Redact Sensitive Data"
          description="Redact sensitive values from tool call logs."
          value={logging.redactSensitive === "tools"}
          type={{ kind: "boolean" }}
          onChange={(v) => update(["logging", "redactSensitive"], v ? "tools" : "off")}
        />
      </ConfigSection>

      <ConfigSection title="Updates" icon="🔄">
        <FormField
          label="Update Channel"
          description="Which release channel to receive updates from."
          value={update_.channel}
          type={{ kind: "enum", options: ["stable", "beta", "dev"] }}
          onChange={(v) => update(["update", "channel"], v)}
        />
        <FormField
          label="Check on Start"
          description="Automatically check for updates when OpenClaw starts."
          value={update_.checkOnStart ?? true}
          type={{ kind: "boolean" }}
          onChange={(v) => update(["update", "checkOnStart"], v)}
        />
      </ConfigSection>

      <ConfigSection title="Diagnostics" icon="🔬">
        <FormField
          label="Enable Diagnostics"
          description="Collect anonymous usage diagnostics to help improve OpenClaw."
          value={diagnostics.enabled ?? false}
          type={{ kind: "boolean" }}
          onChange={(v) => update(["diagnostics", "enabled"], v)}
        />
      </ConfigSection>
    </>
  );
}

// ─── Gateway Tab ─────────────────────────────────────────────────────────

function GatewayTab({ config, update, errors }: TabProps) {
  const gateway = cfgGet(config, "gateway");
  const auth = cfgGet(gateway, "auth");
  const tls = cfgGet(gateway, "tls");
  const rateLimit = cfgGet(auth, "rateLimit");
  const err = (path: string) => errors.find((e) => e.path === path)?.message;

  return (
    <>
      <ConfigSection title="Network" icon="🌐">
        <FormField
          label="Port"
          description="Port the OpenClaw gateway listens on."
          value={gateway.port ?? 18789}
          type={{ kind: "number", min: 1024, max: 65535 }}
          onChange={(v) => update(["gateway", "port"], v)}
          error={err("gateway.port")}
        />
        <FormField
          label="Bind Mode"
          description="Which network interface to bind to. Use 'loopback' for local-only access."
          value={gateway.bind}
          type={{ kind: "enum", options: ["auto", "loopback", "lan", "tailnet", "custom"] }}
          onChange={(v) => update(["gateway", "bind"], v)}
        />
      </ConfigSection>

      <ConfigSection title="Authentication" icon="🔑">
        <FormField
          label="Auth Mode"
          description="How clients authenticate to the gateway."
          value={auth.mode}
          type={{ kind: "enum", options: ["token", "password", "trusted-proxy"] }}
          onChange={(v) => update(["gateway", "auth", "mode"], v)}
        />
        {auth.mode === "token" && (
          <FormField
            label="Gateway Token"
            description="Secret token clients must present. Leave blank to auto-generate."
            value={auth.token ?? ""}
            type={{ kind: "string", sensitive: true, placeholder: "••••••••••••" }}
            onChange={(v) => update(["gateway", "auth", "token"], v)}
          />
        )}
        {auth.mode === "password" && (
          <FormField
            label="Gateway Password"
            description="Password for HTTP Basic auth."
            value={auth.password ?? ""}
            type={{ kind: "string", sensitive: true }}
            onChange={(v) => update(["gateway", "auth", "password"], v)}
          />
        )}
        <FormField
          label="Allow Tailscale Auth"
          description="Accept Tailscale identity tokens as authentication."
          value={auth.allowTailscale ?? false}
          type={{ kind: "boolean" }}
          onChange={(v) => update(["gateway", "auth", "allowTailscale"], v)}
        />
      </ConfigSection>

      <ConfigSection title="Rate Limiting" icon="🚦">
        <FormField
          label="Max Attempts"
          description="Failed auth attempts allowed before lockout."
          value={rateLimit.maxAttempts ?? 10}
          type={{ kind: "number", min: 1, max: 1000 }}
          onChange={(v) => update(["gateway", "auth", "rateLimit", "maxAttempts"], v)}
        />
        <FormField
          label="Lockout Duration (ms)"
          description="How long to lock out after too many failed attempts."
          value={rateLimit.lockoutMs ?? 900000}
          type={{ kind: "number", min: 1000 }}
          onChange={(v) => update(["gateway", "auth", "rateLimit", "lockoutMs"], v)}
        />
        <FormField
          label="Exempt Loopback"
          description="Skip rate limiting for localhost connections."
          value={rateLimit.exemptLoopback ?? true}
          type={{ kind: "boolean" }}
          onChange={(v) => update(["gateway", "auth", "rateLimit", "exemptLoopback"], v)}
        />
      </ConfigSection>

      <ConfigSection title="TLS" icon="🔒">
        <FormField
          label="Enable TLS"
          description="Serve the gateway over HTTPS."
          value={tls.enabled ?? false}
          type={{ kind: "boolean" }}
          onChange={(v) => update(["gateway", "tls", "enabled"], v)}
        />
        {Boolean(tls.enabled) && (
          <>
            <FormField
              label="Auto-Generate Certificate"
              description="Generate a self-signed certificate automatically."
              value={tls.autoGenerate ?? true}
              type={{ kind: "boolean" }}
              onChange={(v) => update(["gateway", "tls", "autoGenerate"], v)}
            />
            {!tls.autoGenerate && (
              <>
                <FormField
                  label="Certificate Path"
                  value={tls.certPath ?? ""}
                  type={{ kind: "string", placeholder: "/path/to/cert.pem" }}
                  onChange={(v) => update(["gateway", "tls", "certPath"], v)}
                />
                <FormField
                  label="Key Path"
                  value={tls.keyPath ?? ""}
                  type={{ kind: "string", placeholder: "/path/to/key.pem" }}
                  onChange={(v) => update(["gateway", "tls", "keyPath"], v)}
                />
              </>
            )}
          </>
        )}
      </ConfigSection>

      <ConfigSection title="Tool Allow/Deny" icon="🛠">
        <FormField
          label="Allowed Tools"
          description="Only allow these tool names. Empty = allow all."
          value={gateway.tools && typeof gateway.tools === "object" ? (cfgGet(gateway, "tools") as Record<string, unknown[]>).allow ?? [] : []}
          type={{ kind: "string-array", placeholder: "tool-name" }}
          onChange={(v) => update(["gateway", "tools", "allow"], v)}
        />
        <FormField
          label="Denied Tools"
          description="Block these specific tool names."
          value={gateway.tools && typeof gateway.tools === "object" ? (cfgGet(gateway, "tools") as Record<string, unknown[]>).deny ?? [] : []}
          type={{ kind: "string-array", placeholder: "tool-name" }}
          onChange={(v) => update(["gateway", "tools", "deny"], v)}
        />
      </ConfigSection>
    </>
  );
}

// ─── Agents Tab ───────────────────────────────────────────────────────────

function AgentsTab({ config, update, errors }: TabProps) {
  const agents = cfgGet(config, "agents");
  const defaults = cfgGet(agents, "defaults");
  const sandbox = cfgGet(defaults, "sandbox");
  const err = (path: string) => errors.find((e) => e.path === path)?.message;

  return (
    <>
      <ConfigSection title="Agent Defaults" icon="🤖">
        <FormField
          label="Default Model"
          description="The AI model used by agents when no model is specified."
          value={defaults.model ?? ""}
          type={{ kind: "string", placeholder: "claude-opus-4-5" }}
          onChange={(v) => update(["agents", "defaults", "model"], v)}
          error={err("agents.defaults.model")}
        />
        <FormField
          label="Max Turns"
          description="Maximum number of conversation turns before an agent stops."
          value={defaults.maxTurns ?? 10}
          type={{ kind: "number", min: 1, max: 200 }}
          onChange={(v) => update(["agents", "defaults", "maxTurns"], v)}
        />
        <FormField
          label="Max Tokens"
          description="Maximum tokens per response. Leave as 0 for model default."
          value={defaults.maxTokens ?? 0}
          type={{ kind: "number", min: 0, max: 200000 }}
          onChange={(v) => update(["agents", "defaults", "maxTokens"], v || undefined)}
        />
      </ConfigSection>

      <ConfigSection title="Sandbox Behaviour" icon="📦">
        <FormField
          label="Workspace Only"
          description="Restrict file operations to the workspace directory."
          value={sandbox.workspaceOnly ?? true}
          type={{ kind: "boolean" }}
          onChange={(v) => update(["agents", "defaults", "sandbox", "workspaceOnly"], v)}
        />
        <FormField
          label="Disable Network"
          description="Block all outbound network access from agent sandboxes."
          value={sandbox.disableNetwork ?? false}
          type={{ kind: "boolean" }}
          onChange={(v) => update(["agents", "defaults", "sandbox", "disableNetwork"], v)}
        />
        <FormField
          label="Max File Size (bytes)"
          description="Maximum file size agents can read or write."
          value={sandbox.maxFileSize ?? 10485760}
          type={{ kind: "number", min: 0 }}
          onChange={(v) => update(["agents", "defaults", "sandbox", "maxFileSize"], v)}
        />
      </ConfigSection>
    </>
  );
}

// ─── Skills Tab ───────────────────────────────────────────────────────────

function SkillsTab({ config, update, errors: _errors }: TabProps) {
  const skills = cfgGet(config, "skills");
  const install = cfgGet(skills, "install");
  const load = cfgGet(skills, "load");

  return (
    <>
      <ConfigSection title="Bundled Skills" icon="📚">
        <FormField
          label="Allowed Bundled Skills"
          description="Which built-in skills to enable. Empty = none allowed."
          value={Array.isArray(skills.allowBundled) ? skills.allowBundled : []}
          type={{ kind: "string-array", placeholder: "skill-name" }}
          onChange={(v) => update(["skills", "allowBundled"], v)}
        />
      </ConfigSection>

      <ConfigSection title="Installation" icon="⬇">
        <FormField
          label="Prefer Homebrew"
          description="Use Homebrew to install system dependencies on macOS."
          value={install.preferBrew ?? false}
          type={{ kind: "boolean" }}
          onChange={(v) => update(["skills", "install", "preferBrew"], v)}
        />
        <FormField
          label="Node Package Manager"
          description="Package manager to use when installing skill npm dependencies."
          value={install.nodeManager ?? "pnpm"}
          type={{ kind: "enum", options: ["npm", "pnpm", "yarn", "bun"] }}
          onChange={(v) => update(["skills", "install", "nodeManager"], v)}
        />
      </ConfigSection>

      <ConfigSection title="Watch Mode" icon="👁">
        <FormField
          label="Watch for Changes"
          description="Automatically reload skills when their source files change."
          value={load.watch ?? false}
          type={{ kind: "boolean" }}
          onChange={(v) => update(["skills", "load", "watch"], v)}
        />
        <FormField
          label="Extra Skill Directories"
          description="Additional directories to scan for skills."
          value={Array.isArray(load.extraDirs) ? load.extraDirs : []}
          type={{ kind: "string-array", placeholder: "/path/to/skills" }}
          onChange={(v) => update(["skills", "load", "extraDirs"], v)}
        />
      </ConfigSection>
    </>
  );
}

// ─── Security Tab ─────────────────────────────────────────────────────────

function SecurityTab({ config, update, errors: _errors }: TabProps) {
  const tools = cfgGet(config, "tools");
  const exec = cfgGet(tools, "exec");
  const shell = cfgGet(exec, "shell");
  const applyPatch = cfgGet(exec, "applyPatch");
  const web = cfgGet(cfgGet(config, "gateway"), "controlUi");
  void web;

  return (
    <>
      <ConfigSection title="Execution Security" icon="⚡">
        <FormField
          label="Workspace-Only File Access"
          description="Block agents from reading or writing outside the workspace directory."
          value={applyPatch.workspaceOnly ?? true}
          type={{ kind: "boolean" }}
          onChange={(v) => update(["tools", "exec", "applyPatch", "workspaceOnly"], v)}
        />
        <FormField
          label="Allowed Shell Commands"
          description="Explicit list of shell commands agents can execute. Leave empty to use defaults."
          value={Array.isArray(shell.allowedCommands) ? shell.allowedCommands : []}
          type={{ kind: "string-array", placeholder: "ls" }}
          onChange={(v) => update(["tools", "exec", "shell", "allowedCommands"], v)}
        />
        <FormField
          label="Disallow Destructive Operations"
          description="Block rm -rf, format, and other destructive shell commands."
          value={shell.disallowDestructive ?? true}
          type={{ kind: "boolean" }}
          onChange={(v) => update(["tools", "exec", "shell", "disallowDestructive"], v)}
        />
      </ConfigSection>

      <ConfigSection title="Control UI" icon="🖥">
        <FormField
          label="Enable Control UI"
          description="Enable the built-in web interface for OpenClaw."
          value={web.enabled ?? true}
          type={{ kind: "boolean" }}
          onChange={(v) => update(["gateway", "controlUi", "enabled"], v)}
        />
        <FormField
          label="Allow Insecure Auth"
          description="Allow unauthenticated access to the UI. DANGER: only for isolated local use."
          value={web.allowInsecureAuth ?? false}
          type={{ kind: "boolean" }}
          onChange={(v) => update(["gateway", "controlUi", "allowInsecureAuth"], v)}
        />
        <FormField
          label="Allowed Origins"
          description="CORS allowed origins for the UI. Defaults to same-origin only."
          value={Array.isArray(web.allowedOrigins) ? web.allowedOrigins : []}
          type={{ kind: "string-array", placeholder: "https://example.com" }}
          onChange={(v) => update(["gateway", "controlUi", "allowedOrigins"], v)}
        />
      </ConfigSection>

      <ConfigSection title="Hardening" icon="🔐">
        <FormField
          label="Security Configured"
          description="Flag confirming security has been deliberately configured. Suppresses warnings."
          value={cfgGet(config, "gateway").securityConfigured ?? false}
          type={{ kind: "boolean" }}
          onChange={(v) => update(["gateway", "securityConfigured"], v)}
        />
        <FormField
          label="Trusted Proxy IPs"
          description="IP addresses of trusted reverse proxies (for X-Forwarded-For handling)."
          value={Array.isArray(cfgGet(config, "gateway").trustedProxies) ? cfgGet(config, "gateway").trustedProxies : []}
          type={{ kind: "string-array", placeholder: "127.0.0.1" }}
          onChange={(v) => update(["gateway", "trustedProxies"], v)}
        />
      </ConfigSection>
    </>
  );
}

// ─── Shared types ─────────────────────────────────────────────────────────

interface TabProps {
  config: Record<string, unknown>;
  update: (path: string[], value: unknown) => void;
  errors: ValidationError[];
}

const btnPrimary: React.CSSProperties = {
  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
  border: "none",
  borderRadius: "8px",
  padding: "8px 16px",
  fontSize: "13px",
  fontWeight: 600,
  color: "white",
  cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--border-default)",
  borderRadius: "8px",
  padding: "8px 16px",
  fontSize: "13px",
  color: "var(--text-secondary)",
  cursor: "pointer",
};
