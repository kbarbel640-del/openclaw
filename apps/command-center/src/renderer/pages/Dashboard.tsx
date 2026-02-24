/**
 * Dashboard Page — primary monitoring view for the OpenClaw environment.
 *
 * Shows: environment health, uptime, resource usage, active sessions,
 * and quick actions (start/stop/restart).
 */

import React, { useEffect, useState, useCallback } from "react";
import type { EnvironmentStatus, DockerInfo, EnvironmentHealth } from "../../shared/ipc-types.js";
import type { OcccBridge } from "../../shared/ipc-types.js";
import { useAuth } from "../App.js";

// Access the typed bridge from preload
const occc = (window as unknown as { occc: OcccBridge }).occc;

/** Format milliseconds into a human-readable uptime string. */
function formatUptime(ms: number | null): string {
  if (!ms || ms <= 0) { return "—"; }
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60) % 60;
  const hours = Math.floor(seconds / 3600) % 24;
  const days = Math.floor(seconds / 86400);
  if (days > 0) { return `${days}d ${hours}h ${minutes}m`; }
  if (hours > 0) { return `${hours}h ${minutes}m`; }
  return `${minutes}m`;
}

/** Format bytes into human-readable. */
function formatBytes(bytes: number): string {
  if (bytes === 0) { return "0 B"; }
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/** Health to label mapping (user-friendly). */
const healthLabels: Record<EnvironmentHealth, string> = {
  healthy: "Running",
  degraded: "Degraded",
  unhealthy: "Error",
  stopped: "Stopped",
  unknown: "Checking…",
};

export function Dashboard() {
  const { token } = useAuth();
  const [status, setStatus] = useState<EnvironmentStatus | null>(null);
  const [dockerInfo, setDockerInfo] = useState<DockerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) { return; }
    try {
      const [envStatus, docker] = await Promise.all([
        occc.getEnvironmentStatus(token),
        occc.getDockerInfo(),
      ]);
      setStatus(envStatus);
      setDockerInfo(docker);
    } catch (err) {
      console.error("Failed to fetch status:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleStart = async () => {
    if (!token) { return; }
    setActionLoading(true);
    try {
      await occc.startEnvironment(token);
      await refresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    if (!token) { return; }
    setActionLoading(true);
    try {
      await occc.stopEnvironment(token);
      await refresh();
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  const health = status?.health ?? "unknown";
  const isRunning = health === "healthy" || health === "degraded";

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1>Dashboard</h1>
            <p>OpenClaw Environment Overview</p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {isRunning ? (
              <button
                className="btn btn-danger"
                onClick={handleStop}
                disabled={actionLoading}
              >
                {actionLoading ? <span className="spinner" /> : "■"} Stop
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleStart}
                disabled={actionLoading}
              >
                {actionLoading ? <span className="spinner" /> : "▶"} Start
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="card-grid">
        {/* Environment Health */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Environment</span>
            <span className={`status-dot ${health}`} />
          </div>
          <div className="stat-value" style={{ color: health === "healthy" ? "var(--accent-success)" : health === "unhealthy" ? "var(--accent-danger)" : "var(--text-primary)" }}>
            {healthLabels[health]}
          </div>
          <div className="stat-label">Status</div>
        </div>

        {/* Uptime */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Uptime</span>
          </div>
          <div className="stat-value">
            {formatUptime(status?.uptime ?? null)}
          </div>
          <div className="stat-label">Since last start</div>
        </div>

        {/* Core Service (Gateway) */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Core Service</span>
            <span className={`status-dot ${status?.gateway.health ?? "unknown"}`} />
          </div>
          <div style={{ display: "flex", gap: "24px", marginTop: "8px" }}>
            <div>
              <div className="stat-value" style={{ fontSize: "20px" }}>
                {status?.gateway.cpu.toFixed(1) ?? "0"}%
              </div>
              <div className="stat-label">CPU</div>
            </div>
            <div>
              <div className="stat-value" style={{ fontSize: "20px" }}>
                {status?.gateway.memoryMB ?? 0} MB
              </div>
              <div className="stat-label">Memory</div>
            </div>
          </div>
        </div>

        {/* Network I/O */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Network</span>
          </div>
          <div style={{ display: "flex", gap: "24px", marginTop: "8px" }}>
            <div>
              <div className="stat-value" style={{ fontSize: "20px" }}>
                {formatBytes(status?.gateway.networkRx ?? 0)}
              </div>
              <div className="stat-label">↓ Received</div>
            </div>
            <div>
              <div className="stat-value" style={{ fontSize: "20px" }}>
                {formatBytes(status?.gateway.networkTx ?? 0)}
              </div>
              <div className="stat-label">↑ Sent</div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Workspaces */}
      <div style={{ marginTop: "24px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "12px" }}>
          Agent Workspaces
        </h2>
        {(status?.sandboxes.length ?? 0) > 0 ? (
          <div className="card-grid">
            {status!.sandboxes.map((sb) => (
              <div className="card" key={sb.id}>
                <div className="card-header">
                  <span className="card-title">{sb.name}</span>
                  <span className={`status-dot ${sb.health}`} />
                </div>
                <div style={{ display: "flex", gap: "16px", fontSize: "13px", color: "var(--text-secondary)" }}>
                  <span>CPU: {sb.cpu.toFixed(1)}%</span>
                  <span>Mem: {sb.memoryMB} MB</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="card"
            style={{ textAlign: "center", padding: "32px", color: "var(--text-tertiary)" }}
          >
            No active agent workspaces
          </div>
        )}
      </div>

      {/* Engine Info */}
      {dockerInfo && (
        <div className="card" style={{ marginTop: "24px" }}>
          <div className="card-header">
            <span className="card-title">Engine Info</span>
          </div>
          <div style={{ display: "flex", gap: "32px", fontSize: "13px", color: "var(--text-secondary)" }}>
            <span>Type: {dockerInfo.variant === "docker-desktop" ? "Docker Desktop" : dockerInfo.variant === "docker-ce" ? "Docker CE" : dockerInfo.variant}</span>
            <span>Version: {dockerInfo.version}</span>
            <span>API: {dockerInfo.apiVersion}</span>
            <span>Status: {dockerInfo.running ? "Connected" : "Disconnected"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
