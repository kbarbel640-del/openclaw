---
name: Kai Model Selection Draft
overview: Research findings on Kai's model selection after discovering Mistral Large 3 is cloud-only. Evaluating whether same-model supervisor with different personality provides value, or if we need a genuinely superior local model.
todos: []
isProject: false
---

# Kai Supervisor Model Selection - Research Draft

## Critical Discovery: Mistral Large 3 Not Available Locally

**Problem:** The original plan specified Mistral Large 3, but research shows it's **CLOUD ONLY** on Ollama:

- Tag: `mistral-large-3:675b-cloud`
- Size: `-` (no download available)
- Must run via Ollama's cloud API, not local inference

This invalidates the core premise of the deployment plan.

## The Core Question

**Would a supervisor architecture provide value even if Kai uses the same model as Liam (GLM 4.7), just with a different personality and fresh context?**

### Arguments FOR Same-Model Supervisor

1. **Fresh Context = Fresh Perspective**

   - Kai reviews with no conversation history
   - No anchoring bias from the original task
   - Clean slate reduces "continuation blindness"

2. **Role Clarity Through Prompting**

   - Kai's identity files define him as a reviewer, not a doer
   - Review-specific prompts (APEX checklist, security focus)
   - Different temperature/sampling parameters possible

3. **Structured Review Protocol**

   - REVIEW-PROTOCOL.md enforces systematic checks
   - Forces explicit criteria (security, APEX, logic)
   - Documented review history for learning

4. **Psychological Benefits**

   - Simon gets "second opinion" confidence
   - Liam has accountability/quality incentive
   - Reduces "did I miss something?" anxiety

5. **Research Evidence**

   - Multi-agent self-consistency improves accuracy
   - Same model, different sampling = diversity
   - Human code review works this way (same skill level peers)

### Arguments AGAINST Same-Model Supervisor

1. **Same Blind Spots**

   - If Liam misses a bug type, Kai likely will too
   - Model's training data weaknesses affect both
   - No capability delta = no net quality gain

2. **Token Cost Without Benefit**

   - 2x inference cost for same output
   - Review latency (20-30s) with no capability improvement
   - Opportunity cost: could use those tokens for iteration

3. **False Confidence**

   - Simon thinks he has "two brains" but it's one
   - Approval from Kai doesn't mean much if Kai = Liam
   - Security theater vs actual security

4. **Better Alternatives Exist**

   - Use GLM 4.7 cloud for BOTH agents (more reliable)
   - Invest review time in better testing/linting
   - Simon reviews critical work himself

## Model Options for Local Kai

Based on latest documentation and research (January 2026):

### Option A: GLM 4.7 Flash (Local) - Same as Liam's Fallback

- **Size:** ~20GB
- **Capability:** Lightweight MoE (30B-A3B)
- **Pros:** Already proven stable, zero new dependencies
- **Cons:** Weaker than cloud GLM 4.7, same blind spots as Liam
- **Verdict:** Would make Kai a rubber stamp reviewer

### Option B: DeepSeek R1 70B (Local)

- **Size:** 43GB (Q4 quantization)
- **Context:** 128K tokens
- **HumanEval:** ~85% (vs GLM 4.7 cloud at ~88%)
- **SWE-bench Verified:** Lower than GLM 4.7 (73.8%)
- **Reasoning:** Strong (thinking mode)
- **Pros:** MIT license, reasoning mode useful for reviews
- **Cons:** WEAKER than GLM 4.7 cloud on coding benchmarks
- **Verdict:** Step DOWN in capability, not up

### Option C: Qwen 3 235B (Local) - **NOT PRACTICAL**

- **Size:** 142GB download
- **Memory:** Needs 160GB+ RAM or high-end GPU
- **Active params:** 22B (MoE sparse)
- **Pros:** Strongest reasoning/coding in Qwen family
- **Cons:** **Won't fit in 96GB WSL allocation**
- **Verdict:** Hardware insufficient

### Option D: Keep GLM 4.7 Cloud for Both Agents

