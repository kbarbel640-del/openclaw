# SOPHIE — Architecture Comparison

## Before & After OpenClaw Integration

### STATUS: COMPLETE / 2026-02-18

---

## CODEBASE METRICS

| Metric                                    | Value                             |
| ----------------------------------------- | --------------------------------- |
| Sophie domain code (src/thelab/)          | 8,230 lines across 28 files       |
| Sophie plugin bridge (extensions/sophie/) | 782 lines across 5 files          |
| OpenClaw infrastructure used              | ~213,000 lines across 1,189 files |
| Vision sidecar (Python)                   | 304 lines                         |
| Integration tests                         | 138 passing                       |
| Total custom code                         | ~9,300 lines                      |

Sophie writes 9,300 lines. Gets 213,000 lines of battle-tested infrastructure for free.

---

## WHAT'S OURS vs WHAT'S OPENCLAW

### Sophie's Domain Code (Custom — Our Moat)

| Module                         | Lines  | What It Does                                                 | Replaceable?                    |
| ------------------------------ | ------ | ------------------------------------------------------------ | ------------------------------- |
| `learning/style-db.ts`         | 636    | Statistical style profiles per scenario                      | No — domain-specific            |
| `sophie/sophie-brain.ts`       | 534    | Conversation engine, intent routing                          | Partially — LLM now handles NLU |
| `run.ts`                       | 471    | CLI entry point (learn, edit, profile, validate)             | No — our workflows              |
| `learning/catalog-ingester.ts` | 461    | Read .lrcat SQLite, extract develop settings                 | No — domain-specific            |
| `loop/editing-loop.ts`         | 451    | 8-step editing cycle                                         | No — core product               |
| `learning/live-observer.ts`    | 348    | Watch photographer edit in real-time                         | No — domain-specific            |
| `learning/scene-classifier.ts` | 300    | EXIF-based scene classification                              | No — domain-specific            |
| `session/session-store.ts`     | 290    | JSONL session persistence                                    | Bridged with OpenClaw           |
| `culling/culler.ts`            | 285    | 3-pass culling pipeline                                      | No — domain-specific            |
| `sophie/intent-parser.ts`      | 262    | Rule-based NL command parsing                                | Supplemented by LLM             |
| `learning/style-report.ts`     | 261    | Editing DNA markdown reports                                 | No — domain-specific            |
| `lightroom/controller.ts`      | 192    | Lightroom UI automation                                      | No — domain-specific            |
| `vision/analyze.py`            | 304    | MLX vision model for screenshot analysis                     | No — domain-specific            |
| `lightroom/shortcuts.ts`       | 132    | Keyboard shortcut mappings                                   | No — domain-specific            |
| Others                         | ~1,100 | Config, schemas, queue, gate, window, sliders, notifications | Mixed                           |

### OpenClaw Infrastructure (Free — We Inherit)

| Capability               | What We Get                                                                                      | Lines We Didn't Write |
| ------------------------ | ------------------------------------------------------------------------------------------------ | --------------------- |
| **Agent Loop**           | Queue-based serialization, timeouts, event streaming, abort handling                             | ~5,000                |
| **LLM Integration**      | Multi-provider (Claude, GPT, Gemini, Ollama), key rotation, fallback chains, rate limit handling | ~8,000                |
| **Tool System**          | Plugin registration, schema validation, loop detection, result sanitization                      | ~4,000                |
| **Session Management**   | JSONL transcripts, tree structure, compaction, context window management, crash recovery         | ~6,000                |
| **Memory System**        | Vector + FTS hybrid search, auto-sync, embedding providers                                       | ~10,000               |
| **Skills System**        | Multi-source loading, hot-reload, eligibility filtering                                          | ~3,000                |
| **Config System**        | JSON5 with validation, includes, env substitution, schema enforcement                            | ~4,000                |
| **Error Handling**       | Exponential backoff, jitter, model fallback, transient retry, error classification               | ~3,000                |
| **CLI Framework**        | Modular commands, plugin commands, help generation                                               | ~5,000                |
| **Gateway/API**          | RPC server, REST endpoints, webhook handlers                                                     | ~15,000               |
| **Channel Integrations** | iMessage, Telegram, Discord, WhatsApp, Signal, Slack, and 20+ more                               | ~100,000+             |
| **Security**             | Sandbox mode, tool policies, auth profiles                                                       | ~5,000                |

---

## BEFORE vs AFTER

### Conversation Intelligence

| Capability                                                | Before (Custom)                             | After (OpenClaw)                                         |
| --------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------- |
| Understanding user commands                               | Regex patterns (262 lines)                  | Claude/GPT with full NLU + regex fallback                |
| "Make the reception shots warmer but keep the skin tones" | Partial — extracts "warmer" + "temperature" | Full — LLM understands nuance and context                |
| "Why did you flag that ceremony shot?"                    | Canned response                             | LLM explains by calling sophie_get_profile and reasoning |
| Memory of past conversations                              | None — stateless per session                | Full JSONL transcript with compaction                    |
| Context window management                                 | None                                        | Auto-compaction, pruning, context limits                 |
| Asking clarifying questions                               | Never                                       | LLM decides when to ask vs decide                        |

