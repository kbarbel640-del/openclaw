/**
 * App Root — main application layout with sidebar navigation.
 */

import React, { useState } from "react";
import { Dashboard } from "./pages/Dashboard.js";

type Page = "dashboard" | "installer" | "config" | "skills" | "sessions" | "logs" | "security";

const NAV_ITEMS: { id: Page; label: string; icon: string; section?: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "◉" },
  { id: "sessions", label: "Sessions", icon: "◎" },
  { id: "logs", label: "Logs", icon: "☰" },
  { id: "config", label: "Configuration", icon: "⚙", section: "Management" },
  { id: "skills", label: "Skills", icon: "◈" },
  { id: "security", label: "Security", icon: "◆" },
  { id: "installer", label: "Setup Wizard", icon: "▶", section: "System" },
];

export function App() {
  const [activePage, setActivePage] = useState<Page>("dashboard");

  let currentSection = "";

  return (
    <>
      {/* macOS title bar drag region */}
      <div className="titlebar-drag" />

      <div className="app-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div style={{ padding: "16px 20px 8px", paddingTop: "48px" }}>
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
              if (item.section) currentSection = item.section;

              return (
                <React.Fragment key={item.id}>
                  {showSection && (
                    <div className="sidebar-section">{item.section}</div>
                  )}
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

          {/* Sidebar footer — environment status */}
          <div
            style={{
              padding: "16px 20px",
              borderTop: "1px solid var(--border-subtle)",
              fontSize: "12px",
              color: "var(--text-tertiary)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="status-dot healthy" />
              Environment Running
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {activePage === "dashboard" && <Dashboard />}
          {activePage === "installer" && <PlaceholderPage title="Setup Wizard" description="Guided installation and configuration" />}
          {activePage === "config" && <PlaceholderPage title="Configuration" description="Manage OpenClaw settings" />}
          {activePage === "skills" && <PlaceholderPage title="Skills" description="Manage approved skills" />}
          {activePage === "sessions" && <PlaceholderPage title="Active Sessions" description="Monitor running agent sessions" />}
          {activePage === "logs" && <PlaceholderPage title="Logs" description="View system and agent logs" />}
          {activePage === "security" && <PlaceholderPage title="Security" description="Security audit and integrity monitoring" />}
        </main>
      </div>
    </>
  );
}

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="page-header">
      <h1>{title}</h1>
      <p>{description}</p>
      <div
        className="card"
        style={{ marginTop: "24px", textAlign: "center", padding: "48px" }}
      >
        <p style={{ color: "var(--text-tertiary)" }}>
          Coming in a future phase. See the implementation plan for details.
        </p>
      </div>
    </div>
  );
}
