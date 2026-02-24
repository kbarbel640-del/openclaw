/**
 * FormField — auto-renders a config value as the appropriate input type.
 *
 * Handles:
 *   boolean   → Toggle switch
 *   number    → Number input with optional min/max
 *   string    → Text input (password-masked if sensitive)
 *   enum      → Select dropdown
 *   string[]  → Tag/chip list with add+remove
 *   object    → Renders nothing (handled by parent section)
 */

import React, { useState } from "react";

export type FieldType =
  | { kind: "boolean" }
  | { kind: "number"; min?: number; max?: number; step?: number }
  | { kind: "string"; sensitive?: boolean; placeholder?: string; multiline?: boolean }
  | { kind: "enum"; options: string[] }
  | { kind: "string-array"; placeholder?: string };

export interface FormFieldProps {
  label: string;
  description?: string;
  value: unknown;
  type: FieldType;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  error?: string;
}

export function FormField({ label, description, value, type, onChange, disabled, error }: FormFieldProps) {
  return (
    <div style={styles.row}>
      <div style={styles.labelCol}>
        <div style={styles.label}>{label}</div>
        {description && <div style={styles.desc}>{description}</div>}
        {error && <div style={styles.error}>{error}</div>}
      </div>
      <div style={styles.inputCol}>
        {type.kind === "boolean" && (
          <Toggle value={!!value} onChange={onChange} disabled={disabled} />
        )}
        {type.kind === "number" && (
          <input
            type="number"
            style={{ ...styles.input, width: "100px" }}
            value={typeof value === "number" ? value : ""}
            min={type.min}
            max={type.max}
            step={type.step ?? 1}
            onChange={(e) => onChange(e.target.valueAsNumber)}
            disabled={disabled}
          />
        )}
        {type.kind === "string" && !type.multiline && (
          <input
            type={type.sensitive ? "password" : "text"}
            style={styles.input}
            value={typeof value === "string" ? value : ""}
            placeholder={type.placeholder ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        )}
        {type.kind === "string" && type.multiline && (
          <textarea
            style={{ ...styles.input, height: "80px", resize: "vertical", fontFamily: "var(--font-mono)" }}
            value={typeof value === "string" ? value : ""}
            placeholder={type.placeholder ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        )}
        {type.kind === "enum" && (
          <select
            style={styles.select}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          >
            <option value="">— default —</option>
            {type.options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )}
        {type.kind === "string-array" && (
          <TagInput
            values={Array.isArray(value) ? (value as string[]) : []}
            onChange={onChange}
            placeholder={type.placeholder ?? "Add…"}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
}

// ─── Toggle Switch ────────────────────────────────────────────────────────

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => !disabled && onChange(!value)}
      style={{
        width: "42px",
        height: "24px",
        borderRadius: "12px",
        background: value ? "var(--accent-primary)" : "var(--surface-2)",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative",
        transition: "background 200ms",
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
        boxShadow: value ? "0 0 8px rgba(99,102,241,0.4)" : "none",
      }}
    >
      <span style={{
        position: "absolute",
        top: "3px",
        left: value ? "21px" : "3px",
        width: "18px",
        height: "18px",
        borderRadius: "50%",
        background: "white",
        transition: "left 200ms",
        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
      }} />
    </button>
  );
}

// ─── Tag Input ────────────────────────────────────────────────────────────

function TagInput({ values, onChange, placeholder, disabled }: {
  values: string[];
  onChange: (v: unknown) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const trimmed = draft.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setDraft("");
  };

  const remove = (i: number) => {
    const next = [...values];
    next.splice(i, 1);
    onChange(next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {values.map((v, i) => (
          <span key={i} style={styles.tag}>
            {v}
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(i)}
                style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: "0 2px", fontSize: "12px" }}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {values.length === 0 && <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>None</span>}
      </div>
      {!disabled && (
        <div style={{ display: "flex", gap: "6px" }}>
          <input
            style={{ ...styles.input, flex: 1, padding: "6px 10px" }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          />
          <button type="button" style={styles.addBtn} onClick={add}>Add</button>
        </div>
      )}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────

export function ConfigSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <span style={{ fontSize: "18px" }}>{icon}</span>
        <h3 style={styles.sectionTitle}>{title}</h3>
      </div>
      <div style={styles.sectionBody}>{children}</div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "24px",
    padding: "14px 0",
    borderBottom: "1px solid var(--border-subtle)",
  },
  labelCol: { flex: 1 },
  inputCol: { flexShrink: 0, display: "flex", alignItems: "center" },
  label: { fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" },
  desc: { fontSize: "12px", color: "var(--text-tertiary)", marginTop: "3px", lineHeight: 1.5, maxWidth: "360px" },
  error: { fontSize: "12px", color: "var(--accent-danger)", marginTop: "4px" },
  input: {
    background: "rgba(30,30,42,0.8)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    color: "var(--text-primary)",
    outline: "none",
    fontFamily: "inherit",
    width: "220px",
    boxSizing: "border-box",
  },
  select: {
    background: "rgba(30,30,42,0.8)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    color: "var(--text-primary)",
    outline: "none",
    fontFamily: "inherit",
    width: "220px",
    cursor: "pointer",
  },
  tag: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "3px 8px",
    background: "var(--accent-primary-glow)",
    border: "1px solid var(--accent-primary)",
    borderRadius: "6px",
    fontSize: "12px",
    color: "var(--accent-primary-hover)",
  },
  addBtn: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-default)",
    borderRadius: "8px",
    padding: "6px 12px",
    fontSize: "12px",
    color: "var(--text-secondary)",
    cursor: "pointer",
  },
  section: {
    background: "var(--surface-1)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "12px",
    overflow: "hidden",
    marginBottom: "16px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "14px 20px",
    borderBottom: "1px solid var(--border-subtle)",
    background: "rgba(255,255,255,0.02)",
  },
  sectionTitle: { fontSize: "14px", fontWeight: 600, margin: 0 },
  sectionBody: { padding: "0 20px" },
};
