# Cloud Strategy — Model Routing & Provider Tiers

This document defines how Brock's model stack is organized, when each tier is used, and how failover works. It lives in openclaw because **model provider configuration is a platform concern** — openclaw owns the provider definitions, API keys, failover chains, and runtime model selection.

What lobsterBucket governs: *usage policy* (e.g., "don't use o3 for trivial tasks", "prefer local during quiet hours"). What openclaw governs: *which providers exist, how to reach them, and what happens when one fails*.

---

## The Three Tiers

### Fast Tier — Local Ollama (`local/*`)

| Property | Value |
|----------|-------|
| Provider | Ollama (localhost) |
| Models | GLM-5 (quantized), GLM-4.7, or smaller depending on hardware |
| Cost | $0 |
| Latency | Low (on-device) |
| Context | 128K |
| Reasoning | Yes (GLM-5/4.7) |

**Use for:** Routine tasks — daily briefings, job filtering, message formatting, quick lookups, draft generation, triage. Anything where speed matters more than depth and the task doesn't require multimodal input.

**Hardware constraints:**

| Mac Mini RAM | Recommended Model | Notes |
|--------------|-------------------|-------|
| 16GB | qwen2.5:7b or glm-4.5-air | Fast tier only, lean on z.ai for heavy work |
| 32GB | glm-4.7 (quantized) | Good balance of capability and fit |
| 64GB+ | glm-5 (quantized) | Full local reasoning capability |

**Personality note:** Local models need more reinforcement than cloud APIs. If Brock drifts to generic assistant behavior on local, the fix is in SOUL.md — repeat key behavioral rules, add negative examples, use shorter imperative phrasing. This is a prompt engineering concern, not a model routing concern.

---

### Strong Tier — z.ai API (`zai/*`)

| Property | Value |
|----------|-------|
| Provider | z.ai Coding Platform |
| Endpoint | `https://api.z.ai/api/coding/paas/v4` |
| Models | GLM-5 (primary), GLM-4.7 (fallback) |
| Cost | ~$0.002/1K input, ~$0.006/1K output |
| Latency | Medium (API call) |
| Context | 128K |
| Reasoning | Yes |
| Input | Text + Image |

**Use for:** Code generation, deep research, complex analysis, agentic workflows, multi-step reasoning, anything where quality matters. This is the default primary for most agent tasks.

**Why z.ai over running GLM-5 locally:** The z.ai Coding Plan endpoint is optimized for coding tasks and cheaper than the general API. Unless your Mac Mini has 64GB+ RAM, running GLM-5 locally at full precision isn't practical — z.ai gives you the full model without hardware constraints.

