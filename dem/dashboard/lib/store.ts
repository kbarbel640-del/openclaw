import { create } from "zustand";
import type {
  AgentId,
  AgentInfo,
  AgentStatus,
  ActivityEvent,
  ConnectionStatus,
} from "./types";

const MAX_EVENTS = 500;

interface DashboardStore {
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;

  agents: Map<AgentId, AgentInfo>;
  updateAgent: (id: AgentId, update: Partial<AgentInfo>) => void;

  events: ActivityEvent[];
  addEvent: (event: ActivityEvent) => void;

  activeFilter: AgentId | "all";
  setActiveFilter: (filter: AgentId | "all") => void;
}

const initialAgents = new Map<AgentId, AgentInfo>([
  [
    "ceo",
    {
      id: "ceo",
      name: "Imperator",
      codename: "Imperator",
      role: "CEO",
      model: "deepseek-r1:70b",
      server: "Maximus",
      status: "idle" as AgentStatus,
    },
  ],
  [
    "coo",
    {
      id: "coo",
      name: "Praetor",
      codename: "Praetor",
      role: "COO",
      model: "qwen2.5:72b",
      server: "Maximus",
      status: "idle" as AgentStatus,
    },
  ],
  [
    "cfo",
    {
      id: "cfo",
      name: "Quaestor",
      codename: "Quaestor",
      role: "CFO",
      model: "deepseek-r1:14b",
      server: "Claudius",
      status: "idle" as AgentStatus,
    },
  ],
  [
    "research",
    {
      id: "research",
      name: "Explorator",
      codename: "Explorator",
      role: "Research",
      model: "deepseek-r1:32b",
      server: "Tiberius",
      status: "idle" as AgentStatus,
    },
  ],
]);

export const useDashboardStore = create<DashboardStore>((set) => ({
  connectionStatus: "disconnected",
  setConnectionStatus: (status) => set({ connectionStatus: status }),

  agents: new Map(initialAgents),
  updateAgent: (id, update) =>
    set((state) => {
      const agents = new Map(state.agents);
      const existing = agents.get(id);
      if (existing) {
        agents.set(id, { ...existing, ...update });
      }
      return { agents };
    }),

  events: [],
  addEvent: (event) =>
    set((state) => {
      const events = [...state.events, event];
      if (events.length > MAX_EVENTS) {
        return { events: events.slice(events.length - MAX_EVENTS) };
      }
      return { events };
    }),

  activeFilter: "all",
  setActiveFilter: (filter) => set({ activeFilter: filter }),
}));
