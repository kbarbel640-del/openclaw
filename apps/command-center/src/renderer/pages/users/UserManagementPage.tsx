/**
 * UserManagementPage — admin-gated user management.
 *
 * Features:
 *   - User table: avatar, username, role badge, 2FA status, last login, actions
 *   - Create User modal (admin-initiated, elevation required)
 *   - Edit Role modal (elevation required, self-change blocked)
 *   - Reset Password modal (elevation required, signs out target user)
 *   - Delete User confirm dialog (catastrophic-action warning)
 *   - Audit Log tab (recent authentication events)
 *
 * Access: admin role or higher only. Viewers/operators see a permission wall.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../App.js";
import type { UserProfile, UserRole, OcccBridge } from "../../../shared/ipc-types.js";

const occc = (window as unknown as { occc: OcccBridge }).occc;

interface AuditLogEntry {
  id: string;
  userId: string | null;
  username: string | null;
  event: string;
  method: string | null;
  success: boolean;
  timestamp: string;
}

const ROLES: UserRole[] = ["viewer", "operator", "admin", "super-admin"];

const ROLE_COLORS: Record<UserRole, { bg: string; text: string; border: string }> = {
  viewer: { bg: "rgba(100,116,139,0.15)", text: "#94a3b8", border: "rgba(100,116,139,0.3)" },
  operator: { bg: "rgba(59,130,246,0.15)", text: "#60a5fa", border: "rgba(59,130,246,0.3)" },
  admin: { bg: "rgba(168,85,247,0.15)", text: "#c084fc", border: "rgba(168,85,247,0.3)" },
  "super-admin": { bg: "rgba(234,179,8,0.15)", text: "#facc15", border: "rgba(234,179,8,0.3)" },
};

type ActiveModal =
  | { kind: "create" }
  | { kind: "edit-role"; user: UserProfile }
  | { kind: "reset-password"; user: UserProfile }
  | { kind: "delete"; user: UserProfile };

type ActiveTab = "users" | "audit";

// ─── Page ─────────────────────────────────────────────────────────────────

export function UserManagementPage() {
  const { session, token, requireElevation } = useAuth();

  // Gate access to admin+
  const isAuthorized =
    session?.role === "admin" || session?.role === "super-admin";

  const [tab, setTab] = useState<ActiveTab>("users");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal | null>(null);

  // ─── Load ────────────────────────────────────────────────────────────

  const loadUsers = useCallback(async () => {
    if (!token) {return;}
    setLoading(true);
    setError(null);
    try {
      const data = await occc.invoke("occc:auth:list-users", token) as UserProfile[] | null;
      setUsers(data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadAuditLog = useCallback(async () => {
    if (!token) {return;}
    try {
      const data = await occc.invoke("occc:auth:audit-log", token, 200) as AuditLogEntry[] | null;
      setAuditLog(data ?? []);
    } catch {}
  }, [token]);

  useEffect(() => {
    void loadUsers();
    void loadAuditLog();
  }, [loadUsers, loadAuditLog]);

  // ─── Actions (all require elevation) ─────────────────────────────────

  const handleAction = useCallback(async (
    label: string,
    fn: () => Promise<unknown>,
  ) => {
    const elevated = await requireElevation(label);
    if (!elevated) {return false;}
    try {
      const result = await fn();
      if (result && typeof result === "object" && "ok" in result && ! (result as { ok: boolean }).ok) {
        setError((result as { reason?: string }).reason ?? "Operation failed");
        return false;
      }
      await loadUsers();
      await loadAuditLog();
      setActiveModal(null);
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Operation failed");
      return false;
    }
  }, [requireElevation, loadUsers, loadAuditLog]);

  // ─── Permission wall ─────────────────────────────────────────────────

  if (!isAuthorized) {
    return (
      <div>
        <div className="page-header"><h1>User Management</h1></div>
        <div style={{ textAlign: "center", padding: "80px 32px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.3 }}>🚫</div>
          <h2 style={{ fontSize: "18px", color: "var(--text-primary)", marginBottom: "8px" }}>
            Access Restricted
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            User management requires the <strong>Admin</strong> role or higher.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1>User Management</h1>
          <p>{users.length} user{users.length !== 1 ? "s" : ""} · Role changes require re-authentication</p>
        </div>
        <button
          style={btnPrimary}
          onClick={() => setActiveModal({ kind: "create" })}
        >
          + Add User
        </button>
      </div>

      {error && (
        <div style={alertBox}>
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}>×</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", borderBottom: "1px solid var(--border-subtle)" }}>
        {(["users", "audit"] as ActiveTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: "none",
              border: "none",
              borderBottom: `2px solid ${tab === t ? "var(--accent-primary)" : "transparent"}`,
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? "var(--accent-primary-hover)" : "var(--text-secondary)",
              cursor: "pointer",
              marginBottom: "-1px",
              textTransform: "capitalize",
            }}
          >
            {t === "users" ? `👥 Users` : `🗒 Audit Log`}
          </button>
        ))}
      </div>

      {/* User Table */}
      {tab === "users" && (
        loading ? (
          <div style={{ textAlign: "center", padding: "60px" }}><div className="spinner" /></div>
        ) : (
          <UserTable
            users={users}
            currentUserId={session?.userId ?? ""}
            isSuperAdmin={session?.role === "super-admin"}
            onEditRole={(u) => setActiveModal({ kind: "edit-role", user: u })}
            onResetPassword={(u) => setActiveModal({ kind: "reset-password", user: u })}
            onDelete={(u) => setActiveModal({ kind: "delete", user: u })}
          />
        )
      )}

      {/* Audit Log */}
      {tab === "audit" && <AuditLogTab entries={auditLog} />}

      {/* Modals */}
      {activeModal?.kind === "create" && (
        <CreateUserModal
          isSuperAdmin={session?.role === "super-admin"}
          onClose={() => setActiveModal(null)}
          onSubmit={async (params) => {
            await handleAction("create a new user", () =>
              occc.invoke?.("occc:auth:create-user", token, params),
            );
          }}
        />
      )}
      {activeModal?.kind === "edit-role" && (
        <EditRoleModal
          user={activeModal.user}
          isSuperAdmin={session?.role === "super-admin"}
          onClose={() => setActiveModal(null)}
          onSubmit={async (newRole) => {
            await handleAction(`change ${activeModal.user.username}'s role`, () =>
              occc.invoke?.("occc:auth:update-role", token, activeModal.user.id, newRole),
            );
          }}
        />
      )}
      {activeModal?.kind === "reset-password" && (
        <ResetPasswordModal
          user={activeModal.user}
          onClose={() => setActiveModal(null)}
          onSubmit={async (newPassword) => {
            await handleAction(`reset ${activeModal.user.username}'s password`, () =>
              occc.invoke?.("occc:auth:reset-password", token, activeModal.user.id, newPassword),
            );
          }}
        />
      )}
      {activeModal?.kind === "delete" && (
        <DeleteConfirmModal
          user={activeModal.user}
          onClose={() => setActiveModal(null)}
          onConfirm={async () => {
            await handleAction(`delete user ${activeModal.user.username}`, () =>
              occc.invoke?.("occc:auth:delete-user", token, activeModal.user.id),
            );
          }}
        />
      )}
    </div>
  );
}

