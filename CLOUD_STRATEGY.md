# Cloud Strategy — Model Routing & Provider Tiers

This document defines how Brock's model stack is organized, when each tier is used, and how failover works. It lives in openclaw because **model provider configuration is a platform concern** — openclaw owns the provider definitions, API keys, failover chains, and runtime model selection.

What lobsterBucket governs: *usage policy* (e.g., "don't burn coding tokens on formatting", "prefer bulk tier during quiet hours"). What openclaw governs: *which providers exist, how to reach them, and what happens when one fails*.

---

## The Four Tiers

### Code Tier — z.ai GLM-5 (`zai/*`)

| Property | Value |
|----------|-------|
| Provider | z.ai (Zhipu AI) Coding Platform |
| Endpoint | `https://api.z.ai/api/coding/paas/v4` (overseas) |
|          | `https://open.bigmodel.cn/api/coding/paas/v4` (China) |
| Model ID | `glm-5` |
| Params | 744B total (MoE), 40B active |
| Cost | $1.00/$3.20 per 1M tokens (input/output) |
| Cached | $0.20 per 1M input (cache hit) |
| Context | 200K tokens |
| Max Output | 128K tokens |
| Reasoning | Yes (`thinking.type: "enabled"`) |
| Input | Text only (use GLM-4.6V for vision) |
| API compat | OpenAI-compatible |

**Use for:** High-stakes coding, long-context agent runs, PR reviews, complex refactoring, system design, multi-file edits. This is the primary model for any task where code quality is critical.

**Why GLM-5 for coding:** 77.8% on SWE-bench Verified (open-source SOTA), 56.2% on Terminal-Bench 2.0. The z.ai Coding Plan endpoint is specifically optimized for coding tasks. At $1.00/$3.20 per 1M tokens, it's ~5x cheaper than Claude Opus on input.

**GFW note:** z.ai endpoints are accessible from mainland China without tunneling.

---

### Bulk Tier — DeepSeek V3.2 (`deepseek/*`)

| Property | Value |
|----------|-------|
| Provider | DeepSeek |
| Endpoint | `https://api.deepseek.com/v1` |
| Model IDs | `deepseek-chat` (non-thinking), `deepseek-reasoner` (thinking) |
| Cost | $0.28/$0.42 per 1M tokens (cache miss input/output) |
| Cached | $0.028 per 1M input (cache hit — automatic, no config needed) |
| Context | 128K tokens |
| Max Output | 8K (chat), 64K (reasoner) |
| Reasoning | `deepseek-reasoner` only |
| Input | Text only |
| Rate limits | No explicit limits (dynamic throttling under load) |
| API compat | OpenAI-compatible |

**Use for:** Cheap bulk work, fast iterations, drafting, summarization, formatting, triage, daily briefings, job filtering. Anything where cost matters more than cutting-edge quality.

**Why DeepSeek:** At $0.28/$0.42 per 1M tokens it's absurdly cheap — 95% less than GPT-4o. Cache hits drop input to $0.028/1M, which means repeated-context workflows (like Brock's scheduled tasks with stable system prompts) cost almost nothing. The V3.2 unified model backs both `deepseek-chat` and `deepseek-reasoner`, so you get thinking mode at the same price.

**GFW note:** DeepSeek is a Chinese service, no tunnel needed from mainland.

---

### Reasoning Tier — Kimi K2 Thinking (`moonshot/*`)

| Property | Value |
|----------|-------|
| Provider | Moonshot AI |
| Endpoint | `https://api.moonshot.ai/v1` |
| Model IDs | `kimi-k2-thinking` (standard), `kimi-k2-thinking-turbo` (fast) |
| Params | 1T total (MoE), 32B active |
| Cost | $0.60/$2.50 per 1M tokens (standard) |
| Cached | $0.15 per 1M input (cache hit — automatic) |
| Turbo | $1.15/$8.00 per 1M tokens (up to 100 tok/s) |
| Context | 256K tokens |
| Reasoning | Yes (returns `reasoning_content` in response) |
| Input | Text only (K2.5 adds multimodal) |
| API compat | OpenAI-compatible and Anthropic-compatible |

**Use for:** Very long input analysis, long-horizon reasoning, big agentic workflows that run hundreds of steps. Research deep-dives, multi-document synthesis, competition-level problem solving.

