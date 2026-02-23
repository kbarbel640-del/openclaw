import { TrustClient, TrustError } from "./client.js";

/**
 * Slash command handlers for operator inspection.
 * Registered via api.registerCommand() in the plugin entry point.
 */

export function trustStatusHandler(client: TrustClient, agentId: string) {
  return async () => {
    try {
      const rep = await client.reputation(agentId);
      const score = (rep.trust_score * 100).toFixed(1);
      const chain = rep.chain_intact ? "intact" : "BROKEN";

      return {
        text: [
          `**A2A Trust Status for \`${agentId}\`**`,
          "",
          `| Metric | Value |`,
          `|--------|-------|`,
          `| Trust Score | ${score}% |`,
          `| Chain Length | ${rep.chain_length} |`,
          `| Attestations | ${rep.attestation_count} |`,
          `| Outcomes Verified | ${rep.outcome_count} |`,
          `| Outcomes Achieved | ${rep.achieved_count} |`,
          `| Chain Integrity | ${chain} |`,
        ].join("\n"),
      };
    } catch (e) {
      if (e instanceof TrustError) {
        return {
          text: `Trust status unavailable: ${e.status} — ${e.detail}`,
        };
      }
      return { text: `Trust status unavailable: ${String(e)}` };
    }
  };
}

export function trustCheckHandler(client: TrustClient) {
  return async (ctx: { args?: string }) => {
    const peerAgentId = ctx.args?.trim();
    if (!peerAgentId) {
      return {
        text: "Usage: `/trustcheck <agent-id>` — check another agent's trust score",
      };
    }

    try {
      const rep = await client.reputation(peerAgentId);
      const score = (rep.trust_score * 100).toFixed(1);
      const verdict =
        rep.trust_score >= 0.7
          ? "HIGH TRUST"
          : rep.trust_score >= 0.4
            ? "MODERATE TRUST"
            : rep.trust_score >= 0.1
              ? "LOW TRUST"
              : "NO HISTORY";

      return {
        text: [
          `**Trust Check: \`${peerAgentId}\`** — ${verdict}`,
          "",
          `| Metric | Value |`,
          `|--------|-------|`,
          `| Trust Score | ${score}% |`,
          `| Chain Length | ${rep.chain_length} records |`,
          `| Attestations | ${rep.attestation_count} |`,
          `| Outcomes | ${rep.achieved_count}/${rep.outcome_count} achieved |`,
          `| Chain Intact | ${rep.chain_intact ? "Yes" : "BROKEN"} |`,
        ].join("\n"),
      };
    } catch (e) {
      if (e instanceof TrustError && e.status === 404) {
        return {
          text: `Agent \`${peerAgentId}\` has no trust history. They haven't verified or attested any actions yet.`,
        };
      }
      return { text: `Trust check failed: ${String(e)}` };
    }
  };
}

export function trustVerifyHandler(client: TrustClient) {
  return async (ctx: { args?: string }) => {
    const args = ctx.args?.trim();
    if (!args) {
      return {
        text: [
          "Usage: `/trustverify <action_type> <json_payload>`",
          "",
          'Example: `/trustverify motor_command {"speed": 5.0}`',
        ].join("\n"),
      };
    }

    const spaceIdx = args.indexOf(" ");
    if (spaceIdx === -1) {
      return {
        text: "Usage: `/trustverify <action_type> <json_payload>`",
      };
    }

    const actionType = args.substring(0, spaceIdx);
    const payloadStr = args.substring(spaceIdx + 1);

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(payloadStr) as Record<string, unknown>;
    } catch {
      return { text: "Invalid JSON payload." };
    }

    try {
      const result = await client.verify({
        action_type: actionType,
        action_payload: payload,
      });

      const emoji = result.decision === "ALLOW" ? "" : result.decision === "CLAMP" ? "" : "";

      return {
        text: [
          `**Decision: ${result.decision}** ${emoji}`,
          "",
          `| Field | Value |`,
          `|-------|-------|`,
          `| Verification ID | \`${result.verification_id}\` |`,
          `| Epoch | ${result.epoch} |`,
          `| Reason | ${result.reason} |`,
          `| Release Token | \`${result.release_token?.substring(0, 16) ?? "none"}...\` |`,
          `| Provenance Hash | \`${result.provenance_hash.substring(0, 16)}...\` |`,
        ].join("\n"),
      };
    } catch (e) {
      return { text: `Verify failed: ${String(e)}` };
    }
  };
}