### Model Flexibility

| Capability         | Before                       | After                                         |
| ------------------ | ---------------------------- | --------------------------------------------- |
| Vision analysis    | Local MLX only (Qwen2-VL-7B) | Local MLX + can fall back to cloud vision     |
| Conversation model | None (hardcoded responses)   | Claude Sonnet/Opus with fallback chain        |
| Model switching    | Manual code change           | Config change in openclaw.json                |
| API key management | N/A                          | Multi-key rotation with rate limit handling   |
| Provider diversity | Single (MLX)                 | OpenAI, Anthropic, Google, Ollama, vLLM, etc. |

### Error Handling

| Capability        | Before              | After                                     |
| ----------------- | ------------------- | ----------------------------------------- |
| LLM call fails    | Crash               | Retry with backoff, try fallback model    |
| Rate limited      | Crash               | Wait with jitter, rotate API key, retry   |
| Context too long  | Crash               | Auto-compact, prune old tool results      |
| Session corrupted | Manual JSONL repair | Tree-structured transcripts with recovery |

### Integration Surface

| Capability                  | Before                             | After                                            |
| --------------------------- | ---------------------------------- | ------------------------------------------------ |
| Talk to Sophie via CLI      | `npx tsx src/thelab/run.ts edit`   | `openclaw agent --agent sophie -m "go edit"`     |
| Talk to Sophie via iMessage | Custom osascript notification only | Full bidirectional via OpenClaw iMessage channel |
| Talk to Sophie via Telegram | Not possible                       | OpenClaw telegram extension                      |
| Talk to Sophie via Discord  | Not possible                       | OpenClaw discord extension                       |
| Talk to Sophie via WhatsApp | Not possible                       | OpenClaw whatsapp extension                      |
| Talk to Sophie via web API  | Not possible                       | OpenClaw gateway RPC                             |

### What Stayed the Same

| Capability                            | Status                                    |
| ------------------------------------- | ----------------------------------------- |
| Editing loop (8-step cycle)           | Unchanged — our code                      |
| Lightroom UI automation (Peekaboo)    | Unchanged — our code                      |
| Catalog ingestion (.lrcat reading)    | Unchanged — our code                      |
| Scene classification (EXIF-based)     | Unchanged — our code                      |
| Style database (statistical profiles) | Unchanged — our code, bridged to OpenClaw |
| Live editing observation              | Unchanged — our code                      |
| Culling pipeline                      | Unchanged — our code                      |
| Vision model (MLX sidecar)            | Unchanged — our code                      |
| Identity Lock                         | Unchanged — non-negotiable                |

---

## TOOL REGISTRY

Sophie registers 10 tools with OpenClaw, making her domain capabilities accessible to any LLM:

| Tool                       | Purpose                                            |
| -------------------------- | -------------------------------------------------- |
| `sophie_get_profile`       | Look up editing profile for a specific scenario    |
| `sophie_list_scenarios`    | List all learned scenarios with confidence         |
| `sophie_ingest_catalog`    | Read Lightroom catalog, learn photographer's style |
| `sophie_discover_catalogs` | Auto-discover .lrcat files on this Mac             |
| `sophie_classify_scene`    | Classify a photo by EXIF data                      |
| `sophie_generate_report`   | Generate "Editing DNA" markdown report             |
| `sophie_get_stats`         | Summary statistics on training data                |
| `sophie_cull`              | Analyze images for culling                         |
| `sophie_get_correlations`  | Get slider correlation patterns                    |
| `sophie_find_profile`      | Find best matching profile for a photo             |

---

## WHAT THIS MEANS

**Before integration:** Sophie was a smart but mute worker. She could edit photos, learn styles, and process catalogs — but she talked like a script. Fixed responses. No memory. No nuance. No way to reach her except the CLI.

**After integration:** Sophie is a conversational colleague backed by Claude. She calls her own domain tools to answer questions, explain decisions, and take instructions. She remembers past conversations. She can be reached through iMessage, Telegram, Discord, WhatsApp, or any of OpenClaw's 20+ channels. When Claude is down, she falls back to GPT. When the context gets too long, she auto-compacts.

**The deal:**

- We wrote 9,300 lines of domain-specific photo editing intelligence
- We get 213,000 lines of production-grade agent infrastructure
- Our moat (editing loop, style learning, Lightroom control) stays 100% custom
- The commodity parts (LLM calls, session management, error handling, multi-channel) come from OpenClaw

That's the right trade.

---

_SOPHIE ® / THE LAB / DEPARTMENT OF VIBE_
_ARCHITECTURE COMPARISON v1.0_
_STATUS: INTEGRATED_