**Why Kimi K2 Thinking:** Purpose-built as a thinking agent — end-to-end trained to interleave chain-of-thought reasoning with function calls. It can maintain stable tool-use across 200-300 sequential calls without drift. The 256K context window is the largest in this stack. At $0.60/$2.50 it slots between DeepSeek (bulk) and GLM-5 (code) on cost.

**Important:** When using thinking mode with tool calls, you must preserve `reasoning_content` in the message history. Stripping it causes 400 errors. openclaw handles this automatically.

**GFW note:** Moonshot is a Chinese service, no tunnel needed.

---

### Fallback Tier — OpenAI (`openai/*`)

| Property | Value |
|----------|-------|
| Provider | OpenAI |
| Endpoint | `https://api.openai.com/v1` |
| Models | gpt-4o (general), o3 (reasoning) |
| Cost | gpt-4o: $2.50/$10.00 per 1M; o3: $10.00/$40.00 per 1M |
| Context | 128K (gpt-4o), 200K (o3) |
| Reasoning | o3 only |
| Input | Text + Image |
| API compat | Native OpenAI |

**Use for:** Fallback when all three Chinese providers are down or rate-limited. Also the only provider in this stack with native vision support via API, so image-related tasks route here.

**Cost warning:** gpt-4o is 9x more expensive than DeepSeek on output. o3 is 95x more expensive than DeepSeek. These are fallback-only unless explicitly invoked.

**GFW note:** OpenAI requires a tunnel (Cloudflare Tunnel, Tailscale, WireGuard to HK/SG, or frp) from mainland China. Ensure your tunnel is stable before relying on this as a failover target.

---

### Optional: Local Ollama (`local/*`)

Not in the default tier hierarchy but useful if you have the hardware.

| Property | Value |
|----------|-------|
| Provider | Ollama (localhost) |
| Models | GLM-5 (quantized), GLM-4.7, DeepSeek-V3 (quantized), Kimi-K2 |
| Cost | $0 |
| Context | Model-dependent (typically 128K) |

**Hardware constraints:**

| Mac Mini RAM | Recommended Model | Notes |
|--------------|-------------------|-------|
| 16GB | qwen2.5:7b or glm-4.5-air | Light tasks only |
| 32GB | glm-4.7 (quantized) | Good for fast-tier work |
| 64GB+ | glm-5 (quantized) or kimi-k2 | Full local capability |

**Personality note:** Local models need more reinforcement than cloud APIs. If Brock drifts to generic assistant behavior on local, the fix is in SOUL.md — repeat key behavioral rules, add negative examples, use shorter imperative phrasing.

---

## Failover Chains

### Default chain (coding and general):

```
Primary:    zai/glm-5
    ↓ (if unavailable)
Fallback 1: moonshot/kimi-k2-thinking
    ↓ (if unavailable)
Fallback 2: deepseek/deepseek-chat
    ↓ (if unavailable)
Fallback 3: openai/gpt-4o
```

### Bulk/fast chain (cheap tasks):

```
Primary:    deepseek/deepseek-chat
    ↓ (if unavailable)
Fallback 1: moonshot/kimi-k2-thinking
    ↓ (if unavailable)
Fallback 2: openai/gpt-4o
```

### Reasoning chain (hard problems):

```
Primary:    moonshot/kimi-k2-thinking
    ↓ (if unavailable)
Fallback 1: zai/glm-5
    ↓ (if unavailable)
Fallback 2: openai/o3
```

### Image chain (vision tasks):

```
Primary:    openai/gpt-4o
    ↓ (if unavailable)
Fallback:   openai/o3
```

GLM-5, DeepSeek, and Kimi K2 are all text-only via API. Vision tasks must route to OpenAI (or optionally GLM-4.6V / Kimi K2.5 if added later).

Failover is automatic — openclaw's model selection layer handles it.

---

## Model Aliases

For convenience in configs and CLI:

