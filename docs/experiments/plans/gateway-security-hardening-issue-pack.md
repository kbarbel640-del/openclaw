---
summary: "Review-first GitHub issue drafts for gateway abuse hardening (A-E) with overlap boundaries"
read_when:
  - Preparing security hardening issues for gateway abuse controls
  - Verifying non-duplication with active PRs before filing
owner: "openclaw"
status: "draft"
last_updated: "2026-02-25"
title: "Gateway Security Hardening Issue Pack"
---

# Gateway Security Hardening Issue Pack

Review-first draft set. Do not post yet.

## Overlap Boundary Check (Active Work)

Existing work that this pack must not duplicate:

- [#15035](https://github.com/openclaw/openclaw/pull/15035) merged: auth brute-force and auth rate limiting.
- [#19515](https://github.com/openclaw/openclaw/pull/19515) open: per-connection WebSocket rate limiting.
- [#25751](https://github.com/openclaw/openclaw/pull/25751) open: per-sender message rate limiting and cost budget tracking.
- [#26050](https://github.com/openclaw/openclaw/pull/26050) open: Feishu webhook state bounding.
- [#26067](https://github.com/openclaw/openclaw/pull/26067) open: Feishu off-path webhook budget isolation.

Shared explicit non-goals for every ticket in this pack:

- Not replacing existing auth/websocket/webhook/per-sender throttles.
- Not re-implementing #25751, #19515, #15035, #26067, or #26050.

## Ticket A Draft

### Title

`Gateway: Add semantic capability-extraction anomaly detection across chat/send/tool-event traffic`

### Source trigger

- [Anthropic report: Detecting and preventing distillation attacks](https://www.anthropic.com/news/detecting-and-preventing-distillation-attacks)
- internal digest: `research/digests/2026-02-24.md`

### Problem statement

OpenClaw has auth and volumetric throttles, but no semantic detector for repeated capability-extraction behavior spanning `chat.send`, `send`, and tool-event streams. Authenticated slow-drip extraction can evade simple per-endpoint rate limits.

### Proposed scope

1. Add gateway anomaly detector with normalized prompt and tool-sequence fingerprints.
2. Correlate by actor/device/IP/session tuple for post-auth traffic.
3. Apply staged actions: `observe -> throttle -> temporary block`.
4. Emit structured security audit signals with method, fingerprint, actor tuple, threshold, and action.
5. Add config flags and thresholds for environment tuning.

### Acceptance criteria

1. Detector evaluates `chat.send`, `send`, and tool-event-enabled chat flows.
2. Threshold actions return retryable errors with `retryAfterMs` for RPC surfaces.
3. Security events are queryable with actor/device/IP/session dimensions.
4. Tests cover normal traffic, repeated-template abuse, and false-positive guardrails.
5. Docs include tuning guidance and response playbook entry points.

### Non-goals

- Not replacing existing auth/websocket/webhook/per-sender throttles.
- Not re-implementing #25751, #19515, #15035, #26067, or #26050.

### Why this is net-new

Existing PRs are volumetric and ingress-specific. This ticket adds semantic pattern detection and staged response across methods and tool streams, which current controls do not provide.

## Ticket B Draft

### Title

`Gateway: Add unified post-auth abuse quotas across chat + send + node.invoke with consistent retry semantics`

### Source trigger

- [Anthropic report: Detecting and preventing distillation attacks](https://www.anthropic.com/news/detecting-and-preventing-distillation-attacks)
- internal digest: `research/digests/2026-02-24.md`

### Problem statement

`send`, `chat.send`, and `node.invoke` do not share a unified post-auth budget model. Current protections are fragmented by surface, causing inconsistent behavior and weak operator visibility.

### Proposed scope

1. Introduce shared burst + sustained budgets across `chat.send`, `send`, and `node.invoke`.
2. Key budgets by actor+device+IP (+channel/account when present).
3. Provide per-method defaults with config overrides.
4. Normalize throttle responses and retry metadata semantics.
5. Emit operator-visible quota audit signals for triage and incident correlation.

### Acceptance criteria

1. Limits apply consistently to `chat.send`, `send`, and `node.invoke`.
2. RPC throttles return `UNAVAILABLE` with `retryable=true` and `retryAfterMs`.
3. HTTP surfaces return `429` with `Retry-After` when mapped endpoints are throttled.
4. Logs include quota key dimensions, method, and actor tuple.
5. Tests cover per-method limits, partitioning, and deterministic reset behavior.

### Non-goals

- Not replacing existing auth/websocket/webhook/per-sender throttles.
- Not re-implementing #25751, #19515, #15035, #26067, or #26050.

### Why this is net-new

Current and pending work is per-sender, per-connection, or webhook-path specific. This ticket standardizes one post-auth quota contract across core egress-heavy methods with consistent retry semantics and operator audit visibility.

## Ticket C Draft

### Title

`Gateway: Add cross-account and proxy-fanout campaign correlation for abuse clustering`

### Source trigger

- [Anthropic report: Detecting and preventing distillation attacks](https://www.anthropic.com/news/detecting-and-preventing-distillation-attacks)
- internal digest: `research/digests/2026-02-24.md`

### Problem statement

Current controls focus on single keys (connection, sender, webhook path). They do not cluster related activity across accounts/sessions/proxies, leaving campaign-level abuse under-detected.

### Proposed scope

1. Add correlation service that links events across actor/device/IP/session/account dimensions.
2. Detect proxy-fanout and cross-account reuse patterns from shared infrastructure signals.
3. Compute campaign-level risk scores from repeated weak signals.
4. Emit cluster IDs and confidence metadata into security audit stream.
5. Add operator query filters for cluster timeline and blast radius views.

### Acceptance criteria

1. Correlation links are generated from gateway abuse and anomaly events.
2. Clustered activity is labeled with stable cluster IDs and score/confidence fields.
3. Operators can retrieve correlated events by actor, account, IP, or cluster ID.
4. Tests validate fanout clustering, false-link controls, and decay/expiry behavior.
5. Docs define tuning knobs and escalation thresholds.

### Non-goals

- Not replacing existing auth/websocket/webhook/per-sender throttles.
- Not re-implementing #25751, #19515, #15035, #26067, or #26050.

### Why this is net-new

No current PR provides campaign-level cross-account/cross-proxy clustering. Existing controls stop local bursts but do not explain coordinated abuse across identities.

## Ticket D Draft

### Title

`Gateway: Harden account verification and anti-fraud onboarding gates for high-risk abuse patterns`

### Source trigger

- [Anthropic report: Detecting and preventing distillation attacks](https://www.anthropic.com/news/detecting-and-preventing-distillation-attacks)
- internal digest: `research/digests/2026-02-24.md`

### Problem statement

Post-auth abuse controls are necessary but insufficient when account onboarding and trust elevation are weak. Attackers can create low-friction accounts and spread traffic before enforcement signals mature.

### Proposed scope

1. Define risk-based onboarding gates for elevated gateway capabilities.
2. Add verification checkpoints for high-risk account/device patterns.
3. Introduce trust-tier flags used by quota and anomaly policies.
4. Log verification and trust-tier transitions as audit events.
5. Document operator workflows for approving, downgrading, and quarantining accounts.

### Acceptance criteria

1. High-risk traffic patterns can trigger verification or trust-tier downgrade.
2. Trust tier is available as a policy input for quota and anomaly enforcement.
3. Operator-visible audit log includes trust transitions with actor/device/IP context.
4. Tests cover trusted, untrusted, and escalating-risk onboarding paths.
5. Docs provide default policy recommendations and rollback steps.

### Non-goals

- Not replacing existing auth/websocket/webhook/per-sender throttles.
- Not re-implementing #25751, #19515, #15035, #26067, or #26050.

### Why this is net-new

Existing PRs throttle traffic after behavior appears. This ticket adds pre- and early-post-auth trust controls that reduce attack surface before sustained abuse emerges.

## Ticket E Draft

### Title

`Gateway: Add incident-response automation and tool-use exfiltration audit trail across channels`

### Source trigger

- [Anthropic report: Detecting and preventing distillation attacks](https://www.anthropic.com/news/detecting-and-preventing-distillation-attacks)
- internal digest: `research/digests/2026-02-24.md`

### Problem statement

Incident handling is mostly manual and tool-event telemetry is not structured as a durable cross-channel exfiltration audit trail. This slows containment and weakens post-incident forensics.

### Proposed scope

1. Add automatic containment actions tied to severity thresholds.
2. Define operator runbook and response states (`triage`, `contained`, `recovered`).
3. Capture durable tool-use exfiltration audit events across gateway and channel fanout paths.
4. Add incident timeline view keyed by actor/session/cluster.
5. Provide exportable evidence bundles for postmortems.

### Acceptance criteria

1. High-severity abuse signals can trigger configurable auto-containment.
2. Tool-use exfiltration audit events are durable and queryable across channels.
3. Operator workflow records incident state transitions and rationale.
4. Tests validate containment trigger safety and audit event completeness.
5. Docs include on-call playbook, containment rollback, and evidence handling.

### Non-goals

- Not replacing existing auth/websocket/webhook/per-sender throttles.
- Not re-implementing #25751, #19515, #15035, #26067, or #26050.

### Why this is net-new

Existing controls focus on request acceptance/rejection. This ticket adds containment orchestration and durable exfiltration-grade evidence trails needed for fast response and accountable investigations.
