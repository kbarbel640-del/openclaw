import { describe, expect, it } from "vitest";
import { isToolAllowedByPolicyName, resolveSubagentToolPolicy } from "../agents/pi-tools.policy.js";
import { isLikelyMutatingToolName, isMutatingToolCall } from "../agents/tool-mutation.js";
import { DANGEROUS_ACP_TOOLS, DEFAULT_GATEWAY_HTTP_TOOL_DENY } from "./dangerous-tools.js";
import {
  HIGH_RISK_AUTHORIZATION_ACTION_VALUES,
  classifyHighRiskAuthorizationMessage,
} from "./high-risk-authorization.js";

describe("authorization guardrails contract", () => {
  it("keeps sessions_authorize on dangerous tool deny surfaces", () => {
    expect(DEFAULT_GATEWAY_HTTP_TOOL_DENY).toContain("sessions_authorize");
    expect(DANGEROUS_ACP_TOOLS.has("sessions_authorize")).toBe(true);
  });

  it("keeps sessions_authorize denied for subagents by default", () => {
    const cfg = {
      agents: { defaults: { subagents: { maxSpawnDepth: 2 } } },
    };
    const policy = resolveSubagentToolPolicy(cfg as never, 1);
    expect(isToolAllowedByPolicyName("sessions_authorize", policy)).toBe(false);
  });

  it("keeps sessions_authorize classified as mutating", () => {
    expect(isLikelyMutatingToolName("sessions_authorize")).toBe(true);
    expect(isMutatingToolCall("sessions_authorize", { action: "scm_push_pr" })).toBe(true);
  });

  it("keeps high-risk action coverage and push authorization detection", () => {
    expect(HIGH_RISK_AUTHORIZATION_ACTION_VALUES).toEqual(
      expect.arrayContaining([
        "high_risk_relay",
        "scm_push_pr",
        "deploy_release",
        "destructive_system",
        "credential_access",
        "financial_transfer",
      ]),
    );
    const pushAuth = classifyHighRiskAuthorizationMessage(
      "PUSH AUTHORIZED - push the branch and open the PR now",
    );
    expect(pushAuth.isHighRiskAuthorization).toBe(true);
    expect(pushAuth.action).toBe("scm_push_pr");
  });
});
