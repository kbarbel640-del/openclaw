import type { GatewayBrowserClient } from "../gateway.ts";
import type {
  TedConnectorAuthPollResponse,
  TedConnectorAuthRevokeResponse,
  TedConnectorAuthStartResponse,
  TedJobCardImpactPreview,
  TedIntakeRecommendation,
  TedJobCardDetail,
  TedKpiSuggestion,
  TedPolicyDocument,
  TedPolicyImpactPreview,
  TedPolicyKey,
  TedSourceDocument,
  TedWorkbenchSnapshot,
} from "../types.ts";

const TED_REQUEST_TIMEOUT_MS = 12_000;

async function requestTedWithTimeout<T>(
  client: GatewayBrowserClient,
  method: string,
  params: Record<string, unknown>,
): Promise<T> {
  const requestPromise = client.request<T>(method, params);
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `Ted request timed out after ${TED_REQUEST_TIMEOUT_MS / 1000}s. Reconnect from Overview and retry.`,
        ),
      );
    }, TED_REQUEST_TIMEOUT_MS);
    // avoid keeping event loop alive from timeout handle
    timer.unref?.();
  });
  return Promise.race([requestPromise, timeoutPromise]);
}

export type TedWorkbenchState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  tedLoading: boolean;
  tedSnapshot: TedWorkbenchSnapshot | null;
  tedError: string | null;
  tedRoleCardJson: string;
  tedRoleCardBusy: boolean;
  tedRoleCardResult: string | null;
  tedRoleCardError: string | null;
  tedProofBusyKey: string | null;
  tedProofResult: string | null;
  tedProofError: string | null;
  tedJobCardDetailLoading: boolean;
  tedJobCardDetail: TedJobCardDetail | null;
  tedJobCardDetailError: string | null;
  tedJobCardEditorMarkdown: string;
  tedJobCardSaveBusy: boolean;
  tedJobCardSaveError: string | null;
  tedJobCardSaveResult: string | null;
  tedJobCardPreviewBusy: boolean;
  tedJobCardPreviewError: string | null;
  tedJobCardPreview: TedJobCardImpactPreview | null;
  tedJobCardKpiSuggestBusy: boolean;
  tedJobCardKpiSuggestError: string | null;
  tedJobCardKpiSuggestion: TedKpiSuggestion | null;
  tedRecommendationBusyId: string | null;
  tedRecommendationError: string | null;
  tedIntakeTitle: string;
  tedIntakeOutcome: string;
  tedIntakeJobFamily: string;
  tedIntakeRiskLevel: string;
  tedIntakeAutomationLevel: string;
  tedIntakeBusy: boolean;
  tedIntakeError: string | null;
  tedIntakeRecommendation: TedIntakeRecommendation | null;
  tedThresholdManual: string;
  tedThresholdApprovalAge: string;
  tedThresholdTriageEod: string;
  tedThresholdBlockedExplainability: string;
  tedThresholdAcknowledgeRisk: boolean;
  tedThresholdBusy: boolean;
  tedThresholdError: string | null;
  tedThresholdResult: string | null;
  tedSourceDocLoading: boolean;
  tedSourceDocError: string | null;
  tedSourceDoc: TedSourceDocument | null;
  tedPolicyLoading: boolean;
  tedPolicyError: string | null;
  tedPolicyDoc: TedPolicyDocument | null;
  tedPolicyPreviewBusy: boolean;
  tedPolicyPreviewError: string | null;
  tedPolicyPreview: TedPolicyImpactPreview | null;
  tedPolicySaveBusy: boolean;
  tedPolicySaveError: string | null;
  tedPolicySaveResult: string | null;
  tedConnectorAuthBusyProfile: string | null;
  tedConnectorAuthError: string | null;
  tedConnectorAuthResult: string | null;
  tedConnectorDeviceCodeByProfile: Record<string, string>;
};

export async function loadTedWorkbench(state: TedWorkbenchState) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.tedLoading) {
    return;
  }

  state.tedLoading = true;
  state.tedError = null;
  try {
    const payload = await requestTedWithTimeout<TedWorkbenchSnapshot>(
      state.client,
      "ted.workbench",
      {},
    );
    state.tedSnapshot = payload;
    const gates = state.tedSnapshot.threshold_controls?.effective;
    if (gates) {
      state.tedThresholdManual = String(gates.manual_minutes_per_day_max);
      state.tedThresholdApprovalAge = String(gates.approval_queue_oldest_minutes_max);
      state.tedThresholdTriageEod = String(gates.unresolved_triage_eod_max);
      state.tedThresholdBlockedExplainability = String(
        gates.blocked_actions_missing_explainability_max,
      );
    }
  } catch (error) {
    state.tedError = String(error);
  } finally {
    state.tedLoading = false;
  }
}

