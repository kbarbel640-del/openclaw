"use client";

import { cn } from "@/lib/cn";
import type { AgentInfo, AgentStatus } from "@/lib/types";
import { Bot, Circle, Cpu, Server } from "lucide-react";

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: "text-[var(--color-success)]",
  busy: "text-[var(--color-warning)]",
  offline: "text-[var(--color-text-muted)]",
  error: "text-[var(--color-danger)]",
};

const STATUS_BORDER: Record<AgentStatus, string> = {
  idle: "border-[var(--color-success)]/30",
  busy: "border-[var(--color-warning)]/30",
  offline: "border-[var(--color-border)]",
  error: "border-[var(--color-danger)]/30",
};

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: "IDLE",
  busy: "BUSY",
  offline: "OFFLINE",
  error: "ERROR",
};

interface AgentCardProps {
  agent: AgentInfo;
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 p-4 rounded-lg",
        "bg-[var(--color-surface)] border",
        STATUS_BORDER[agent.status],
        "hover:bg-[var(--color-surface-hover)] transition-colors duration-150"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-[var(--color-accent)]" />
          <span className="font-bold text-sm tracking-wide text-[var(--color-text)]">
            {agent.codename}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Circle
            className={cn(
              "h-2.5 w-2.5 fill-current",
              STATUS_COLORS[agent.status],
              agent.status === "busy" && "animate-pulse-glow"
            )}
          />
          <span
            className={cn(
              "text-[10px] font-medium tracking-widest uppercase",
              STATUS_COLORS[agent.status]
            )}
          >
            {STATUS_LABELS[agent.status]}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-medium tracking-wider uppercase">
          {agent.role}
        </span>
      </div>

      <div className="flex flex-col gap-1.5 text-[11px] text-[var(--color-text-muted)]">
        <div className="flex items-center gap-1.5">
          <Cpu className="h-3 w-3" />
          <span className="truncate">{agent.model}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Server className="h-3 w-3" />
          <span>{agent.server}</span>
        </div>
      </div>

      {agent.status === "busy" && agent.currentTask && (
        <div className="mt-1 pt-2 border-t border-[var(--color-border)]">
          <p className="text-[11px] text-[var(--color-warning)] truncate leading-relaxed">
            {agent.currentTask}
          </p>
        </div>
      )}
    </div>
  );
}
