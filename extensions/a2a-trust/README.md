# Kevros A2A Trust — Decision Precision for OpenClaw Agents

Cryptographic trust verification for agent-to-agent communication. Not governance — decision precision. Identity emerges as a byproduct of trust history.

## What This Does

When your OpenClaw agent communicates with other agents or executes actions, this plugin adds a cryptographic trust layer:

- **Verify** — Check if an action is within bounds before execution (ALLOW / CLAMP / DENY)
- **Attest** — Record completed actions to build verifiable trust history
- **Bind** — Link planned intent to actual command, then verify outcome
- **Reputation** — Check any agent's trust score before collaborating

Every operation produces a cryptographic proof (HMAC release token, hash-chained provenance record). These proofs are independently verifiable — no trust-the-server required.

## Install

```bash
# From the OpenClaw root
cd packages/a2a-trust
npm install
```

Or add to your OpenClaw config:

```json
{
  "plugins": {
    "kevros-a2a-trust": {
      "agentId": "my-agent-v1"
    }
  }
}
```

## Configuration

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `agentId` | Yes | — | Your agent's unique identifier |
| `apiKey` | No | auto-signup | API key (`kvrs_...`). Omit for free tier (100 calls/month) |
| `gatewayUrl` | No | `https://governance.taskhawktech.com` | Trust gateway URL |
| `autoVerify` | No | `false` | Auto-verify outbound A2A messages |
| `autoAttest` | No | `false` | Auto-attest completed tool calls |
| `trustServerPort` | No | `18790` | Port for Agent Card discovery server |

## Quick Start

1. **Install the plugin** — no API key needed, auto-signup on first use
2. **Use `/trust`** to see your agent's trust status
3. **Use `/trustcheck <agent-id>`** to check another agent's trust score
4. **Enable `autoAttest: true`** to automatically build trust history from tool calls

## How It Works

```
Your Agent                         Trust Gateway
    |                                    |
    |-- verify(action) ----------------->|
    |<-- ALLOW + release_token ----------|  (cryptographic proof)
    |                                    |
    |-- [execute action] -->             |
    |                                    |
    |-- attest(result) ----------------->|
    |<-- hash_curr + epoch --------------|  (provenance chain grows)
    |                                    |
    |                                    |
Peer Agent                               |
    |-- reputation(your_id) ------------>|
    |<-- trust_score: 0.72 --------------|  (built from your history)
```

## Agent Card (A2A Discovery)

The plugin runs a background HTTP server that serves an [A2A Agent Card](https://google.github.io/A2A/) at `/.well-known/agent.json`. Other agents can discover your trust capabilities:

```bash
curl http://127.0.0.1:18790/.well-known/agent.json
```

## Gateway Methods (for Agent Tool Calls)

| Method | Description | Cost |
|--------|-------------|------|
| `kevros.trust.verify` | Verify action before execution | $0.01 |
| `kevros.trust.attest` | Record completed action | $0.02 |
| `kevros.trust.bind` | Bind intent to command | $0.02 |
| `kevros.trust.verify-outcome` | Verify outcome of bound intent | Free |
| `kevros.trust.bundle` | Full compliance evidence package | $0.25 |
| `kevros.trust.reputation` | Check any agent's trust score | Free |

## Pricing

| Tier | Monthly | Included Calls | Rate Limit |
|------|---------|----------------|------------|
| Free | $0 | 100 | 10/min |
| Scout | $29 | 5,000 | 600/min |
| Sentinel | $149 | 50,000 | 600/min |
| Sovereign | $499 | 500,000 | 600/min |

Upgrade: `https://governance.taskhawktech.com/stripe/checkout`

## Verification

Every response from the trust gateway is independently verifiable:

```bash
# Verify a release token (free, public, no API key)
curl -X POST https://governance.taskhawktech.com/governance/verify-token \
  -H "Content-Type: application/json" \
  -d '{"release_token": "...", "token_preimage": "KEVROSv1|ALLOW|42|..."}'

# Check an agent's trust score (free, public)
curl https://governance.taskhawktech.com/governance/reputation/my-agent-v1

# Verify a compliance bundle (free, public)
curl -X POST https://governance.taskhawktech.com/governance/verify-certificate \
  -H "Content-Type: application/json" \
  -d '{"bundle": {...}}'
```

## Security

- Raw action payloads are SHA-256 hashed before storage — your data is never stored
- Provenance chain is hash-linked (SHA-256) — tamper-evident
- Every 100 records: ML-DSA-87 (FIPS 204) post-quantum block signature
- Release tokens: HMAC-SHA256 with `KEVROSv1|{decision}|{epoch}|{hash_prev}|{record_hash}` preimage
- API keys: PBKDF2-SHA256 (100k iterations) — never stored in plaintext
- All keys encrypted at rest (Fernet AES-128-CBC + HMAC-SHA256)

## License

MIT
