"use client";

import { useDashboardStore } from "@/lib/store";
import { cn } from "@/lib/cn";
import {
  Wifi,
  WifiOff,
  Users,
  Server,
  Skull,
  Loader,
} from "lucide-react";

export function StatusHeader() {
  const connectionStatus = useDashboardStore((s) => s.connectionStatus);
  const agents = useDashboardStore((s) => s.agents);

  const onlineCount = Array.from(agents.values()).filter(
    (a) => a.status !== "offline"
  ).length;

  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";

  return (
    <header
      className={cn(
        "flex items-center justify-between px-6 py-3",
        "border-b border-[var(--color-border)]",
        "bg-[var(--color-surface)]"
      )}
    >
      <div className="flex items-center gap-3">
        <Skull className="h-6 w-6 text-[var(--color-accent)]" />
        <h1 className="text-lg font-bold tracking-widest uppercase text-[var(--color-text)]">
          Diabolus Ex Machina
        </h1>
        <span className="text-xs text-[var(--color-text-muted)] tracking-wider ml-2">
          MISSION CONTROL
        </span>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="h-4 w-4 text-[var(--color-success)]" />
          ) : isConnecting ? (
            <Loader className="h-4 w-4 text-[var(--color-warning)] animate-spin" />
          ) : (
            <WifiOff className="h-4 w-4 text-[var(--color-danger)]" />
          )}
          <span
            className={cn(
              "text-xs font-medium uppercase tracking-wider",
              isConnected && "text-[var(--color-success)]",
              isConnecting && "text-[var(--color-warning)]",
              !isConnected && !isConnecting && "text-[var(--color-danger)]"
            )}
          >
            {connectionStatus}
          </span>
        </div>

        <div className="h-4 w-px bg-[var(--color-border)]" />

        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[var(--color-text-muted)]" />
          <span className="text-xs text-[var(--color-text-muted)]">
            {onlineCount} Agents
          </span>
        </div>

        <div className="h-4 w-px bg-[var(--color-border)]" />

        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-[var(--color-text-muted)]" />
          <span className="text-xs text-[var(--color-text-muted)]">
            3 GPUs
          </span>
        </div>
      </div>
    </header>
  );
}
