"use client";

import type {
  PolicyDocument,
  PolicyCatalogs,
  PolicyConstraints,
  PolicyScopeLevel,
  PolicyScope,
  PolicyCheckResult,
  ModelCatalogEntry,
  ToolCatalogEntry,
  SkillCatalogEntry,
  DID,
} from "@six-fingered-man/governance";
import { create } from "zustand";

// ── Types ────────────────────────────────────────────────────────────────────

interface PolicyState {
  policies: PolicyDocument[];
  availableModels: ModelCatalogEntry[];
  availableTools: ToolCatalogEntry[];
  availableSkills: SkillCatalogEntry[];
  loading: boolean;
  error: string | null;
}

interface PolicyActions {
  fetchPolicies: () => Promise<void>;
  setGlobalPolicy: (input: {
    catalogs: PolicyCatalogs;
    constraints: PolicyConstraints;
    updatedBy: DID;
  }) => Promise<PolicyDocument>;
  setPolicy: (
    scopeLevel: PolicyScopeLevel,
    scopeParams: Record<string, string>,
    input: {
      catalogs: PolicyCatalogs;
      constraints: PolicyConstraints;
      updatedBy: DID;
    },
  ) => Promise<PolicyDocument>;
  deletePolicy: (
    scopeLevel: PolicyScopeLevel,
    scopeParams: Record<string, string>,
    deletedBy: DID,
  ) => Promise<void>;
  checkPolicy: (input: {
    resourceType: string;
    resourceId: string;
    scope: PolicyScope;
  }) => Promise<PolicyCheckResult>;
  fetchAvailableModels: (
    scope?: PolicyScopeLevel,
    params?: Record<string, string>,
  ) => Promise<void>;
  fetchAvailableTools: (scope?: PolicyScopeLevel, params?: Record<string, string>) => Promise<void>;
  fetchAvailableSkills: (
    scope?: PolicyScopeLevel,
    params?: Record<string, string>,
  ) => Promise<void>;
  clearError: () => void;
}

type PolicyStore = PolicyState & PolicyActions;

// ── API Helper ───────────────────────────────────────────────────────────────

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

function scopeQueryString(scope?: PolicyScopeLevel, params?: Record<string, string>): string {
  const qs = new URLSearchParams();
  if (scope) {
    qs.set("scope", scope);
  }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) {
        qs.set(k, v);
      }
    }
  }
  return qs.toString();
}

// ── Store ────────────────────────────────────────────────────────────────────

export const usePolicyStore = create<PolicyStore>((set) => ({
  policies: [],
  availableModels: [],
  availableTools: [],
  availableSkills: [],
  loading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchPolicies: async () => {
    set({ loading: true, error: null });
    try {
      const policies = await api<PolicyDocument[]>("/api/policies");
      set({ policies, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  setGlobalPolicy: async (input) => {
    set({ loading: true, error: null });
    try {
      const doc = await api<PolicyDocument>("/api/policies", {
        method: "POST",
        body: JSON.stringify(input),
      });
      set((s) => ({
        policies: [...s.policies.filter((p) => p.scope.level !== "global"), doc],
        loading: false,
      }));
      return doc;
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  setPolicy: async (scopeLevel, scopeParams, input) => {
    set({ loading: true, error: null });
    try {
      const qs = new URLSearchParams(scopeParams).toString();
      const doc = await api<PolicyDocument>(`/api/policies/${scopeLevel}?${qs}`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
      set((s) => {
        const updated = s.policies.filter((p) => p.id !== doc.id);
        updated.push(doc);
        return { policies: updated, loading: false };
      });
      return doc;
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  deletePolicy: async (scopeLevel, scopeParams, deletedBy) => {
    set({ error: null });
    try {
      const qs = new URLSearchParams({ ...scopeParams, deletedBy }).toString();
      await api(`/api/policies/${scopeLevel}?${qs}`, { method: "DELETE" });
      set((s) => ({
        policies: s.policies.filter((p) => !(p.scope.level === scopeLevel)),
      }));
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  checkPolicy: async (input) => {
    try {
      return await api<PolicyCheckResult>("/api/policies/check", {
        method: "POST",
        body: JSON.stringify(input),
      });
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    }
  },

  fetchAvailableModels: async (scope, params) => {
    try {
      const qs = scopeQueryString(scope, params);
      const models = await api<ModelCatalogEntry[]>(
        `/api/policies/catalog/models${qs ? `?${qs}` : ""}`,
      );
      set({ availableModels: models });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  fetchAvailableTools: async (scope, params) => {
    try {
      const qs = scopeQueryString(scope, params);
      const tools = await api<ToolCatalogEntry[]>(
        `/api/policies/catalog/tools${qs ? `?${qs}` : ""}`,
      );
      set({ availableTools: tools });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  fetchAvailableSkills: async (scope, params) => {
    try {
      const qs = scopeQueryString(scope, params);
      const skills = await api<SkillCatalogEntry[]>(
        `/api/policies/catalog/skills${qs ? `?${qs}` : ""}`,
      );
      set({ availableSkills: skills });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
}));