- **Liam:** GLM 4.7 cloud (primary)
- **Kai:** GLM 4.7 cloud (supervisor with different identity)
- **Pros:** 
  - No local model reliability issues
  - Highest quality available
  - Fresh context still provides review value
  - Zero thermal/memory concerns
- **Cons:**
  - Uses cloud for both (privacy/cost)
  - No local compute utilization
  - Dependent on ZAI API uptime

## Latest Benchmark Comparison

| Model | HumanEval | SWE-bench Verified | Context | Availability | vs GLM 4.7 Cloud |

|-------|-----------|-------------------|---------|--------------|------------------|

| **GLM 4.7 (Cloud)** | ~88% | 73.8% | 200K | Cloud only | Baseline |

| GLM 4.7 Flash (Local) | ~75% | 59.2% | 128K | ✅ Ollama | ⬇️ WEAKER |

| DeepSeek R1 70B | ~85% | ~65% | 128K | ✅ Ollama | ⬇️ WEAKER |

| Qwen 3 235B | ~90% | N/A | 256K | ⚠️ Too large | ⬆️ STRONGER (can't run) |

| Mistral Large 3 | 90.24% | N/A | 256K | ❌ Cloud only | ⬆️ STRONGER (can't run) |

## The Research Truth

**There is NO locally-runnable model in January 2026 that surpasses GLM 4.7 cloud within 96GB memory constraints.**

The strongest local options (DeepSeek R1 70B, GLM 4.7 Flash) are both **weaker** than what Liam already uses.

## Open Question from User

**"Would it be useful at all? Just the fact that we have a second pair of eyes looking over Liam (even if it's the same models)?"**

### Expert Answer: **YES, but with caveats**

#### When Same-Model Review Adds Value

1. **For systematic errors** - Fresh context catches consistency issues
2. **For APEX protocol enforcement** - Dedicated reviewer role = better adherence
3. **For security checklist** - Explicit review protocol > hoping Liam remembers
4. **For user confidence** - Psychological benefit is real
5. **For learning** - Review history helps both agents improve

#### When Same-Model Review Adds LITTLE Value

1. **For novel bugs** - Same training = same blind spots
2. **For deep expertise gaps** - Neither knows advanced security patterns
3. **For complex reasoning** - Both hit same capability ceiling
4. **For high-stakes decisions** - False confidence is dangerous

### The Honest Recommendation

**Option D (Cloud for Both) + Lightweight Protocol** is the pragmatic choice:

```
Liam: GLM 4.7 Cloud (primary, fast responses)
Kai:  GLM 4.7 Cloud (reviews only, fresh context, structured protocol)
```

**Why this works:**

- Fresh context DOES help catch errors (research-proven)
- Review protocol enforces systematic checks
- No local model stability issues
- Highest quality model available
- User gets confidence boost
- Can always add local model later if hardware improves

**Cost trade-off:**

- Adds ~20% token usage (5% of requests reviewed)
- Reduces bug escape rate (value > cost)
- Provides psychological benefit to Simon

## Alternative: Lean Supervisor Without Full Agent

Instead of deploying Kai as a full agent, consider:

1. **Liam self-reviews** critical work using structured prompts
2. **Same session, different prompt**: "Review the above code for [APEX/security/logic]"
3. **Lower overhead**: No agent switching, no separate config
4. **Same benefit**: Fresh evaluation, systematic checklist

## Next Steps

**User is leaning toward Option C or D.**

Before finalizing:

1. Confirm whether user wants local compute utilized at all
2. Clarify if privacy (local) > capability (cloud)
3. Decide if "second pair of eyes" value justifies 2x inference cost
4. Consider lightweight self-review alternative

## Files Modified Since Original Plan

None yet - this is a draft pending model selection decision.

## References

- [Ollama Mistral Large 3 docs](https://ollama.com/library/mistral-large-3) - Cloud only
- [GLM 4.7 vs DeepSeek benchmarks](https://macaron.im/blog/glm-4-7-vs-deepseek-code)
- [Qwen 3 235B memory requirements](https://theepic.dev/kb/ollama-qwen3-faq)
- [Code review LLM research 2026](https://arxiv.org/abs/2509.01494)