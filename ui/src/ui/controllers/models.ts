import type { GatewayBrowserClient } from "../gateway.ts";

export type ModelCatalogRow = {
  id: string;
  name?: string;
  provider?: string;
  contextWindow?: number;
  reasoning?: boolean;
  input?: string[];
  capabilities?: {
    coding?: boolean;
    reasoning?: boolean;
    vision?: boolean;
    general?: boolean;
    fast?: boolean;
    creative?: boolean;
    performanceTier?: string;
    costTier?: string;
  };
  tags?: string[];
};

export type ModelsState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  modelsLoading: boolean;
  modelsError: string | null;
  modelsCatalog: ModelCatalogRow[];
};

export async function loadModelsCatalog(state: ModelsState) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.modelsLoading) {
    return;
  }
  state.modelsLoading = true;
  state.modelsError = null;
  try {
    const res = await state.client.request<{ models?: unknown[] }>("models.list", {});
    const raw = Array.isArray(res?.models) ? res.models : [];
    state.modelsCatalog = raw.filter((m): m is ModelCatalogRow =>
      Boolean(m && typeof m === "object"),
    );
  } catch (err) {
    state.modelsError = String(err);
  } finally {
    state.modelsLoading = false;
  }
}
