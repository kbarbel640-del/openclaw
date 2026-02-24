/**
 * App Root — auth-gated application layout.
 *
 * Auth flow:
 *   1. Check first-run → show SetupAccount
 *   2. Not authenticated → show LoginPage
 *   3. Authenticated → show main application shell
 */

import React, { useState, useEffect, createContext, useContext, useCallback } from "react";
import { Dashboard } from "./pages/Dashboard.js";
import { LoginPage } from "./pages/Login.js";
import { SetupAccount } from "./pages/SetupAccount.js";
import { ElevateModal } from "./components/ElevateModal.js";
import { InstallerWizard } from "./pages/installer/InstallerWizard.js";
import { ConfigCenter } from "./pages/config/ConfigCenter.js";
import { UserManagementPage } from "./pages/users/UserManagementPage.js";
import type { AuthSession, OcccBridge } from "../shared/ipc-types.js";

const occc = (window as unknown as { occc: OcccBridge }).occc;

// ─── Auth Context ──────────────────────────────────────────────────────────

interface AuthContextValue {
  session: AuthSession | null;
  token: string | null;
  requireElevation: (operationLabel: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  token: null,
  requireElevation: async () => false,
});

export function useAuth() {
  return useContext(AuthContext);
}

// ─── Navigation ────────────────────────────────────────────────────────────

type Page = "dashboard" | "installer" | "config" | "users" | "skills" | "sessions" | "logs" | "security";

const NAV_ITEMS: { id: Page; label: string; icon: string; section?: string; adminOnly?: boolean }[] = [
  { id: "dashboard", label: "Dashboard", icon: "◉" },
  { id: "sessions", label: "Sessions", icon: "◎" },
  { id: "logs", label: "Logs", icon: "☰" },
  { id: "config", label: "Configuration", icon: "⚙", section: "Manage" },
  { id: "skills", label: "Skills", icon: "◈" },
  { id: "security", label: "Security", icon: "◆" },
  { id: "users", label: "Users", icon: "👥", adminOnly: true },
  { id: "installer", label: "Setup Wizard", icon: "▶", section: "System" },
];

// ─── App Root ─────────────────────────────────────────────────────────────

type AppState = "loading" | "first-run" | "unauthenticated" | "wizard-pending" | "authenticated";

