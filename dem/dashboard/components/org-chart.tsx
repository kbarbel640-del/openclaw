"use client";

import { useDashboardStore } from "@/lib/store";
import { cn } from "@/lib/cn";
import type { AgentId, AgentStatus } from "@/lib/types";
import { Circle, Network, Server, HardDrive } from "lucide-react";

const STATUS_DOT: Record<AgentStatus, string> = {
  idle: "text-[var(--color-success)]",
  busy: "text-[var(--color-warning)]",
  offline: "text-[var(--color-text-muted)]",
  error: "text-[var(--color-danger)]",
};

const STATUS_BORDER: Record<AgentStatus, string> = {
  idle: "border-[var(--color-success)]/40",
  busy: "border-[var(--color-warning)]/40",
  offline: "border-[var(--color-border)]",
  error: "border-[var(--color-danger)]/40",
};

function OrgNode({
  agentId,
  primary,
}: {
  agentId: AgentId;
  primary?: boolean;
}) {
  const agent = useDashboardStore((s) => s.agents.get(agentId));
  if (!agent) return null;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 px-3 py-2 rounded-md border",
        "bg-[var(--color-surface)]",
        STATUS_BORDER[agent.status],
        primary && "ring-1 ring-[var(--color-accent)]/20"
      )}
    >
      <div className="flex items-center gap-1.5">
        <Circle
          className={cn(
            "h-2 w-2 fill-current",
            STATUS_DOT[agent.status],
            agent.status === "busy" && "animate-pulse-glow"
          )}
        />
        <span
          className={cn(
            "text-xs font-bold tracking-wide",
            primary ? "text-[var(--color-accent)]" : "text-[var(--color-text)]"
          )}
        >
          {agent.codename}
        </span>
      </div>
      <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest">
        {agent.role}
      </span>
    </div>
  );
}

interface InfraNodeProps {
  name: string;
  agents: string[];
}

function InfraNode({ name, agents }: InfraNodeProps) {
  const allAgents = useDashboardStore((s) => s.agents);
  const serverAgents = Array.from(allAgents.values()).filter(
    (a) => a.server === name
  );
  const hasError = serverAgents.some((a) => a.status === "error");
  const hasBusy = serverAgents.some((a) => a.status === "busy");
  const allOffline =
    serverAgents.length > 0 && serverAgents.every((a) => a.status === "offline");

  let statusColor = "text-[var(--color-success)]";
  let statusLabel = "ONLINE";
  if (hasError) {
    statusColor = "text-[var(--color-danger)]";
    statusLabel = "ERROR";
  } else if (allOffline) {
    statusColor = "text-[var(--color-text-muted)]";
    statusLabel = "OFFLINE";
  } else if (hasBusy) {
    statusColor = "text-[var(--color-warning)]";
    statusLabel = "ACTIVE";
  }

  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)]">
      <div className="flex items-center gap-2">
        <HardDrive className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
        <span className="text-xs font-bold tracking-wide text-[var(--color-text)]">
          {name}
        </span>
        <span className="text-[10px] text-[var(--color-text-muted)]">
          [{agents.join(", ")}]
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Circle className={cn("h-2 w-2 fill-current", statusColor)} />
        <span
          className={cn(
            "text-[10px] font-medium tracking-widest uppercase",
            statusColor
          )}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

export function OrgChart() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--color-border)]">
        <Network className="h-4 w-4 text-[var(--color-accent)]" />
        <h2 className="text-xs font-bold tracking-widest uppercase text-[var(--color-text)]">
          Org Chart
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col items-center gap-0">
          <OrgNode agentId="ceo" primary />

          <div className="flex flex-col items-center">
            <div className="w-px h-4 bg-[var(--color-border)]" />
            <div className="flex items-start">
              <div className="w-16 h-px bg-[var(--color-border)] mt-0" />
              <div className="w-px h-px" />
              <div className="w-16 h-px bg-[var(--color-border)] mt-0" />
            </div>
          </div>

          <div className="relative w-full">
            <div
              className="absolute left-1/2 -translate-x-1/2 top-0 h-px bg-[var(--color-border)]"
              style={{ width: "70%" }}
            />
            <div className="flex justify-center gap-2 pt-4">
              <div className="flex flex-col items-center">
                <div className="w-px h-4 bg-[var(--color-border)] -mt-4" />
                <OrgNode agentId="coo" />
              </div>
              <div className="flex flex-col items-center">
                <div className="w-px h-4 bg-[var(--color-border)] -mt-4" />
                <OrgNode agentId="cfo" />
              </div>
              <div className="flex flex-col items-center">
                <div className="w-px h-4 bg-[var(--color-border)] -mt-4" />
                <OrgNode agentId="research" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <Server className="h-4 w-4 text-[var(--color-accent)]" />
            <h3 className="text-xs font-bold tracking-widest uppercase text-[var(--color-text)]">
              Infrastructure
            </h3>
          </div>
          <div className="flex flex-col gap-2">
            <InfraNode
              name="Maximus"
              agents={["Imperator", "Praetor"]}
            />
            <InfraNode name="Tiberius" agents={["Explorator"]} />
            <InfraNode name="Claudius" agents={["Quaestor"]} />
          </div>
        </div>
      </div>
    </div>
  );
}