export async function validateTedRoleCard(state: TedWorkbenchState) {
  if (!state.client || !state.connected || state.tedRoleCardBusy) {
    return;
  }
  state.tedRoleCardBusy = true;
  state.tedRoleCardError = null;
  state.tedRoleCardResult = null;
  try {
    const parsed = JSON.parse(state.tedRoleCardJson) as Record<string, unknown>;
    const response = await requestTedWithTimeout<Record<string, unknown>>(
      state.client,
      "ted.governance.rolecards.validate",
      {
        role_card: parsed,
      },
    );
    state.tedRoleCardResult = JSON.stringify(response, null, 2);
  } catch (error) {
    state.tedRoleCardError = String(error);
  } finally {
    state.tedRoleCardBusy = false;
  }
}

export async function runTedProof(state: TedWorkbenchState, proofScript: string) {
  if (!state.client || !state.connected || state.tedProofBusyKey) {
    return;
  }
  state.tedProofBusyKey = proofScript;
  state.tedProofError = null;
  state.tedProofResult = null;
  try {
    const response = await requestTedWithTimeout<Record<string, unknown>>(
      state.client,
      "ted.jobcards.proof.run",
      {
        proof_script: proofScript,
      },
    );
    state.tedProofResult = JSON.stringify(response, null, 2);
  } catch (error) {
    state.tedProofError = String(error);
  } finally {
    state.tedProofBusyKey = null;
  }
}

export async function loadTedJobCardDetail(state: TedWorkbenchState, id: string) {
  if (!state.client || !state.connected || state.tedJobCardDetailLoading) {
    return;
  }
  state.tedJobCardDetailLoading = true;
  state.tedJobCardDetailError = null;
  try {
    const response = await requestTedWithTimeout<TedJobCardDetail>(
      state.client,
      "ted.jobcards.detail",
      {
        id,
      },
    );
    state.tedJobCardDetail = response;
    state.tedJobCardEditorMarkdown = response.markdown;
    state.tedJobCardKpiSuggestion = null;
    state.tedJobCardKpiSuggestError = null;
  } catch (error) {
    state.tedJobCardDetailError = String(error);
  } finally {
    state.tedJobCardDetailLoading = false;
  }
}

export async function suggestTedJobCardKpis(state: TedWorkbenchState) {
  if (
    !state.client ||
    !state.connected ||
    state.tedJobCardKpiSuggestBusy ||
    !state.tedJobCardDetail
  ) {
    return;
  }
  state.tedJobCardKpiSuggestBusy = true;
  state.tedJobCardKpiSuggestError = null;
  try {
    const response = await requestTedWithTimeout<TedKpiSuggestion>(
      state.client,
      "ted.jobcards.suggest_kpis",
      {
        id: state.tedJobCardDetail.id,
      },
    );
    state.tedJobCardKpiSuggestion = response;
  } catch (error) {
    state.tedJobCardKpiSuggestError = String(error);
  } finally {
    state.tedJobCardKpiSuggestBusy = false;
  }
}

export async function saveTedJobCardDetail(state: TedWorkbenchState) {
  if (!state.client || !state.connected || state.tedJobCardSaveBusy || !state.tedJobCardDetail) {
    return;
  }
  state.tedJobCardSaveBusy = true;
  state.tedJobCardSaveError = null;
  state.tedJobCardSaveResult = null;
  try {
    const response = await requestTedWithTimeout<Record<string, unknown>>(
      state.client,
      "ted.jobcards.update",
      {
        id: state.tedJobCardDetail.id,
        markdown: state.tedJobCardEditorMarkdown,
      },
    );
    state.tedJobCardSaveResult = JSON.stringify(response, null, 2);
    await loadTedJobCardDetail(state, state.tedJobCardDetail.id);
    await loadTedWorkbench(state);
  } catch (error) {
    state.tedJobCardSaveError = String(error);
  } finally {
    state.tedJobCardSaveBusy = false;
  }
}

export async function previewTedJobCardUpdate(state: TedWorkbenchState) {
  if (!state.client || !state.connected || state.tedJobCardPreviewBusy || !state.tedJobCardDetail) {
    return;
  }
  state.tedJobCardPreviewBusy = true;
  state.tedJobCardPreviewError = null;
  try {
    const response = await requestTedWithTimeout<TedJobCardImpactPreview>(
      state.client,
      "ted.jobcards.preview_update",
      {
        id: state.tedJobCardDetail.id,
        markdown: state.tedJobCardEditorMarkdown,
      },
    );
    state.tedJobCardPreview = response;
  } catch (error) {
    state.tedJobCardPreviewError = String(error);
  } finally {
    state.tedJobCardPreviewBusy = false;
  }
}

