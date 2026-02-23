---
name: a2a-trust
description: Cryptographic decision trust for agent-to-agent communication
version: 0.1.0
metadata:
  openclaw:
    requires:
      env: []
      bins: []
    primaryEnv: ""
    always: false
    skillKey: a2a-trust
    os:
      - linux
      - macos
      - windows
---

# A2A Decision Trust

You have access to cryptographic trust verification for agent-to-agent communication.
This is NOT governance — it is decision precision. You use these tools to make
sharper, faster decisions when working with other agents or executing actions.

## When to Use Trust Verification

Use trust tools when you need to:

1. **Verify before acting** — Check if an action is within safe bounds before execution
2. **Build your reputation** — Attest completed actions so other agents can trust you
3. **Bind intent to outcome** — Link what you plan to do with what you actually did
4. **Check a peer agent** — Look up another agent's trust score before collaborating

## Available Gateway Methods

### kevros.trust.verify

Call before executing an action. Returns ALLOW, CLAMP, or DENY with a
cryptographic release token that proves the decision was made.

```json
{
  "action_type": "api_call",
  "action_payload": { "endpoint": "/deploy", "service": "api-v2" },
  "policy_context": {
    "max_values": { "replicas": 3 },
    "forbidden_keys": ["sudo", "force"]
  }
}
```

- **ALLOW**: Proceed as planned
- **CLAMP**: Action was adjusted to safe bounds — use `applied_action` instead
- **DENY**: Action rejected — do not proceed

The `release_token` in the response is cryptographic proof. Share it with
collaborating agents so they can independently verify your decision was real.

### kevros.trust.attest

Call after completing an action. This builds your trust history — like a
cryptographic resume. The raw payload is SHA-256 hashed; your actual data
is never stored.

```json
{
  "action_description": "Deployed api-v2 with 2 replicas",
  "action_payload": { "service": "api-v2", "replicas": 2, "status": "success" },
  "context": { "environment": "production", "triggered_by": "scheduled" }
}
```

Each attestation adds a record to your provenance chain. Over time,
a longer chain with consistent outcomes = higher trust score.

### kevros.trust.bind

Call when you have a multi-step plan. Bind creates a cryptographic link
between your intent and your command, so you can later prove you did
exactly what you said you would.

```json
{
  "intent_type": "MAINTENANCE",
  "intent_description": "Scale api-v2 to handle traffic spike",
  "command_payload": { "action": "scale", "service": "api-v2", "replicas": 5 },
  "goal_state": { "replicas": 5, "healthy": true }
}
```

Save the `intent_id` and `binding_id` from the response.

### kevros.trust.verify-outcome

Call after executing a bound intent. Compares what actually happened
against what you planned.

```json
{
  "intent_id": "<from bind response>",
  "binding_id": "<from bind response>",
  "actual_state": { "replicas": 5, "healthy": true },
  "tolerance": 0.1
}
```

Returns ACHIEVED, PARTIALLY_ACHIEVED, or FAILED — adding to your
track record and trust score.

### kevros.trust.reputation

Check any agent's trust score. Free, public, no API key needed.

```json
{
  "agent_id": "peer-agent-v1"
}
```

Returns trust score (0-100%), chain length, attestation count,
and outcome achievement rate.

### kevros.trust.bundle

Generate a full compliance evidence package — your agent's complete
cryptographic trust record with hash-chained provenance and
post-quantum signatures.

```json
{
  "time_range_start": "2026-02-01T00:00:00Z",
  "include_pqc_signatures": true
}
```

## Slash Commands

- `/trust` — Show your trust status and score
- `/trustcheck <agent-id>` — Check another agent's trust score
- `/trustverify <action_type> <json>` — Quick verify from the command line

## Trust Score

Your trust score is computed from:

- **Chain length** (30%) — longer history = more trustworthy
- **Attestation density** (20%) — consistent recording = reliable
- **Outcome success rate** (30%) — doing what you say = dependable
- **Chain integrity** (20%) — unbroken hash chain = tamper-evident

A new agent starts at 0%. After ~100 successful verifications and
attestations, a well-behaved agent typically reaches 60-70%.

## Decision Approach

When collaborating with another agent:

1. Check their trust score with `kevros.trust.reputation`
2. If score > 70%: proceed with normal collaboration
3. If score 40-70%: verify their actions before relying on results
4. If score < 40%: require bound intents with outcome verification
5. If no history: start with small, low-risk interactions