| Alias | Resolves To | Notes |
|-------|-------------|-------|
| `glm5` | zai/glm-5 | Code tier primary |
| `ds` | deepseek/deepseek-chat | Bulk tier (non-thinking) |
| `dsr` | deepseek/deepseek-reasoner | Bulk tier (thinking) |
| `kimi` | moonshot/kimi-k2-thinking | Reasoning tier |
| `kimi-turbo` | moonshot/kimi-k2-thinking-turbo | Fast reasoning |
| `gpt` | openai/gpt-4o | Fallback (general) |
| `o3` | openai/o3 | Fallback (reasoning, expensive) |
| `local` | local/glm-5 | Whatever's running in Ollama |

Use aliases in agent configs and CLI commands: `openclaw agent --model glm5 --message "..."`.

---

## Command-to-Tier Routing (Discord)

When Brock receives commands via Discord (`!brock <command>` or `@Brock <command>`), the model tier selection determines cost and quality.

| Command | Model Tier | Routes To | Cooldown |
|---------|-----------|-----------|----------|
| `status` | bulk | `deepseek/deepseek-chat` | 30s |
| `brief` | bulk | `deepseek/deepseek-chat` | 300s |
| `research <topic>` | **reasoning** | `moonshot/kimi-k2-thinking` | 60s |
| `jobs` | bulk | `deepseek/deepseek-chat` | 300s |
| `task <desc>` | bulk | `deepseek/deepseek-chat` | 10s |
| `review <PR#>` | **code** | `zai/glm-5` | 60s |
| `help` | bulk | `deepseek/deepseek-chat` | 10s |

**How this works:**
- lobsterBucket's `PLAYBOOK.md` defines which commands exist and their tier assignments
- openclaw handles the actual model routing per tier
- If the selected tier is unavailable, the appropriate failover chain kicks in
- Cooldowns are enforced by lobsterBucket governance

**Cost impact:** Most commands use DeepSeek bulk tier (~$0.00 per command). `research` uses Kimi K2 Thinking (~$0.002 per command). `review` uses GLM-5 (~$0.005 per command). At typical usage (~10 commands/day), Discord commands cost under $1/mo total.

---

## Cost Estimation

Rough monthly costs for a typical personal assistant workload:

| Tier | Monthly Estimate | Notes |
|------|-----------------|-------|
| DeepSeek (bulk) | $0.50–3 | Handles majority of routine work |
| z.ai GLM-5 (code) | $5–20 | Varies with coding task volume |
| Kimi K2 (reasoning) | $2–10 | Deep research and long-horizon tasks |
| OpenAI gpt-4o (fallback) | $0–5 | Only during outages or vision tasks |
| **Total** | **$8–38/mo** | Heavily depends on usage patterns |

The key cost optimization: DeepSeek's cache hits at $0.028/1M make all of Brock's scheduled/repeated-context tasks nearly free. The expensive tiers (GLM-5, Kimi K2) only fire for coding and deep reasoning.

---

## Boundary: openclaw vs lobsterBucket

| Concern | Owned By | Examples |
|---------|----------|----------|
| Provider definitions | openclaw (`configs/model_config.json`, `openclaw.json`) | Base URLs, API keys, model specs, cost data |
| Failover chain | openclaw (`agents.defaults.model`) | Primary → fallback ordering |
| Model aliases | openclaw (`agents.defaults.models`) | Shorthand names |
| Runtime model selection | openclaw (`src/agents/model-selection.ts`) | Which provider handles a given request |
| **Usage policy** | **lobsterBucket** (`PLAYBOOK.md`, `GOVERNANCE.md`) | "Use bulk for routine tasks", "Reserve code tier for PRs" |
| **Cost governance** | **lobsterBucket** | Monthly budget caps, escalation rules |
| **Task-to-tier mapping** | **lobsterBucket** | Which categories of work get which tier |

If you find model routing logic creeping into lobsterBucket configs, or usage policy rules embedded in `openclaw.json` — that's your signal to refactor. Keep the boundary clean.

---

## Configuration Reference

The reference config lives at `configs/model_config.json`. To activate it, merge the relevant sections into your `~/.openclaw/openclaw.json`. See SETUP.md Step 8 for the walkthrough.

The config uses `"mode": "merge"` so your custom providers are added to (not replace) any implicit providers openclaw discovers (like Bedrock or GitHub Copilot).

---

_This document describes the model infrastructure. For Brock's personality and identity, see `docs/personality/brock/SOUL.md`. For operational rules and governance, see `~/lobsterBucket/PLAYBOOK.md`._
