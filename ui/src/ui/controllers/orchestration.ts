import type { GatewayBrowserClient } from "../gateway.ts";

export type OrchestrationLogEntry = {
  timestamp: number;
  runId: string;
  sequence: number;
  eventType: "handoff" | "delegation" | "contextShare" | "intentRoute";
  fromAgent?: string;
  toAgent?: string;
  intent?: string;
  confidence?: number;
  contextKey?: string;
  details?: Record<string, unknown>;
};

export type OrchestrationLogsResult = {
  entries: OrchestrationLogEntry[];
  total: number;
};

export type AgentOrchestrationConfig = {
  agentId: string;
  supervisor?: {
    enabled: boolean;
    defaultStrategy?: "delegate" | "collaborate" | "sequential";
  };
  intents?: Array<{
    id: string;
    keywords: string[];
    categories: string[];
    confidence?: number;
  }>;
  handoff?: {
    allowAgents?: string[];
    allowFrom?: string[];
    transferContext?: boolean;
  };
  sharedContext?: {
    enabled: boolean;
    allowAgents?: string[];
  };
};

export type OrchestrationConfigResult = {
  agentId: string;
  config: AgentOrchestrationConfig;
};

export type HandoffTargetsResult = {
  agentId: string;
  targets: string[];
};

export type SharedContextItem = {
  key: string;
  value: unknown;
  scope: "session" | "global";
  updatedAt: number;
};

export type SharedContextListResult = {
  agentId: string;
  scope: "session" | "global";
  items: SharedContextItem[];
};

export type OrchestrationState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  logsLoading: boolean;
  logsError: string | null;
  logsResult: OrchestrationLogsResult | null;
  configLoading: boolean;
  configError: string | null;
  configResult: OrchestrationConfigResult | null;
  handoffTargetsLoading: boolean;
  handoffTargetsError: string | null;
  handoffTargetsResult: HandoffTargetsResult | null;
  sharedContextLoading: boolean;
  sharedContextError: string | null;
  sharedContextResult: SharedContextListResult | null;
};

export async function loadOrchestrationLogs(
  state: OrchestrationState,
  options?: { runId?: string; limit?: number; offset?: number },
) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.logsLoading) {
    return;
  }
  state.logsLoading = true;
  state.logsError = null;
  try {
    const res = await state.client.request<OrchestrationLogsResult>("orchestration.logs.list", {
      runId: options?.runId,
      limit: options?.limit ?? 100,
      offset: options?.offset ?? 0,
    });
    if (res) {
      state.logsResult = res;
    }
  } catch (err) {
    state.logsError = String(err);
  } finally {
    state.logsLoading = false;
  }
}

export async function loadOrchestrationConfig(state: OrchestrationState, agentId: string) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.configLoading) {
    return;
  }
  state.configLoading = true;
  state.configError = null;
  try {
    const res = await state.client.request<OrchestrationConfigResult>("orchestration.config.get", {
      agentId,
    });
    if (res) {
      state.configResult = res;
    }
  } catch (err) {
    state.configError = String(err);
  } finally {
    state.configLoading = false;
  }
}

export async function loadHandoffTargets(state: OrchestrationState, agentId: string) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.handoffTargetsLoading) {
    return;
  }
  state.handoffTargetsLoading = true;
  state.handoffTargetsError = null;
  try {
    const res = await state.client.request<HandoffTargetsResult>("orchestration.handoff.targets", {
      agentId,
    });
    if (res) {
      state.handoffTargetsResult = res;
    }
  } catch (err) {
    state.handoffTargetsError = String(err);
  } finally {
    state.handoffTargetsLoading = false;
  }
}

export async function loadSharedContext(
  state: OrchestrationState,
  agentId: string,
  scope: "session" | "global",
  sessionKey?: string,
) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.sharedContextLoading) {
    return;
  }
  state.sharedContextLoading = true;
  state.sharedContextError = null;
  try {
    const res = await state.client.request<SharedContextListResult>(
      "orchestration.sharedContext.list",
      {
        agentId,
        scope,
        sessionKey,
      },
    );
    if (res) {
      state.sharedContextResult = res;
    }
  } catch (err) {
    state.sharedContextError = String(err);
  } finally {
    state.sharedContextLoading = false;
  }
}
