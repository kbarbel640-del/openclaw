"use client";

import { useEffect, useRef } from "react";
import { useDashboardStore } from "@/lib/store";
import { cn } from "@/lib/cn";
import type { ActivityEvent, AgentId } from "@/lib/types";
import {
  MessageSquare,
  GitBranch,
  ShieldCheck,
  Activity,
  KeyRound,
  AlertTriangle,
} from "lucide-react";

const AGENT_COLORS: Record<AgentId, string> = {
  ceo: "text-[#a78bfa]",
  coo: "text-[#60a5fa]",
  cfo: "text-[#34d399]",
  research: "text-[#fbbf24]",
};

const EVENT_ICONS: Record<ActivityEvent["type"], typeof MessageSquare> = {
  message: MessageSquare,
  delegation: GitBranch,
  validation: ShieldCheck,
  status: Activity,
  auth: KeyRound,
  error: AlertTriangle,
};

const EVENT_COLORS: Record<ActivityEvent["type"], string> = {
  message: "text-[var(--color-text-muted)]",
  delegation: "text-[var(--color-accent)]",
  validation: "text-[var(--color-success)]",
  status: "text-[var(--color-text-muted)]",
  auth: "text-[var(--color-warning)]",
  error: "text-[var(--color-danger)]",
};

const FILTER_OPTIONS: { label: string; value: AgentId | "all" }[] = [
  { label: "All", value: "all" },
  { label: "CEO", value: "ceo" },
  { label: "COO", value: "coo" },
  { label: "CFO", value: "cfo" },
  { label: "RES", value: "research" },
];

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function EventRow({ event }: { event: ActivityEvent }) {
  const Icon = EVENT_ICONS[event.type];

  return (
    <div className="flex items-start gap-3 px-3 py-2 hover:bg-[var(--color-surface-hover)] transition-colors duration-100 animate-slide-in">
      <span className="text-[11px] text-[var(--color-text-muted)] whitespace-nowrap pt-0.5 tabular-nums">
        {formatTime(event.timestamp)}
      </span>
      <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", EVENT_COLORS[event.type])} />
      <div className="flex-1 min-w-0">
        <span className={cn("text-xs font-semibold mr-2", AGENT_COLORS[event.agentId])}>
          {event.agentName}
        </span>
        <span className="text-xs text-[var(--color-text-muted)] break-words">
          {event.content}
        </span>
      </div>
    </div>
  );
}

export function ActivityFeed() {
  const events = useDashboardStore((s) => s.events);
  const activeFilter = useDashboardStore((s) => s.activeFilter);
  const setActiveFilter = useDashboardStore((s) => s.setActiveFilter);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredEvents =
    activeFilter === "all"
      ? events
      : events.filter((e) => e.agentId === activeFilter);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredEvents.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--color-accent)]" />
          <h2 className="text-xs font-bold tracking-widest uppercase text-[var(--color-text)]">
            Activity Feed
          </h2>
          <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
            ({filteredEvents.length})
          </span>
        </div>

        <div className="flex items-center gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setActiveFilter(opt.value)}
              className={cn(
                "px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase rounded",
                "transition-colors duration-100",
                activeFilter === opt.value
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-[var(--color-text-muted)]">
              Awaiting agent activity...
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]/30">
            {filteredEvents.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
