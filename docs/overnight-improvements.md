# Overnight Improvements — 2026-02-17

Branch: `moto/overnight-improvements`

## 1. Compaction Summary Instructions (`src/agents/compaction.ts`)

**Problem:** When sessions are compacted (context window overflow), the merge summary instructions were generic: *"Preserve decisions, TODOs, open questions, and any constraints."* This led to summaries that lost concrete details — file paths, error messages, specific tool outcomes, and user preferences were frequently dropped.

**Fix:** Expanded `MERGE_SUMMARIES_INSTRUCTIONS` to explicitly enumerate categories that must be preserved:
- Decisions and rationale
- TODOs and open tasks
- File paths, commands, and branches
- Errors and their resolution status
- User preferences and corrections
- Key tool interactions and outcomes

Also requests structured sections and concrete details over vague descriptions.

**Impact:** Every session compaction produces a higher-fidelity summary. This is especially important for long coding sessions where specific file paths and error context are critical for continuity.

**Tests:** All 10 existing compaction tests pass unchanged.

## 2. Smart Tool Result Truncation (`src/agents/pi-embedded-runner/tool-result-truncation.ts`)

**Problem:** When tool results exceed the context window budget, they're truncated by keeping only the beginning. But errors, stack traces, and result summaries typically appear at the *end* of tool output. A 400KB exec result with an error on the last line would lose the most important part.

**Fix:** Added a head+tail truncation strategy:
1. Detect if the tail (~2000 chars) contains error-like patterns (`error`, `exception`, `traceback`, `exit code`, etc.) or structural markers (JSON closing, summary lines)
2. If important tail detected: split budget 70% head / 30% tail with a middle omission marker
3. If no important tail: fall back to head-only truncation (existing behavior)

Both strategies cut at newline boundaries to avoid breaking mid-line.

**Impact:** Error messages and stack traces from tool calls (exec, read, etc.) are now preserved through truncation. The model can see both the beginning context and the actionable error at the end.

**Tests:** All 17 existing truncation tests pass. Added 2 new tests verifying head+tail and head-only behaviors (19 total).
