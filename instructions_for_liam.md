# Instructions for Liam: Deep System Analysis & Research

This document provides a repeatable process for Liam to perform comprehensive system audits and research tasks, ensuring APEX 6.2 compliance and thorough investigation.

---

## Purpose

When asked to analyze "Is X ready?" or "Should we use Y?" or "How does Z work?", follow this protocol for deep, gap-free analysis.

---

## Protocol: 4-Phase Deep Dive

### Phase 1: Parallel Exploration (Architecture-First)

**Launch 4 concurrent explore subagents** to investigate different dimensions:

1. **Tool & Configuration Analysis**
   - Target: `~/.clawdbot/moltbot.json`, `clawdbot/skills/*/SKILL.md`
   - Goal: What capabilities exist? What tools are available?
   - Output: Tool matrix + capability inventory

2. **Execution History Analysis**
   - Target: `~/.clawdbot/agents/*/sessions/*.jsonl`, `EVOLUTION-QUEUE.md` (resolved entries)
   - Goal: What has been done successfully? Where are the failures?
   - Output: Success/failure pattern analysis

3. **Architecture Deep Dive**
   - Target: `src/commands/`, `src/gateway/`, `src/auto-reply/`, `src/cli/`
   - Goal: How does the system work? What's the execution model?
   - Output: Execution flow diagrams + component mapping

4. **Coordination Protocol Analysis**
   - Target: `AGENTS.md`, `.agent/workflows/`, coordination logs
   - Goal: How do agents work together? What fails when coordination breaks?
   - Output: Handoff protocol + failure modes

**Why 4 agents?** Parallelization prevents gaps. Each agent investigates a different dimension without cross-contamination.

---

### Phase 2: Synthesis (Comorbidity Analysis)

**After all 4 agents report back:**

1. **Identify Patterns**
   - Cluster related successes/failures
   - Find root causes spanning multiple areas
   - Map dependencies between components

2. **Build Evidence Matrix**
   - For each finding: cite specific files + line numbers
   - Include command outputs (don't assume)
   - Link related issues (comorbidity)

3. **Create Visual Maps**
   - Use Mermaid diagrams for flows
   - Use tables for capability matrices
   - Use timelines for historical analysis

**Critical:** Never cite stale data. If a subagent found something, verify it's still true.

---

### Phase 3: Verification (Read-First + Regression Guard)

**Before finalizing any conclusion:**

1. **Live Verification**
   - Run actual commands to verify claims
   - Check file modification times
   - Verify service status with `systemctl` or `launchctl`

2. **Archive Check**
   - Search `EVOLUTION-QUEUE-ARCHIVE.md` for related issues
   - Verify current queue entries are still pending
   - Check `CURSOR-RESOLUTIONS.md` for recent fixes

3. **Cross-Reference**
   - Compare findings across all 4 subagent reports
   - Resolve contradictions with live checks
   - Document any gaps explicitly

**APEX Rule:** Never assume. Always verify.

---

### Phase 4: Reporting (Response Economy + BLUF)

**Structure the final report:**

1. **Executive Summary (BLUF)**
   - Answer the question directly (YES/NO/PARTIAL)
   - Key findings in 3-5 bullet points
   - Critical limitations upfront

2. **Evidence Sections**
   - Tool capabilities (with matrix)
   - Work history (successes + failures)
   - Architecture (with diagrams)
   - Coordination patterns

3. **Comorbidity Analysis**
   - Related issues clustered
   - Root causes identified
   - Systemic fixes proposed

4. **Actionable Recommendations**
   - For Liam: What should he do differently?
   - For Cursor: What should it handle?
   - For Simon: How should he delegate?

5. **Conclusion**
   - Restate answer with confidence level
   - List dependencies for success
   - Note any remaining gaps (if any)

**Response Mode:**
- Use **NARRATIVE** for complex architectural analysis
- Include Mermaid diagrams for flows
- Use tables for matrices
- No emojis unless user requests

---

## Example Application: "Is Liam Ready for Coding Tasks?"

**Phase 1: Launch 4 Subagents**
1. Analyze tool access (moltbot.json + skills)
2. Examine execution history (sessions + resolved queue entries)
3. Map agent runtime architecture (src/commands/agent, src/gateway)
4. Investigate coordination (AGENTS.md + workflows)

**Phase 2: Synthesize**
- Build capability matrix (tool access vs basic agents)
- Identify success patterns (diagnostics, skills, automation)
- Identify failure patterns (stale data, verification gaps)
- Map coordination workflow (EVOLUTION-QUEUE → Cursor → CURSOR-RESOLUTIONS)

**Phase 3: Verify**
- Check actual config files (don't assume)
- Verify queue entry statuses
- Confirm architectural claims with code references

**Phase 4: Report**
- Executive summary: "YES, with boundaries"
- Task delegation matrix (Liam vs Cursor)
- Comorbidity: Verification failures cluster
- Recommendations: Specific actions for each agent

---

## Tools for Each Phase

| Phase | Primary Tools | Purpose |
|-------|--------------|---------|
| **Exploration** | `Task` (explore subagent), `Glob`, `Read` | Parallel investigation |
| **Synthesis** | `Read`, `Grep`, analysis | Pattern identification |
| **Verification** | `Shell` (exec), `Read`, `Grep` | Live checks |
| **Reporting** | `Write`, Mermaid diagrams | Document creation |

---

## Verification Checklist

Before finalizing ANY analysis:

- [ ] All claims backed by file references (path + line numbers)
- [ ] No citations of stale data (verify >6hr old entries)
- [ ] Architecture claims traced to actual code
- [ ] Success/failure patterns backed by session logs
- [ ] Comorbidity analysis identifies root causes
- [ ] Recommendations are specific and actionable
- [ ] Executive summary answers the question directly
- [ ] No gaps acknowledged in conclusion

---

## Anti-Patterns to Avoid

❌ **Single-threaded exploration:** Too slow, misses dimensions  
✅ **Parallel subagents:** Fast, comprehensive

❌ **Assume from memory:** Violates Read-First  
✅ **Verify everything:** Run live checks

❌ **Cite queue without checking:** Stale data error  
✅ **Check archive first:** Verify status

❌ **Surface-level tables:** Not useful  
✅ **Evidence-based matrices:** Actionable

❌ **Vague recommendations:** "Improve X"  
✅ **Specific actions:** "Run Y before Z"

---

## Success Criteria

A complete analysis includes:
1. ✅ Direct answer to the question (BLUF)
2. ✅ Evidence from 4+ dimensions
3. ✅ Live verification of all claims
4. ✅ Comorbidity analysis (root causes)
5. ✅ Actionable recommendations
6. ✅ Visual diagrams (architecture flows)
7. ✅ Delegation boundaries (if applicable)
8. ✅ No gaps acknowledged

---

**Template Location:** `/home/liam/.cursor/plans/liam_readiness_analysis.md` (reference example)

*Generated: 2026-01-29 | APEX 6.2 Compliant*
