"use client";

import type {
  Tenant,
  Agent,
  Project,
  Human,
  EntityType,
  EntityConfig,
  TenantTemplate,
} from "@six-fingered-man/governance";
import { create } from "zustand";

// ── Types ────────────────────────────────────────────────────────────────────

interface EntityTypeOption {
  value: EntityType;
  label: string;
}

interface TenantState {
  tenants: Tenant[];
  activeTenant: Tenant | null;
  entityTypes: EntityTypeOption[];
  preview: TenantTemplate | null;
  loading: boolean;
  error: string | null;
}

interface TenantActions {
  fetchTenants: () => Promise<void>;
  fetchTenant: (id: string) => Promise<void>;
  createTenant: (input: {
    name: string;
    entityType: EntityType;
    entityConfig?: EntityConfig;
    overrides?: Record<string, unknown>;
  }) => Promise<Tenant>;
  deleteTenant: (id: string) => Promise<void>;
  fetchEntityTypes: () => Promise<void>;
  fetchPreview: (entityType: EntityType, config?: Record<string, string>) => Promise<void>;
  addAgent: (
    tenantId: string,
    input: { name: string; role: string; skills?: string[]; projectId?: string },
  ) => Promise<Agent>;
  removeAgent: (tenantId: string, agentId: string) => Promise<void>;
  createProject: (
    tenantId: string,
    input: { name: string; description?: string },
  ) => Promise<Project>;
  addHuman: (
    tenantId: string,
    input: { name: string; contact?: Record<string, string> },
  ) => Promise<Human>;
  clearError: () => void;
}

type TenantStore = TenantState & TenantActions;

// ── Store ────────────────────────────────────────────────────────────────────

async function api<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data as T;
}

export const useTenantStore = create<TenantStore>((set, get) => ({
  tenants: [],
  activeTenant: null,
  entityTypes: [],
  preview: null,
  loading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchTenants: async () => {
    set({ loading: true, error: null });
    try {
      const tenants = await api<Tenant[]>("/api/tenants");
      set({ tenants, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  fetchTenant: async (id) => {
    set({ loading: true, error: null });
    try {
      const tenant = await api<Tenant>(`/api/tenants/${id}`);
      set({ activeTenant: tenant, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  createTenant: async (input) => {
    set({ loading: true, error: null });
    try {
      const tenant = await api<Tenant>("/api/tenants", {
        method: "POST",
        body: JSON.stringify(input),
      });
      set((s) => ({
        tenants: [...s.tenants, tenant],
        loading: false,
      }));
      return tenant;
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  deleteTenant: async (id) => {
    set({ error: null });
    try {
      await api(`/api/tenants/${id}`, { method: "DELETE" });
      set((s) => ({
        tenants: s.tenants.filter((t) => t.id !== id),
        activeTenant: s.activeTenant?.id === id ? null : s.activeTenant,
      }));
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  fetchEntityTypes: async () => {
    try {
      const types = await api<EntityTypeOption[]>("/api/tenants/preview");
      set({ entityTypes: types });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  fetchPreview: async (entityType, config) => {
    try {
      const params = new URLSearchParams({ entityType });
      if (config) {
        for (const [k, v] of Object.entries(config)) {
          if (v) {
            params.set(k, v);
          }
        }
      }
      const preview = await api<TenantTemplate>(`/api/tenants/preview?${params}`);
      set({ preview });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  addAgent: async (tenantId, input) => {
    set({ error: null });
    try {
      const agent = await api<Agent>(`/api/tenants/${tenantId}/agents`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      // Refresh active tenant
      await get().fetchTenant(tenantId);
      return agent;
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    }
  },

  removeAgent: async (tenantId, agentId) => {
    set({ error: null });
    try {
      await api(`/api/tenants/${tenantId}/agents/${agentId}`, {
        method: "DELETE",
      });
      await get().fetchTenant(tenantId);
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  createProject: async (tenantId, input) => {
    set({ error: null });
    try {
      const project = await api<Project>(`/api/tenants/${tenantId}/projects`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      await get().fetchTenant(tenantId);
      return project;
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    }
  },

  addHuman: async (tenantId, input) => {
    set({ error: null });
    try {
      const human = await api<Human>(`/api/tenants/${tenantId}/humans`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      await get().fetchTenant(tenantId);
      return human;
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    }
  },
}));