export async function decideTedRecommendation(
  state: TedWorkbenchState,
  id: string,
  decision: "approved" | "dismissed",
) {
  if (!state.client || !state.connected || state.tedRecommendationBusyId) {
    return;
  }
  state.tedRecommendationBusyId = id;
  state.tedRecommendationError = null;
  try {
    await requestTedWithTimeout<Record<string, unknown>>(
      state.client,
      "ted.recommendations.decide",
      {
        id,
        decision,
      },
    );
    await loadTedWorkbench(state);
  } catch (error) {
    state.tedRecommendationError = String(error);
  } finally {
    state.tedRecommendationBusyId = null;
  }
}

export async function runTedIntakeRecommendation(state: TedWorkbenchState) {
  if (!state.client || !state.connected || state.tedIntakeBusy) {
    return;
  }
  state.tedIntakeBusy = true;
  state.tedIntakeError = null;
  try {
    const response = await requestTedWithTimeout<TedIntakeRecommendation>(
      state.client,
      "ted.intake.recommend",
      {
        title: state.tedIntakeTitle,
        outcome: state.tedIntakeOutcome,
        job_family: state.tedIntakeJobFamily,
        risk_level: state.tedIntakeRiskLevel,
        automation_level: state.tedIntakeAutomationLevel,
      },
    );
    state.tedIntakeRecommendation = response;
  } catch (error) {
    state.tedIntakeError = String(error);
  } finally {
    state.tedIntakeBusy = false;
  }
}

export async function applyTedThresholds(state: TedWorkbenchState, reset = false) {
  if (!state.client || !state.connected || state.tedThresholdBusy) {
    return;
  }
  state.tedThresholdBusy = true;
  state.tedThresholdError = null;
  state.tedThresholdResult = null;
  try {
    const response = await requestTedWithTimeout<Record<string, unknown>>(
      state.client,
      "ted.gates.set",
      {
        reset,
        acknowledge_risk: state.tedThresholdAcknowledgeRisk,
        overrides: reset
          ? undefined
          : {
              manual_minutes_per_day_max: Number.parseInt(state.tedThresholdManual, 10),
              approval_queue_oldest_minutes_max: Number.parseInt(state.tedThresholdApprovalAge, 10),
              unresolved_triage_eod_max: Number.parseInt(state.tedThresholdTriageEod, 10),
              blocked_actions_missing_explainability_max: Number.parseInt(
                state.tedThresholdBlockedExplainability,
                10,
              ),
            },
      },
    );
    const maybeResponse = response as { ok?: boolean; warning?: string };
    if (maybeResponse.ok === false) {
      state.tedThresholdError =
        maybeResponse.warning ??
        "Threshold update blocked. Acknowledge risk to apply relaxed thresholds.";
      state.tedThresholdResult = JSON.stringify(maybeResponse, null, 2);
      return;
    }
    state.tedThresholdResult = JSON.stringify(response, null, 2);
    await loadTedWorkbench(state);
  } catch (error) {
    state.tedThresholdError = String(error);
  } finally {
    state.tedThresholdBusy = false;
  }
}

export async function loadTedSourceDocument(
  state: TedWorkbenchState,
  key: "job_board" | "promotion_policy" | "value_friction" | "interrogation_cycle",
) {
  if (!state.client || !state.connected || state.tedSourceDocLoading) {
    return;
  }
  state.tedSourceDocLoading = true;
  state.tedSourceDocError = null;
  try {
    const response = await requestTedWithTimeout<TedSourceDocument>(state.client, "ted.docs.read", {
      key,
    });
    state.tedSourceDoc = response;
  } catch (error) {
    state.tedSourceDocError = String(error);
  } finally {
    state.tedSourceDocLoading = false;
  }
}

export async function loadTedPolicyDocument(state: TedWorkbenchState, key: TedPolicyKey) {
  if (!state.client || !state.connected || state.tedPolicyLoading) {
    return;
  }
  state.tedPolicyLoading = true;
  state.tedPolicyError = null;
  state.tedPolicyPreview = null;
  state.tedPolicyPreviewError = null;
  state.tedPolicySaveResult = null;
  state.tedPolicySaveError = null;
  try {
    const response = await requestTedWithTimeout<TedPolicyDocument>(
      state.client,
      "ted.policy.read",
      { key },
    );
    state.tedPolicyDoc = response;
  } catch (error) {
    state.tedPolicyError = String(error);
  } finally {
    state.tedPolicyLoading = false;
  }
}