// ─── User Table ───────────────────────────────────────────────────────────

function UserTable({
  users,
  currentUserId,
  isSuperAdmin,
  onEditRole,
  onResetPassword,
  onDelete,
}: {
  users: UserProfile[];
  currentUserId: string;
  isSuperAdmin: boolean;
  onEditRole: (u: UserProfile) => void;
  onResetPassword: (u: UserProfile) => void;
  onDelete: (u: UserProfile) => void;
}) {
  if (users.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: "var(--text-tertiary)" }}>
        No users found.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Table header */}
      <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 140px 120px 180px 140px", gap: "12px", padding: "8px 16px", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        <span />
        <span>Username</span>
        <span>Role</span>
        <span>2FA</span>
        <span>Last Login</span>
        <span style={{ textAlign: "right" }}>Actions</span>
      </div>

      {users.map((user) => {
        const isSelf = user.id === currentUserId;
        const roleColors = ROLE_COLORS[user.role];

        return (
          <div
            key={user.id}
            style={{
              display: "grid",
              gridTemplateColumns: "40px 1fr 140px 120px 180px 140px",
              gap: "12px",
              alignItems: "center",
              padding: "14px 16px",
              background: "var(--surface-1)",
              border: `1px solid ${isSelf ? "rgba(99,102,241,0.3)" : "var(--border-subtle)"}`,
              borderRadius: "12px",
              transition: "border-color 200ms",
            }}
          >
            {/* Avatar */}
            <div style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${roleColors.text}, ${roleColors.border})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              fontWeight: 700,
              color: "white",
              flexShrink: 0,
            }}>
              {user.username.slice(0, 1).toUpperCase()}
            </div>

            {/* Username */}
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                {user.username}
                {isSelf && <span style={{ marginLeft: "8px", fontSize: "11px", color: "var(--text-muted)" }}>(you)</span>}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                {user.id.slice(0, 8)}
              </div>
            </div>

            {/* Role badge */}
            <div>
              <span style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 600,
                background: roleColors.bg,
                color: roleColors.text,
                border: `1px solid ${roleColors.border}`,
              }}>
                {user.role}
              </span>
            </div>

            {/* 2FA status */}
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ fontSize: "12px", color: user.totpEnabled ? "var(--accent-success)" : "var(--text-muted)" }}>
                {user.totpEnabled ? "✓ TOTP" : "✗ TOTP"}
              </span>
              <span style={{ fontSize: "12px", color: user.biometricEnrolled ? "var(--accent-success)" : "var(--text-muted)" }}>
                {user.biometricEnrolled ? "✓ Biometric" : "✗ Biometric"}
              </span>
            </div>

            {/* Last login */}
            <div style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
              {user.lastLoginAt
                ? formatRelativeTime(user.lastLoginAt)
                : <span style={{ color: "var(--text-muted)" }}>Never</span>}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
              <ActionButton
                label="Role"
                icon="◐"
                onClick={() => onEditRole(user)}
                disabled={isSelf}
                title={isSelf ? "Cannot change your own role" : "Change role"}
              />
              <ActionButton
                label="Reset"
                icon="🔑"
                onClick={() => onResetPassword(user)}
                title="Reset password"
              />
              {!isSelf && (isSuperAdmin || user.role === "viewer" || user.role === "operator") && (
                <ActionButton
                  label="Delete"
                  icon="⊗"
                  onClick={() => onDelete(user)}
                  danger
                  title="Delete user"
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionButton({ label, icon, onClick, disabled, danger, title }: {
  label: string; icon: string; onClick: () => void; disabled?: boolean; danger?: boolean; title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: danger ? "rgba(239,68,68,0.1)" : "var(--surface-2)",
        border: `1px solid ${danger ? "rgba(239,68,68,0.3)" : "var(--border-default)"}`,
        borderRadius: "8px",
        padding: "5px 9px",
        fontSize: "12px",
        color: danger ? "var(--accent-danger)" : "var(--text-secondary)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        display: "flex",
        alignItems: "center",
        gap: "4px",
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ─── Audit Log Tab ────────────────────────────────────────────────────────

function AuditLogTab({ entries }: { entries: AuditLogEntry[] }) {
  const EVENT_ICONS: Record<string, string> = {
    login_success: "✓",
    login_failed: "✗",
    totp_failed: "✗",
    biometric_login_failed: "✗",
    logout: "↩",
    elevation_success: "⬆",
    elevation_failed: "✗",
    user_created: "＋",
    user_deleted: "−",
    role_changed: "◐",
    password_reset: "🔑",
    totp_setup: "🔐",
  };
  const EVENT_COLORS: Record<string, string> = {
    login_success: "var(--accent-success)",
    elevation_success: "var(--accent-success)",
    user_created: "var(--accent-success)",
    login_failed: "var(--accent-danger)",
    totp_failed: "var(--accent-danger)",
    biometric_login_failed: "var(--accent-danger)",
    elevation_failed: "var(--accent-danger)",
    user_deleted: "var(--accent-danger)",
    logout: "var(--text-tertiary)",
    role_changed: "var(--accent-warning)",
    password_reset: "var(--accent-warning)",
    totp_setup: "var(--accent-primary-hover)",
  };

  if (entries.length === 0) {
    return <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>No audit events.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {entries.map((entry) => (
        <div
          key={entry.id}
          style={{
            display: "grid",
            gridTemplateColumns: "28px 140px 1fr 120px",
            gap: "12px",
            alignItems: "center",
            padding: "10px 14px",
            background: "var(--surface-1)",
            borderRadius: "8px",
            fontSize: "13px",
          }}
        >
          <span style={{ color: EVENT_COLORS[entry.event] ?? "var(--text-secondary)", fontWeight: 700, fontSize: "15px" }}>
            {EVENT_ICONS[entry.event] ?? "·"}
          </span>
          <span style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
            {entry.username ?? entry.userId?.slice(0, 8) ?? "system"}
          </span>
          <span style={{ color: "var(--text-primary)" }}>
            {formatEventLabel(entry.event)}
            {entry.method && (
              <span style={{ marginLeft: "8px", fontSize: "11px", color: "var(--text-muted)" }}>
                via {entry.method}
              </span>
            )}
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "right", fontFamily: "var(--font-mono)" }}>
            {formatRelativeTime(entry.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Create User Modal ────────────────────────────────────────────────────

function CreateUserModal({ isSuperAdmin, onClose, onSubmit }: {
  isSuperAdmin: boolean;
  onClose: () => void;
  onSubmit: (params: { username: string; role: UserRole; password: string }) => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<UserRole>("operator");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableRoles = isSuperAdmin ? ROLES : ROLES.filter((r) => r !== "super-admin");
  const pwStrength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (pwStrength < 2) { setError("Password is too weak"); return; }
    setLoading(true);
    try {
      await onSubmit({ username: username.trim(), role, password });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Add User" icon="＋" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={labelStyle}>Username</label>
          <input
            style={inputStyle}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            pattern="[a-zA-Z0-9_\-]+"
            required
            autoFocus
          />
        </div>

        <div>
          <label style={labelStyle}>Role</label>
          <select style={selectStyle} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            {availableRoles.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            {ROLE_DESCRIPTIONS[role]}
          </p>
        </div>

        <div>
          <label style={labelStyle}>Password</label>
          <input
            style={inputStyle}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 12 characters"
            required
          />
          <PasswordStrengthBar strength={pwStrength} />
        </div>

        <div>
          <label style={labelStyle}>Confirm Password</label>
          <input
            style={inputStyle}
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat password"
            required
          />
        </div>

        {error && <p style={errorStyle}>{error}</p>}

        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button type="button" style={btnSecondary} onClick={onClose}>Cancel</button>
          <button type="submit" style={btnPrimary} disabled={loading || !username || !password || !confirm}>
            {loading ? "Creating…" : "Create User"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit Role Modal ──────────────────────────────────────────────────────

function EditRoleModal({ user, isSuperAdmin, onClose, onSubmit }: {
  user: UserProfile;
  isSuperAdmin: boolean;
  onClose: () => void;
  onSubmit: (newRole: UserRole) => Promise<void>;
}) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableRoles = isSuperAdmin ? ROLES : ROLES.filter((r) => r !== "super-admin");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role === user.role) { onClose(); return; }
    setLoading(true);
    try {
      await onSubmit(role);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Change Role — ${user.username}`} icon="◐" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={labelStyle}>New Role</label>
          {availableRoles.map((r) => {
            const colors = ROLE_COLORS[r];
            return (
              <label
                key={r}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  border: `1px solid ${role === r ? colors.border : "var(--border-subtle)"}`,
                  background: role === r ? colors.bg : "var(--surface-1)",
                  transition: "all 150ms",
                }}
              >
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={role === r}
                  onChange={() => setRole(r)}
                  style={{ accentColor: colors.text }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: colors.text }}>{r}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{ROLE_DESCRIPTIONS[r]}</div>
                </div>
                {r === user.role && <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>current</span>}
              </label>
            );
          })}
        </div>

        {error && <p style={errorStyle}>{error}</p>}

        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button type="button" style={btnSecondary} onClick={onClose}>Cancel</button>
          <button type="submit" style={btnPrimary} disabled={loading || role === user.role}>
            {loading ? "Saving…" : "Save Role"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Reset Password Modal ─────────────────────────────────────────────────

function ResetPasswordModal({ user, onClose, onSubmit }: {
  user: UserProfile;
  onClose: () => void;
  onSubmit: (newPassword: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pwStrength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (pwStrength < 2) { setError("Password is too weak"); return; }
    setLoading(true);
    try {
      await onSubmit(password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Reset Password — ${user.username}`} icon="🔑" onClose={onClose}>
      <div style={{ padding: "12px 14px", background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.3)", borderRadius: "10px", marginBottom: "16px" }}>
        <p style={{ fontSize: "13px", color: "#fbbf24", margin: 0 }}>
          ⚠ This will sign out <strong>{user.username}</strong> from all active sessions immediately.
        </p>
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div>
          <label style={labelStyle}>New Password</label>
          <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
          <PasswordStrengthBar strength={pwStrength} />
        </div>
        <div>
          <label style={labelStyle}>Confirm Password</label>
          <input style={inputStyle} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        {error && <p style={errorStyle}>{error}</p>}
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button type="button" style={btnSecondary} onClick={onClose}>Cancel</button>
          <button type="submit" style={btnPrimary} disabled={loading || !password || !confirm}>
            {loading ? "Resetting…" : "Reset Password"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────

function DeleteConfirmModal({ user, onClose, onConfirm }: {
  user: UserProfile;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [typed, setTyped] = useState("");
  const confirmed = typed === user.username;

  const handleConfirm = async () => {
    if (!confirmed) {return;}
    setLoading(true);
    try { await onConfirm(); } finally { setLoading(false); }
  };

  return (
    <Modal title="Delete User" icon="⊗" onClose={onClose} danger>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ padding: "14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px" }}>
          <p style={{ fontSize: "13px", color: "var(--text-primary)", margin: 0, lineHeight: 1.6 }}>
            This will permanently delete <strong style={{ color: "var(--accent-danger)" }}>{user.username}</strong> and sign them out immediately. This action <strong>cannot be undone</strong>.
          </p>
        </div>

        <div>
          <label style={labelStyle}>Type <code style={{ color: "var(--accent-danger)" }}>{user.username}</code> to confirm</label>
          <input
            style={{ ...inputStyle, borderColor: confirmed ? "var(--accent-danger)" : undefined }}
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={user.username}
            autoFocus
          />
        </div>

        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button style={btnSecondary} onClick={onClose}>Cancel</button>
          <button
            style={{ ...btnPrimary, background: confirmed ? "#dc2626" : "rgba(239,68,68,0.3)", cursor: confirmed ? "pointer" : "not-allowed" }}
            disabled={!confirmed || loading}
            onClick={handleConfirm}
          >
            {loading ? "Deleting…" : "Delete User"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────

function Modal({ title, icon, onClose, danger, children }: {
  title: string; icon: string; onClose: () => void; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
    }}>
      <div style={{
        width: "480px", maxHeight: "90vh", overflow: "auto",
        background: "rgba(18,18,28,0.97)", border: `1px solid ${danger ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}`,
        borderRadius: "16px", padding: "28px", boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <span style={{ fontSize: "20px" }}>{icon}</span>
          <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: danger ? "var(--accent-danger)" : "var(--text-primary)" }}>
            {title}
          </h2>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "18px", padding: "4px" }}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Password Strength ────────────────────────────────────────────────────

function getPasswordStrength(pw: string): number {
  let score = 0;
  if (pw.length >= 8) {score++;}
  if (pw.length >= 12) {score++;}
  if (/[A-Z]/.test(pw)) {score++;}
  if (/[0-9]/.test(pw)) {score++;}
  if (/[^a-zA-Z0-9]/.test(pw)) {score++;}
  return Math.min(score, 4);
}

function PasswordStrengthBar({ strength }: { strength: number }) {
  const labels = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#16a34a"];
  if (!strength) {return null;}
  return (
    <div style={{ marginTop: "6px" }}>
      <div style={{ display: "flex", gap: "3px", marginBottom: "4px" }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ flex: 1, height: "3px", borderRadius: "2px", background: i <= strength ? colors[strength] : "var(--surface-2)", transition: "background 300ms" }} />
        ))}
      </div>
      <div style={{ fontSize: "11px", color: colors[strength] }}>{labels[strength]}</div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) {return "Just now";}
  if (diff < 3_600_000) {return `${Math.floor(diff / 60_000)}m ago`;}
  if (diff < 86_400_000) {return `${Math.floor(diff / 3_600_000)}h ago`;}
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatEventLabel(event: string): string {
  return event.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  viewer: "Read-only access to dashboards and session logs.",
  operator: "Can start/stop environments and view logs. Cannot edit config.",
  admin: "Full access except user management changes still require elevation.",
  "super-admin": "Unrestricted access. Required for initial setup.",
};

// ─── Styles ───────────────────────────────────────────────────────────────

const btnPrimary: React.CSSProperties = {
  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
  border: "none", borderRadius: "8px", padding: "9px 18px",
  fontSize: "13px", fontWeight: 600, color: "white", cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  background: "var(--surface-1)", border: "1px solid var(--border-default)",
  borderRadius: "8px", padding: "9px 18px", fontSize: "13px", color: "var(--text-secondary)", cursor: "pointer",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 600,
  color: "var(--text-tertiary)", textTransform: "uppercase",
  letterSpacing: "0.05em", marginBottom: "6px",
};
const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(20,20,32,0.8)",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px",
  padding: "10px 12px", fontSize: "14px", color: "var(--text-primary)",
  outline: "none", fontFamily: "inherit", boxSizing: "border-box",
};
const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: "pointer",
};
const errorStyle: React.CSSProperties = {
  fontSize: "12px", color: "var(--accent-danger)", margin: 0,
};
const alertBox: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "12px",
  marginBottom: "16px", padding: "12px 16px",
  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
  borderRadius: "10px", fontSize: "13px", color: "var(--accent-danger)",
};
