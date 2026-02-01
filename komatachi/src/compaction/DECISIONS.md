# Compaction Module - Architectural Decisions

This document records what was preserved from the original OpenClaw compaction code, what was discarded, and why.

## Original Code Studied

- `/home/user/Komatachi/src/agents/compaction.ts` (345 lines)
- `/home/user/Komatachi/src/agents/pi-extensions/compaction-safeguard.ts` (321 lines)

Total: **666 lines** of core compaction logic

## Distilled Result

- `/home/user/Komatachi/komatachi/src/compaction/index.ts` (~275 lines of code, ~445 lines with documentation)

Reduction: **~59%** fewer lines of logic with equivalent essential functionality

---

## What Was Preserved

### 1. Token Estimation with Safety Margin

**Original**: 20% safety margin (`SAFETY_MARGIN = 1.2`) applied throughout

**Preserved**: Same 20% margin as `TOKEN_SAFETY_MARGIN`

**Why**: Token estimation is inherently imprecise. The original codebase learned this through production experience. Underestimating tokens leads to context overflow errors; the safety margin prevents this.

### 2. Tool Failure Extraction

**Original**: `collectToolFailures()` extracted tool failures from messages, truncated error text, formatted with exit codes

**Preserved**: `extractToolFailures()` with same logic

**Why**: Tool failures are essential context. When an agent retries after compaction, knowing what failed prevents repeating the same mistakes. This is user-facing functionality that was explicitly designed.

### 3. File Operations Tracking

**Original**: `computeFileLists()` and `formatFileOperations()` tracked read/modified files

**Preserved**: Same functions with same logic

**Why**: File operations provide essential context about what work was done. After compaction, the agent needs to know which files were touched to avoid re-reading or conflicting edits.

### 4. Oversized Input Detection

**Original**: `isOversizedForSummary()` checked if messages exceeded 50% of context

**Preserved**: `canCompact()` validates input size before attempting summarization

**Why**: Some inputs genuinely cannot be summarized. Detecting this upfront is better than failing mid-way through a complex multi-stage process.

### 5. Graceful Fallback Text

**Original**: `FALLBACK_SUMMARY` used when summarization fails

**Preserved**: Same concept with similar text

**Why**: When summarization fails, providing some context is better than nothing. The fallback tells the agent that history was truncated.

---

## What Was Discarded

### 1. Multi-Stage Chunking and Summarization

**Original**: `summarizeInStages()` split messages into parts, summarized each, then merged summaries with special merge instructions

**Discarded**: Single-pass summarization only

**Why**: This was over-engineered for the era of smaller context windows. Modern models (Claude 3+, GPT-4) have 128k+ context windows and can summarize ~100k tokens in a single call. The complexity of chunking, partial summarization, and merge logic is no longer justified.

**Impact**: If input is too large, we now throw `InputTooLargeError`. The caller must reduce input size. This is a layer boundary decision (see below).

### 2. Adaptive Chunk Ratios

**Original**: `computeAdaptiveChunkRatio()` dynamically adjusted chunk sizes based on average message size, with base ratio of 40% and minimum of 15%

**Discarded**: No adaptive ratios

**Why**: This complexity existed to work around context limits that are no longer as constraining. With large context windows and a clear "too large" error, adaptive sizing is unnecessary complexity.

### 3. History Pruning During Compaction

**Original**: `pruneHistoryForContextShare()` dropped oldest chunks to fit within history budget during compaction

**Discarded**: Compaction does not prune; it only summarizes

**Why**: **Layer boundary violation.** The summarizer's job is to summarize what it's given. Deciding what to include is the caller's responsibility. When the summarizer also prunes, it takes on two responsibilities that should be separate:
- Deciding what to keep (policy decision)
- Summarizing what's kept (implementation detail)

The caller has context about the session, user preferences, and system constraints that the summarizer shouldn't need to know.

### 4. Split Turn Handling

**Original**: Special handling for `isSplitTurn` with `turnPrefixMessages` and `TURN_PREFIX_INSTRUCTIONS`

**Discarded**: No split turn concept

**Why**: Split turns were an edge case where compaction happened mid-turn. Rather than handle this complexity in the summarizer, the better solution is to prevent mid-turn compaction at the session layer. This is another layer boundary issue - the summarizer shouldn't need to understand turn semantics.

### 5. Extension Hook Architecture

**Original**: Implemented as a Pi extension via `api.on("session_before_compact", ...)` with runtime registries (`getCompactionSafeguardRuntime`)

**Discarded**: Direct function call, no hooks