export async function previewTedPolicyUpdate(state: TedWorkbenchState) {
  if (!state.client || !state.connected || state.tedPolicyPreviewBusy || !state.tedPolicyDoc) {
    return;
  }
  state.tedPolicyPreviewBusy = true;
  state.tedPolicyPreviewError = null;
  try {
    const response = await requestTedWithTimeout<TedPolicyImpactPreview>(
      state.client,
      "ted.policy.preview_update",
      {
        key: state.tedPolicyDoc.key,
        config: state.tedPolicyDoc.config,
      },
    );
    state.tedPolicyPreview = response;
  } catch (error) {
    state.tedPolicyPreviewError = String(error);
  } finally {
    state.tedPolicyPreviewBusy = false;
  }
}

export async function saveTedPolicyUpdate(state: TedWorkbenchState) {
  if (!state.client || !state.connected || state.tedPolicySaveBusy || !state.tedPolicyDoc) {
    return;
  }
  state.tedPolicySaveBusy = true;
  state.tedPolicySaveError = null;
  state.tedPolicySaveResult = null;
  try {
    const response = await requestTedWithTimeout<Record<string, unknown>>(
      state.client,
      "ted.policy.update",
      {
        key: state.tedPolicyDoc.key,
        config: state.tedPolicyDoc.config,
      },
    );
    state.tedPolicySaveResult = JSON.stringify(response, null, 2);
    await loadTedPolicyDocument(state, state.tedPolicyDoc.key);
    await loadTedWorkbench(state);
  } catch (error) {
    state.tedPolicySaveError = String(error);
  } finally {
    state.tedPolicySaveBusy = false;
  }
}

export async function startTedConnectorAuth(
  state: TedWorkbenchState,
  profileId: "olumie" | "everest",
) {
  if (!state.client || !state.connected || state.tedConnectorAuthBusyProfile) {
    return;
  }
  state.tedConnectorAuthBusyProfile = profileId;
  state.tedConnectorAuthError = null;
  state.tedConnectorAuthResult = null;
  try {
    const response = await requestTedWithTimeout<TedConnectorAuthStartResponse>(
      state.client,
      "ted.integrations.graph.auth.start",
      {
        profile_id: profileId,
      },
    );
    if (typeof response.device_code === "string" && response.device_code.trim().length > 0) {
      state.tedConnectorDeviceCodeByProfile = {
        ...state.tedConnectorDeviceCodeByProfile,
        [profileId]: response.device_code,
      };
    }
    state.tedConnectorAuthResult = JSON.stringify(response, null, 2);
    await loadTedWorkbench(state);
  } catch (error) {
    state.tedConnectorAuthError = String(error);
  } finally {
    state.tedConnectorAuthBusyProfile = null;
  }
}

export async function pollTedConnectorAuth(
  state: TedWorkbenchState,
  profileId: "olumie" | "everest",
) {
  if (!state.client || !state.connected || state.tedConnectorAuthBusyProfile) {
    return;
  }
  const deviceCode = state.tedConnectorDeviceCodeByProfile[profileId];
  if (!deviceCode) {
    state.tedConnectorAuthError =
      "No device code for this profile yet. Start sign-in first, then run Check sign-in.";
    return;
  }
  state.tedConnectorAuthBusyProfile = profileId;
  state.tedConnectorAuthError = null;
  state.tedConnectorAuthResult = null;
  try {
    const response = await requestTedWithTimeout<TedConnectorAuthPollResponse>(
      state.client,
      "ted.integrations.graph.auth.poll",
      {
        profile_id: profileId,
        device_code: deviceCode,
      },
    );
    state.tedConnectorAuthResult = JSON.stringify(response, null, 2);
    await loadTedWorkbench(state);
  } catch (error) {
    state.tedConnectorAuthError = String(error);
  } finally {
    state.tedConnectorAuthBusyProfile = null;
  }
}

export async function revokeTedConnectorAuth(
  state: TedWorkbenchState,
  profileId: "olumie" | "everest",
) {
  if (!state.client || !state.connected || state.tedConnectorAuthBusyProfile) {
    return;
  }
  state.tedConnectorAuthBusyProfile = profileId;
  state.tedConnectorAuthError = null;
  state.tedConnectorAuthResult = null;
  try {
    const response = await requestTedWithTimeout<TedConnectorAuthRevokeResponse>(
      state.client,
      "ted.integrations.graph.auth.revoke",
      {
        profile_id: profileId,
      },
    );
    state.tedConnectorAuthResult = JSON.stringify(response, null, 2);
    const nextCodes = { ...state.tedConnectorDeviceCodeByProfile };
    delete nextCodes[profileId];
    state.tedConnectorDeviceCodeByProfile = nextCodes;
    await loadTedWorkbench(state);
  } catch (error) {
    state.tedConnectorAuthError = String(error);
  } finally {
    state.tedConnectorAuthBusyProfile = null;
  }
}
