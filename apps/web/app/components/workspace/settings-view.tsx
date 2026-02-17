"use client";

import { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types (mirroring /api/settings/providers response)
// ---------------------------------------------------------------------------
type AuthMethod = {
  value: string;
  label: string;
  hint?: string;
  type: "api-key" | "oauth" | "token";
  defaultModel?: string;
};

type ProviderGroup = {
  value: string;
  label: string;
  hint?: string;
  methods: AuthMethod[];
};

// ---------------------------------------------------------------------------
// Icons (inline SVG for zero-dependency)
// ---------------------------------------------------------------------------
function ChevronRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function CheckCircle({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function KeyIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

function ServerIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
      <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
      <line x1="6" x2="6.01" y1="6" y2="6" />
      <line x1="6" x2="6.01" y1="18" y2="18" />
    </svg>
  );
}

function SparklesIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}

function EyeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

function ArrowLeftIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// SettingsView Component
// ---------------------------------------------------------------------------
export function SettingsView() {
  // State
  const [providers, setProviders] = useState<ProviderGroup[]>([]);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [currentConfig, setCurrentConfig] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  // Wizard state
  const [selectedProvider, setSelectedProvider] = useState<ProviderGroup | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<AuthMethod | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [modelInput, setModelInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Fetch data on mount
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [providersRes, modelRes, configRes] = await Promise.all([
        fetch("/api/settings/providers"),
        fetch("/api/settings/model"),
        fetch("/api/settings/config"),
      ]);
      const providersData = await providersRes.json();
      const modelData = await modelRes.json();
      const configData = await configRes.json();

      setProviders(providersData.providers ?? []);
      setCurrentModel(modelData.model ?? null);
      setCurrentConfig(configData.config ?? null);
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save handler
  const handleSave = async () => {
    if (!selectedMethod) {return;}
    setSaving(true);
    setSaveResult(null);

    try {
      // 1) Save auth/API key
      const authRes = await fetch("/api/settings/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider?.value,
          authMethod: selectedMethod.value,
          apiKey: apiKeyInput,
        }),
      });
      const authData = await authRes.json();
      if (!authRes.ok) {throw new Error(authData.error);}

      // 2) Save model if specified
      const finalModel = modelInput.trim() || selectedMethod.defaultModel;
      if (finalModel) {
        const modelRes = await fetch("/api/settings/model", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: finalModel }),
        });
        const modelData = await modelRes.json();
        if (!modelRes.ok) {throw new Error(modelData.error);}
        setCurrentModel(finalModel);
      }

      setSaveResult({ ok: true, message: "Configuration saved successfully!" });
      // Reset wizard after a short delay
      setTimeout(() => {
        setSelectedProvider(null);
        setSelectedMethod(null);
        setApiKeyInput("");
        setModelInput("");
        setShowKey(false);
        setSaveResult(null);
        fetchData(); // Refresh current config
      }, 2000);
    } catch (err) {
      setSaveResult({ ok: false, message: String(err) });
    } finally {
      setSaving(false);
    }
  };

  // Go back
  const goBack = () => {
    if (selectedMethod) {
      setSelectedMethod(null);
      setApiKeyInput("");
      setModelInput("");
      setShowKey(false);
      setSaveResult(null);
    } else if (selectedProvider) {
      setSelectedProvider(null);
    }
  };

  // Determine current step
  const step = !selectedProvider ? "provider" : !selectedMethod ? "method" : "configure";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <div
        className="px-6 py-4 border-b flex items-center gap-3"
        style={{ borderColor: "var(--color-border)" }}
      >
        {step !== "provider" && (
          <button
            onClick={goBack}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-text-muted)",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <ArrowLeftIcon size={18} />
          </button>
        )}
        <h1 className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>
          Settings
        </h1>
        {selectedProvider && (
          <span style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
            / {selectedProvider.label}
            {selectedMethod ? ` / ${selectedMethod.label}` : ""}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          {loading ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "4rem",
                color: "var(--color-text-muted)",
                fontSize: "0.875rem",
              }}
            >
              Loading settings…
            </div>
          ) : (
            <>
              {/* Current Configuration Summary */}
              {step === "provider" && currentModel && (
                <section
                  style={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "0.75rem",
                    padding: "1rem 1.25rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <SparklesIcon size={16} />
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text)" }}>
                      Current Configuration
                    </span>
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                    <span style={{ color: "var(--color-text-muted)" }}>Model:</span>{" "}
                    <code
                      style={{
                        background: "var(--color-surface-hover)",
                        padding: "0.15em 0.4em",
                        borderRadius: "0.25rem",
                        fontSize: "0.8em",
                      }}
                    >
                      {typeof currentModel === "string" ? currentModel : String((currentModel as any)?.primary ?? "none")}
                    </code>
                    {(() => {
                      const cfg = currentConfig as any;
                      const providers = cfg?.models?.providers;
                      if (!providers) {return null;}
                      return (
                        <>
                          <br />
                          <span style={{ color: "var(--color-text-muted)" }}>Providers configured:</span>{" "}
                          {Object.keys(providers).join(", ") || "none"}
                        </>
                      );
                    })()}
                  </div>
                </section>
              )}

              {/* Step 1: Provider Selection */}
              {step === "provider" && (
                <section>
                  <h2
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: "var(--color-text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: "0.75rem",
                    }}
                  >
                    Select Provider
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    {providers.map((provider) => (
                      <button
                        key={provider.value}
                        onClick={() => {
                          setSelectedProvider(provider);
                          // Auto-select if only one method
                          if (provider.methods.length === 1) {
                            setSelectedMethod(provider.methods[0]);
                            if (provider.methods[0].defaultModel) {
                              setModelInput(provider.methods[0].defaultModel);
                            }
                          }
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.75rem 1rem",
                          background: "var(--color-surface)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "0.625rem",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "var(--color-surface-hover)";
                          e.currentTarget.style.borderColor = "var(--color-border-strong)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "var(--color-surface)";
                          e.currentTarget.style.borderColor = "var(--color-border)";
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 500, fontSize: "0.875rem", color: "var(--color-text)" }}>
                            {provider.label}
                          </div>
                          {provider.hint && (
                            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.125rem" }}>
                              {provider.hint}
                            </div>
                          )}
                        </div>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Step 2: Auth Method Selection (only if provider has multiple) */}
              {step === "method" && selectedProvider && (
                <section>
                  <h2
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: "var(--color-text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: "0.75rem",
                    }}
                  >
                    Choose Authentication Method
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    {selectedProvider.methods.map((method) => (
                      <button
                        key={method.value}
                        onClick={() => {
                          setSelectedMethod(method);
                          if (method.defaultModel) {
                            setModelInput(method.defaultModel);
                          }
                        }}
                        disabled={method.type === "oauth"}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.75rem 1rem",
                          background: method.type === "oauth" ? "var(--color-surface-hover)" : "var(--color-surface)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "0.625rem",
                          cursor: method.type === "oauth" ? "not-allowed" : "pointer",
                          textAlign: "left",
                          opacity: method.type === "oauth" ? 0.5 : 1,
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (method.type !== "oauth") {
                            e.currentTarget.style.background = "var(--color-surface-hover)";
                            e.currentTarget.style.borderColor = "var(--color-border-strong)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (method.type !== "oauth") {
                            e.currentTarget.style.background = "var(--color-surface)";
                            e.currentTarget.style.borderColor = "var(--color-border)";
                          }
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                          <div style={{ color: "var(--color-text-muted)" }}>
                            {method.type === "api-key" ? <KeyIcon size={16} /> : <ServerIcon size={16} />}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500, fontSize: "0.875rem", color: "var(--color-text)" }}>
                              {method.label}
                            </div>
                            {method.hint && (
                              <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.125rem" }}>
                                {method.hint}
                              </div>
                            )}
                            {method.type === "oauth" && (
                              <div style={{ fontSize: "0.7rem", color: "var(--color-warning)", marginTop: "0.25rem" }}>
                                OAuth — use CLI for now
                              </div>
                            )}
                          </div>
                        </div>
                        {method.type !== "oauth" && <ChevronRight size={16} />}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Step 3: Configure (API Key + Model) */}
              {step === "configure" && selectedMethod && (
                <section>
                  {/* API Key Input */}
                  <div style={{ marginBottom: "1.5rem" }}>
                    <h2
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "var(--color-text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: "0.75rem",
                      }}
                    >
                      {selectedMethod.type === "token" ? "Setup Token" : "API Key"}
                    </h2>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showKey ? "text" : "password"}
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder={
                          selectedMethod.type === "token"
                            ? "Paste your setup-token here…"
                            : "sk-..."
                        }
                        autoFocus
                        style={{
                          width: "100%",
                          padding: "0.625rem 2.5rem 0.625rem 0.75rem",
                          fontSize: "0.875rem",
                          fontFamily: "'SF Mono', 'Fira Code', monospace",
                          background: "var(--color-surface)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "0.5rem",
                          color: "var(--color-text)",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "var(--color-accent)";
                          e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-accent-light)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = "var(--color-border)";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      />
                      <button
                        onClick={() => setShowKey(!showKey)}
                        style={{
                          position: "absolute",
                          right: "0.5rem",
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--color-text-muted)",
                          padding: "4px",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        {showKey ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                    {selectedMethod.hint && (
                      <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.5rem" }}>
                        {selectedMethod.hint}
                      </p>
                    )}
                  </div>

                  {/* Model Selection */}
                  <div style={{ marginBottom: "1.5rem" }}>
                    <h2
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "var(--color-text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: "0.75rem",
                      }}
                    >
                      Default Model
                    </h2>
                    <input
                      type="text"
                      value={modelInput}
                      onChange={(e) => setModelInput(e.target.value)}
                      placeholder={selectedMethod.defaultModel ?? "provider/model-name"}
                      style={{
                        width: "100%",
                        padding: "0.625rem 0.75rem",
                        fontSize: "0.875rem",
                        fontFamily: "'SF Mono', 'Fira Code', monospace",
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "0.5rem",
                        color: "var(--color-text)",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "var(--color-accent)";
                        e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-accent-light)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "var(--color-border)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    />
                    {selectedMethod.defaultModel && (
                      <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.5rem" }}>
                        Default: <code style={{
                          background: "var(--color-surface-hover)",
                          padding: "0.1em 0.3em",
                          borderRadius: "0.2rem",
                          fontSize: "0.85em",
                        }}>{selectedMethod.defaultModel}</code>
                      </p>
                    )}
                  </div>

                  {/* Save Button */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <button
                      onClick={handleSave}
                      disabled={saving || !apiKeyInput.trim()}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.625rem 1.5rem",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        borderRadius: "0.5rem",
                        border: "none",
                        background: "var(--color-accent)",
                        color: "#fff",
                        cursor: saving || !apiKeyInput.trim() ? "not-allowed" : "pointer",
                        opacity: saving || !apiKeyInput.trim() ? 0.5 : 1,
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!saving && apiKeyInput.trim()) {
                          e.currentTarget.style.background = "var(--color-accent-hover)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "var(--color-accent)";
                      }}
                    >
                      {saving ? "Saving…" : "Save Configuration"}
                    </button>

                    {saveResult && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.375rem",
                          fontSize: "0.8125rem",
                          color: saveResult.ok ? "var(--color-success)" : "var(--color-error)",
                        }}
                      >
                        {saveResult.ok && <CheckCircle size={16} />}
                        {saveResult.message}
                      </span>
                    )}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