export function App() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<Page>("dashboard");
  const [envHealth, setEnvHealth] = useState<string>("unknown");

  // Elevation modal state
  const [elevateModal, setElevateModal] = useState<{
    operationLabel: string;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  // ─── Initial auth check ──────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      try {
        const firstRun = await occc.invoke?.("occc:auth:is-first-run") ?? false;
        if (firstRun) {
          setAppState("first-run");
          return;
        }
        // Restore session from sessionStorage (survives renderer reloads)
        const savedToken = sessionStorage.getItem("occc:token");
        if (savedToken) {
          const s = await occc.getSession(savedToken);
          if (s) {
            setSession(s);
            setToken(savedToken);
            setAppState("authenticated");
            return;
          }
        }
        setAppState("unauthenticated");
      } catch {
        setAppState("unauthenticated");
      }
    };
    void init();
  }, []);

  // Poll biometric availability once authenticated
  useEffect(() => {
    if (appState !== "authenticated") {return;}
    occc.invoke("occc:auth:biometric-available")
      .then((v) => setBiometricAvailable(v as boolean))
      .catch(() => {});
  }, [appState]);

  // Poll env health for tray indicator
  useEffect(() => {
    if (appState !== "authenticated" || !token) {return;}
    const tick = async () => {
      try {
        const status = await occc.getEnvironmentStatus(token);
        setEnvHealth(status.health);
      } catch {}
    };
    void tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [appState, token]);

  // ─── Auth handlers ───────────────────────────────────────────────

  const handleAuthenticated = useCallback((s: AuthSession, t: string) => {
    setSession(s);
    setToken(t);
    sessionStorage.setItem("occc:token", t);
    // After first-run account setup, go directly to the install wizard
    setAppState("wizard-pending");
  }, []);

  const handleLogout = useCallback(async () => {
    if (token) {
      try { await occc.logout(token); } catch {}
    }
    sessionStorage.removeItem("occc:token");
    setSession(null);
    setToken(null);
    setAppState("unauthenticated");
  }, [token]);

  // ─── Elevation ───────────────────────────────────────────────────

  const requireElevation = useCallback((operationLabel: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setElevateModal({ operationLabel, resolve });
    });
  }, []);

  // ─── Render states ───────────────────────────────────────────────

  if (appState === "loading") {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "var(--bg-primary)" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (appState === "first-run") {
    return <SetupAccount onComplete={handleAuthenticated} />;
  }

  if (appState === "wizard-pending") {
    return (
      <InstallerWizard
        onComplete={() => setAppState("authenticated")}
      />
    );
  }

  if (appState === "unauthenticated") {
    return (
      <LoginPage
        onAuthenticated={handleAuthenticated}
        onFirstRun={() => setAppState("first-run")}
      />
    );
  }

  // ─── Main Shell (authenticated) ──────────────────────────────────

  let currentSection = "";

  return (
    <AuthContext.Provider value={{ session, token, requireElevation }}>
      {/* Elevation modal overlay */}
      {elevateModal && token && (
        <ElevateModal
          operationLabel={elevateModal.operationLabel}
          sessionToken={token}
          biometricAvailable={biometricAvailable}
          onSuccess={() => {
            elevateModal.resolve(true);
            setElevateModal(null);
          }}
          onCancel={() => {
            elevateModal.resolve(false);
            setElevateModal(null);
          }}
        />
      )}

      {/* macOS titlebar drag region */}
      <div className="titlebar-drag" />

      <div className="app-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          {/* Branding */}
          <div style={{ padding: "16px 20px 8px", paddingTop: "52px" }}>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
              OpenClaw
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "2px" }}>
              Command Center
            </div>
          </div>

          <nav className="sidebar-nav">
            {NAV_ITEMS.map((item) => {
              const showSection = item.section && item.section !== currentSection;
              if (item.section) {currentSection = item.section;}
              return (
                <React.Fragment key={item.id}>
                  {showSection && <div className="sidebar-section">{item.section}</div>}
                  <div
                    className={`sidebar-item ${activePage === item.id ? "active" : ""}`}
                    onClick={() => setActivePage(item.id)}
                  >
                    <span className="icon">{item.icon}</span>
                    {item.label}
                  </div>
                </React.Fragment>
              );
            })}
          </nav>

          {/* Footer: user + status */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <span className={`status-dot ${envHealth}`} />
              <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
                {envHealth === "healthy" ? "Running" : envHealth === "stopped" ? "Stopped" : envHealth}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>
                {session?.role === "super-admin" ? "⬡ " : ""}{session?.userId?.slice(0, 8)}
              </div>
              <button
                onClick={handleLogout}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "12px", padding: "2px 6px" }}
                title="Sign out"
              >
                ⎋
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {activePage === "dashboard" && <Dashboard />}
          {activePage === "installer" && (
            <InstallerWizard onComplete={() => setActivePage("dashboard")} />
          )}
          {activePage === "config" && <ConfigCenter />}
          {activePage === "users" && <UserManagementPage />}
          {activePage !== "dashboard" && activePage !== "installer" && activePage !== "config" && activePage !== "users" && (
            <PlaceholderPage
              title={NAV_ITEMS.find((n) => n.id === activePage)?.label ?? ""}
              description="Coming in a future phase."
            />
          )}
        </main>
      </div>
    </AuthContext.Provider>
  );
}

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <div className="page-header">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="card" style={{ marginTop: "24px", textAlign: "center", padding: "56px 32px" }}>
        <div style={{ fontSize: "40px", marginBottom: "12px", opacity: 0.3 }}>◈</div>
        <p style={{ color: "var(--text-tertiary)" }}>This section is being built.</p>
      </div>
    </div>
  );
}