**Why**: Extension hooks add indirection and complexity. Komatachi uses static, predictable behavior for core functionality. Plugin systems are valuable when third parties need to extend behavior; for core compaction logic that will be maintained by the same team, they're unnecessary abstraction.

### 6. Dropped Message Summarization Chains

**Original**: When messages were pruned, they were summarized separately and the summary was passed as `previousSummary` to the main summarization, creating a chain

**Discarded**: No chained summarization

**Why**: This complexity existed to preserve maximum context when pruning. With pruning removed from the summarizer (layer boundary fix), this is no longer needed. If the caller wants to preserve context from excluded messages, they can call the summarizer separately.

### 7. WeakMap-Based Runtime Registries

**Original**: `getCompactionSafeguardRuntime()` used WeakMap for session-scoped state

**Discarded**: No hidden state; all state is passed explicitly

**Why**: Hidden state makes behavior hard to predict and test. Following the distillation principle of "Make State Explicit", all configuration is passed to `compact()` directly. No registries, no lookups, no hidden mutation.

---

## Key Design Decisions

### Decision 1: Fail on Oversized Input

**Choice**: Throw `InputTooLargeError` when input exceeds limits

**Alternatives Considered**:
- Silent truncation (original approach via pruning)
- Return partial summary with warning

**Rationale**: Following the distillation principle "Fail Clearly, Not Gracefully." Silent degradation masks problems. When input is too large, that's a bug in the caller's logic that should be fixed, not worked around. The error message tells the caller exactly what to do: reduce input size.

### Decision 2: Summarizer Does Not Chunk

**Choice**: Input chunking is the caller's responsibility

**Alternatives Considered**:
- Keep the chunking logic for backwards compatibility

**Rationale**: Following the distillation principle "Respect Layer Boundaries." A summarizer summarizes. It shouldn't need to know about model context limits, chunking strategies, or merge algorithms. Those concerns belong to the orchestration layer. This makes the summarizer simpler and more testable.

### Decision 3: Configuration Via Function Parameter

**Choice**: `summarize` function is passed to `compact()` rather than model/API key

**Alternatives Considered**:
- Pass model and API key directly, create summarizer internally
- Use dependency injection container

**Rationale**: Maximum flexibility with minimum coupling. The caller decides how to summarize (which model, what API, what parameters). The compaction module doesn't need to know about API clients, model registries, or authentication. This makes testing trivial - just pass a mock summarize function.

### Decision 4: Metadata as Structured Return Value

**Choice**: Return `CompactionMetadata` with typed tool failures and file lists

**Alternatives Considered**:
- Only append metadata to summary text (original approach)
- Separate metadata extraction from compaction

**Rationale**: Structured data is more useful than embedded text. Callers can:
- Log metadata separately
- Format it differently for different contexts
- Use it for analytics or debugging
- Skip metadata entirely if not needed

The metadata is also appended to the summary for backward compatibility.

---

## Testing Strategy

The distilled module needs fewer tests for equivalent confidence:

### Essential Tests (Priority 1)
1. Token estimation accuracy (within safety margin)
2. Tool failure extraction from various message formats
3. File operations computation (read vs modified)
4. `InputTooLargeError` thrown at correct thresholds
5. Successful summarization with metadata appended

### Edge Case Tests (Priority 2)
1. Empty message array
2. Messages with no tool failures
3. Messages with no file operations
4. Summarizer function throws error (fallback behavior)

### Not Needed (Previously Required)
- Chunking boundary tests
- Adaptive ratio calculation tests
- Multi-stage merge tests
- Split turn handling tests
- Pruning threshold tests
- Registry initialization tests

**Estimated tests**: ~15-20 vs original ~50+ (from scouting report estimate for compaction coverage)

---

## Migration Notes

When migrating from OpenClaw compaction to this module:

1. **Remove history pruning from compaction calls** - Prune before calling `compact()`
2. **Handle `InputTooLargeError`** - Reduce input size and retry, or use fallback
3. **Provide file operations explicitly** - Track `FileOperations` in session layer
4. **Create summarizer function** - Use `createSummarizer()` helper or provide custom

---

## Future Considerations

### What Might Need to Be Added

1. **Token counting integration** - If a more accurate token counter is available (e.g., tiktoken), allow injecting it
2. **Streaming summarization** - For very long summaries, streaming might improve UX
3. **Compression strategies** - Beyond summarization (e.g., removing tool call details while keeping results)

### What Should Not Be Added

1. **Automatic chunking** - Keep as caller responsibility
2. **Model-specific logic** - Keep model details in the summarizer function
3. **Extension hooks** - Keep behavior static and predictable
4. **Adaptive algorithms** - Prefer explicit configuration over magic
