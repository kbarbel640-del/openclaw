"use client";

import { useDashboardStore } from "@/lib/store";
import { StatusHeader } from "@/components/status-header";
import { AgentCard } from "@/components/agent-card";
import { ActivityFeed } from "@/components/activity-feed";
import { OrgChart } from "@/components/org-chart";
import type { AgentId } from "@/lib/types";

const AGENT_ORDER: AgentId[] = ["ceo", "coo", "cfo", "research"];

export default function MissionControlPage() {
  const agents = useDashboardStore((s) => s.agents);

  return (
    <div className="flex flex-col h-screen">
      <StatusHeader />

      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <div className="grid grid-cols-4 gap-3">
          {AGENT_ORDER.map((id) => {
            const agent = agents.get(id);
            if (!agent) return null;
            return <AgentCard key={id} agent={agent} />;
          })}
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="w-[60%] border-r border-[var(--color-border)]">
          <ActivityFeed />
        </div>
        <div className="w-[40%]">
          <OrgChart />
        </div>
      </div>
    </div>
  );
}
