/**
 * JsonEditor — raw JSON editor with syntax highlighting, validation, and diff.
 *
 * Uses a styled textarea with:
 *   - Validation error annotations below
 *   - Prettify button
 *   - Error line highlighting (via inline marker)
 */

import React, { useState, useEffect, useCallback } from "react";

interface JsonEditorProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  validationErrors?: { path: string; message: string }[];
}

export function JsonEditor({ config, onChange, validationErrors = [] }: JsonEditorProps) {
  const [raw, setRaw] = useState(() => JSON.stringify(config, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Sync external config changes into raw text when not mid-edit
  useEffect(() => {
    try {
      const canonical = JSON.stringify(config, null, 2);
      // Only sync if the raw text is valid JSON that equals the config
      const parsed = JSON.parse(raw);
      if (JSON.stringify(parsed) === JSON.stringify(config)) {return;}
      setRaw(canonical);
    } catch {
      // raw is invalid — don't overwrite the in-progress edit
    }
  }, [config]);

  const handleChange = useCallback((text: string) => {
    setRaw(text);
    try {
      const parsed = JSON.parse(text);
      setParseError(null);
      onChange(parsed);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }, [onChange]);

  const prettify = useCallback(() => {
    try {
      const parsed = JSON.parse(raw);
      const pretty = JSON.stringify(parsed, null, 2);
      setRaw(pretty);
      setParseError(null);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }, [raw]);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [raw]);

  const lineCount = raw.split("\n").length;

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "center" }}>
        <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
          {lineCount} lines · {raw.length} chars
        </span>
        <div style={{ flex: 1 }} />
        <button style={toolBtn} onClick={prettify}>Prettify</button>
        <button style={toolBtn} onClick={copy}>{copied ? "✓ Copied" : "Copy"}</button>
      </div>

      {/* Editor */}
      <div style={{ position: "relative" }}>
        <textarea
          value={raw}
          onChange={(e) => handleChange(e.target.value)}
          spellCheck={false}
          style={{
            width: "100%",
            minHeight: "480px",
            background: "rgba(10,10,18,0.8)",
            border: `1px solid ${parseError ? "var(--accent-danger)" : "var(--border-default)"}`,
            borderRadius: "12px",
            padding: "16px",
            fontSize: "12.5px",
            fontFamily: "var(--font-mono, 'JetBrains Mono', 'Menlo', monospace)",
            color: "var(--text-primary)",
            lineHeight: 1.7,
            outline: "none",
            resize: "vertical",
            boxSizing: "border-box",
            boxShadow: parseError ? "0 0 0 1px var(--accent-danger)" : "none",
            transition: "border-color 150ms",
          }}
        />
      </div>

      {/* Parse error */}
      {parseError && (
        <div style={{
          marginTop: "8px",
          padding: "10px 14px",
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: "8px",
          fontSize: "12px",
          fontFamily: "var(--font-mono)",
          color: "var(--accent-danger)",
        }}>
          ✗ {parseError}
        </div>
      )}

      {/* Validation errors */}
      {!parseError && validationErrors.length > 0 && (
        <div style={{ marginTop: "12px" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Schema Validation Errors ({validationErrors.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {validationErrors.map((err, i) => (
              <div key={i} style={{
                padding: "8px 12px",
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: "8px",
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
                display: "flex",
                gap: "10px",
              }}>
                <span style={{ color: "var(--text-tertiary)", flex: "0 0 auto" }}>{err.path}</span>
                <span style={{ color: "var(--accent-danger)" }}>{err.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No errors hint */}
      {!parseError && validationErrors.length === 0 && (
        <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--accent-success)" }}>
          ✓ Valid JSON
        </div>
      )}
    </div>
  );
}

const toolBtn: React.CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--border-default)",
  borderRadius: "6px",
  padding: "5px 12px",
  fontSize: "12px",
  color: "var(--text-secondary)",
  cursor: "pointer",
};
