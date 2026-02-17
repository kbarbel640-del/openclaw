"use client";

import type { Tenant } from "@six-fingered-man/governance";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Bot, Users, FolderOpen, Building2, Cpu } from "lucide-react";
import { useCallback, useMemo } from "react";

// ── Node Data Types ──────────────────────────────────────────────────────────

interface TenantData {
  label: string;
  entityType: string;
  multiSig: boolean;
}

interface AgentData {
  label: string;
  role: string;
  model: string;
  skills: string[];
}

interface HumanData {
  label: string;
  signal?: string;
  email?: string;
}

interface ProjectData {
  label: string;
  description?: string;
  agentCount: number;
}

// ── Custom Node Components ───────────────────────────────────────────────────

function TenantNode({ data }: { data: TenantData }) {
  return (
    <div className="rounded-lg border-2 border-[var(--color-accent)] bg-[var(--color-surface)] p-4 min-w-[180px] shadow-lg shadow-[var(--color-accent)]/10">
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[var(--color-accent)] !w-3 !h-3"
      />
      <div className="flex items-center gap-2 mb-1">
        <Building2 className="h-5 w-5 text-[var(--color-accent)]" />
        <span className="font-bold text-sm text-[var(--color-text)]">{data.label}</span>
      </div>
      <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
        {data.entityType}
      </div>
      {data.multiSig && (
        <div className="text-[10px] text-[var(--color-warning)] mt-1">Multi-Sig Required</div>
      )}
    </div>
  );
}