**GFW note:** If operating from behind the Great Firewall, z.ai endpoints are generally accessible from mainland China (it's a Chinese service). This is an advantage over OpenAI/Anthropic which require tunneling.

---

### Backup Tier — OpenAI (`openai/*`)

| Property | Value |
|----------|-------|
| Provider | OpenAI |
| Endpoint | `https://api.openai.com/v1` |
| Models | gpt-4o (general), o3 (reasoning) |
| Cost | gpt-4o: ~$0.0025/$0.01 per 1K; o3: ~$0.01/$0.04 per 1K |
| Latency | Medium-High |
| Context | 128K (gpt-4o), 200K (o3) |
| Reasoning | o3 only |
| Input | Text + Image |

**Use for:** Fallback when z.ai is down or rate-limited. Also useful when you want a different reasoning style — o3's chain-of-thought approach sometimes catches things GLM-5 misses on hard problems.

**Cost warning:** o3 is 5-7x more expensive than z.ai GLM-5. Use it deliberately, not as a default. gpt-4o is reasonable as a general fallback.

**GFW note:** OpenAI requires a tunnel (Cloudflare Tunnel, Tailscale, WireGuard to HK/SG, or frp) from mainland China. Ensure your tunnel is stable before relying on this as a failover target.

---

### Optional: Anthropic (`anthropic/*`)

Not in the default config but supported and recommended for users who have a subscription.

| Property | Value |
|----------|-------|
| Provider | Anthropic |
| Models | claude-opus-4-6, claude-sonnet-4-6 |
| Cost | Varies by plan (Pro/Max subscription recommended) |
| Context | 200K |
| Reasoning | Yes |
| Input | Text + Image |

**Why consider it:** Opus 4.6 has strong long-context performance and better prompt-injection resistance than most alternatives. If you have Anthropic Pro/Max, adding it as a fallback (or even primary for certain tasks) is worthwhile.

To add: uncomment the Anthropic section in `.env`, add the provider block to `openclaw.json`, and insert into the fallback chain.

---

## Failover Chain

The default failover chain for Brock's agent:

```
Primary:   zai/glm-5
    ↓ (if unavailable)
Fallback 1: zai/glm-4.7
    ↓ (if unavailable)
Fallback 2: openai/gpt-4o
    ↓ (if unavailable)
Fallback 3: local/glm-5 (or whatever's pulled in Ollama)
```

Failover is automatic — openclaw's model selection layer handles it. The agent doesn't need to know which provider is serving; it just sends the request and gets a response.

**Image model chain** (for tasks requiring vision):

```
Primary:   zai/glm-5
    ↓
Fallback:  openai/gpt-4o
```

Local Ollama models typically don't support image input, so they're excluded from the image fallback chain.

---

## Model Aliases

For convenience in configs and CLI:

| Alias | Resolves To | Notes |
|-------|-------------|-------|
| `glm5` | zai/glm-5 | Default strong model |
| `local` | local/glm-5 | Whatever's running in Ollama |
| `gpt` | openai/gpt-4o | General backup |
| `o3` | openai/o3 | Reasoning backup (expensive) |

Use aliases in agent configs and CLI commands: `openclaw agent --model glm5 --message "..."`.

---

## Cost Estimation

Rough monthly costs for a typical personal assistant workload (assuming moderate daily use):

| Tier | Monthly Estimate | Notes |
|------|-----------------|-------|
| Local | $0 | Electricity only |
| z.ai GLM-5 | $5–20 | Varies with coding task volume |
| OpenAI gpt-4o (fallback) | $1–5 | Only used during z.ai outages |
| OpenAI o3 | $0–10 | Only if explicitly invoked for hard problems |
| **Total** | **$6–35/mo** | Heavily depends on usage patterns |

If you add Anthropic Pro ($20/mo) or Max ($100/mo), that's a flat subscription cost on top — but it gives you high-quality fallback without per-token worry.

---

## Boundary: openclaw vs lobsterBucket

| Concern | Owned By | Examples |
|---------|----------|----------|
| Provider definitions | openclaw (`configs/model_config.json`, `openclaw.json`) | Base URLs, API keys, model specs, cost data |
| Failover chain | openclaw (`agents.defaults.model`) | Primary → fallback ordering |
| Model aliases | openclaw (`agents.defaults.models`) | Shorthand names |
| Runtime model selection | openclaw (`src/agents/model-selection.ts`) | Which provider handles a given request |
| **Usage policy** | **lobsterBucket** (`PLAYBOOK.md`, `GOVERNANCE.md`) | "Use local for routine tasks", "Don't burn o3 tokens on formatting" |
| **Cost governance** | **lobsterBucket** | Monthly budget caps, escalation rules |
| **Task-to-tier mapping** | **lobsterBucket** | Which categories of work get which tier |

If you find model routing logic creeping into lobsterBucket configs, or usage policy rules embedded in `openclaw.json` — that's your signal to refactor. Keep the boundary clean.

---

## Configuration Reference

The reference config lives at `configs/model_config.json`. To activate it, merge the relevant sections into your `~/.openclaw/openclaw.json`. See SETUP.md Step 8 for the walkthrough.

The config uses `"mode": "merge"` so your custom providers are added to (not replace) any implicit providers openclaw discovers (like Bedrock or GitHub Copilot).

---

_This document describes the model infrastructure. For Brock's personality and identity, see `docs/personality/brock/SOUL.md`. For operational rules and governance, see `~/lobsterBucket/PLAYBOOK.md`._