function AgentNode({ data }: { data: AgentData }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 min-w-[160px] shadow-md">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[var(--color-accent)] !w-2.5 !h-2.5"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[var(--color-accent)] !w-2.5 !h-2.5"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="to-human"
        className="!bg-[var(--color-success)] !w-2.5 !h-2.5"
      />
      <div className="flex items-center gap-2 mb-1">
        <Bot className="h-4 w-4 text-[var(--color-accent)]" />
        <span className="font-medium text-sm text-[var(--color-text)]">{data.label}</span>
      </div>
      <div className="text-[10px] text-[var(--color-text-muted)]">{data.role}</div>
      <div className="flex items-center gap-1 mt-1 text-[10px] text-[var(--color-text-muted)]">
        <Cpu className="h-3 w-3" />
        {data.model}
      </div>
      {data.skills.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {data.skills.slice(0, 3).map((s) => (
            <span
              key={s}
              className="px-1 py-0.5 rounded text-[9px] bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-muted)]"
            >
              {s}
            </span>
          ))}
          {data.skills.length > 3 && (
            <span className="text-[9px] text-[var(--color-text-muted)]">
              +{data.skills.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function HumanNode({ data }: { data: HumanData }) {
  return (
    <div className="rounded-lg border border-[var(--color-success)]/50 bg-[var(--color-surface)] p-3 min-w-[140px] shadow-md">
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-[var(--color-success)] !w-2.5 !h-2.5"
      />
      <div className="flex items-center gap-2 mb-1">
        <Users className="h-4 w-4 text-[var(--color-success)]" />
        <span className="font-medium text-sm text-[var(--color-text)]">{data.label}</span>
      </div>
      {data.signal && (
        <div className="text-[10px] text-[var(--color-text-muted)]">Signal: {data.signal}</div>
      )}
      {data.email && <div className="text-[10px] text-[var(--color-text-muted)]">{data.email}</div>}
    </div>
  );
}

function ProjectNode({ data }: { data: ProjectData }) {
  return (
    <div className="rounded-lg border border-[var(--color-warning)]/50 bg-[var(--color-surface)] p-3 min-w-[160px] shadow-md">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[var(--color-warning)] !w-2.5 !h-2.5"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[var(--color-warning)] !w-2.5 !h-2.5"
      />
      <div className="flex items-center gap-2 mb-1">
        <FolderOpen className="h-4 w-4 text-[var(--color-warning)]" />
        <span className="font-medium text-sm text-[var(--color-text)]">{data.label}</span>
      </div>
      {data.description && (
        <div className="text-[10px] text-[var(--color-text-muted)] line-clamp-2">
          {data.description}
        </div>
      )}
      <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
        {data.agentCount} agent{data.agentCount !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

// ── Layout Algorithm ─────────────────────────────────────────────────────────

function layoutNodes(tenant: Tenant): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const COL_WIDTH = 220;
  const ROW_HEIGHT = 160;

  // Tenant node at top center
  const agentCount = tenant.agents.length;
  const totalWidth = Math.max(agentCount, 1) * COL_WIDTH;
  const tenantX = totalWidth / 2 - 90;

  nodes.push({
    id: `tenant-${tenant.id}`,
    type: "tenant",
    position: { x: tenantX, y: 0 },
    data: {
      label: tenant.name,
      entityType: tenant.entityType,
      multiSig: tenant.multiSigRequired,
    },
  });

  // Tenant-scoped agents in row below
  tenant.agents.forEach((agent, i) => {
    const nodeId = `agent-${agent.id}`;
    nodes.push({
      id: nodeId,
      type: "agent",
      position: { x: i * COL_WIDTH, y: ROW_HEIGHT },
      data: {
        label: agent.name,
        role: agent.role,
        model: agent.model.model,
        skills: agent.skills,
      },
    });
    edges.push({
      id: `e-tenant-${agent.id}`,
      source: `tenant-${tenant.id}`,
      target: nodeId,
      animated: true,
      style: { stroke: "var(--color-accent)", strokeWidth: 1.5 },
    });
  });

  // Humans on the right
  const humanStartX = totalWidth + 80;
  tenant.humans.forEach((human, i) => {
    const nodeId = `human-${human.id}`;
    nodes.push({
      id: nodeId,
      type: "human",
      position: { x: humanStartX, y: ROW_HEIGHT + i * 100 },
      data: {
        label: human.name,
        signal: human.contact?.signal,
        email: human.contact?.email,
      },
    });

    // Connect first agent (CEO typically) to each human
    if (tenant.agents.length > 0) {
      edges.push({
        id: `e-agent-human-${human.id}`,
        source: `agent-${tenant.agents[0].id}`,
        sourceHandle: "to-human",
        target: nodeId,
        style: { stroke: "var(--color-success)", strokeWidth: 1, strokeDasharray: "5,5" },
        label: "reports to",
        labelStyle: { fontSize: 9, fill: "var(--color-text-muted)" },
      });
    }
  });

  // Projects below agents
  const projectY = ROW_HEIGHT * 2 + 40;
  tenant.projects.forEach((project, i) => {
    const projectId = `project-${project.id}`;
    nodes.push({
      id: projectId,
      type: "project",
      position: { x: i * COL_WIDTH + COL_WIDTH / 4, y: projectY },
      data: {
        label: project.name,
        description: project.description,
        agentCount: project.agents.length,
      },
    });

    // Connect tenant to project
    edges.push({
      id: `e-tenant-project-${project.id}`,
      source: `tenant-${tenant.id}`,
      target: projectId,
      style: { stroke: "var(--color-warning)", strokeWidth: 1, strokeDasharray: "3,3" },
    });

    // Project agents below each project
    project.agents.forEach((agent, j) => {
      const agentNodeId = `agent-${agent.id}`;
      nodes.push({
        id: agentNodeId,
        type: "agent",
        position: {
          x: i * COL_WIDTH + j * (COL_WIDTH * 0.8),
          y: projectY + ROW_HEIGHT,
        },
        data: {
          label: agent.name,
          role: agent.role,
          model: agent.model.model,
          skills: agent.skills,
        },
      });
      edges.push({
        id: `e-project-${agent.id}`,
        source: projectId,
        target: agentNodeId,
        style: { stroke: "var(--color-warning)", strokeWidth: 1.5 },
      });
    });
  });

  return { nodes, edges };
}

// ── Canvas Component ─────────────────────────────────────────────────────────

const nodeTypes: NodeTypes = {
  tenant: TenantNode,
  agent: AgentNode,
  human: HumanNode,
  project: ProjectNode,
};

export function GovernanceCanvas({ tenant }: { tenant: Tenant }) {
  const { nodes, edges } = useMemo(() => layoutNodes(tenant), [tenant]);

  const onInit = useCallback((instance: { fitView: () => void }) => {
    setTimeout(() => instance.fitView(), 50);
  }, []);

  return (
    <div className="w-full h-[600px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={onInit}
        fitView
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="governance-canvas"
      >
        <Background color="var(--color-border)" gap={20} size={1} />
        <Controls className="!bg-[var(--color-surface)] !border-[var(--color-border)] !shadow-lg [&>button]:!bg-[var(--color-surface)] [&>button]:!border-[var(--color-border)] [&>button]:!text-[var(--color-text-muted)] [&>button:hover]:!bg-[var(--color-surface-hover)]" />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === "tenant") {
              return "var(--color-accent)";
            }
            if (node.type === "agent") {
              return "var(--color-accent)";
            }
            if (node.type === "human") {
              return "var(--color-success)";
            }
            if (node.type === "project") {
              return "var(--color-warning)";
            }
            return "var(--color-border)";
          }}
          className="!bg-[var(--color-surface)] !border-[var(--color-border)]"
          maskColor="rgba(0,0,0,0.5)"
        />
      </ReactFlow>
    </div>
  );
}
