# Distillation Roadmap

This document is a contract between the human and Claude for autonomous execution of the Komatachi distillation. It defines what will be built, in what order, and how decisions are made.

---

## Why Autonomous Execution

The distillation process follows a repeatable cycle: Study the scouting report, design the interface, build the implementation, validate with tests, document decisions. Each cycle produces a self-contained module with clear inputs, outputs, and acceptance criteria.

This repeatability means Claude can execute the cycle independently for each module, provided two conditions are met:

1. **Agreement on what to build** -- A sequenced roadmap with scope boundaries, so Claude works on the right thing in the right order.
2. **Agreement on how to decide** -- Pre-resolved decision points and clear authority boundaries, so Claude doesn't drift on ambiguous calls.

The roadmap below satisfies condition 1. The Decision Authority section satisfies condition 2.

### How We Ensured Effectiveness

The roadmap was developed collaboratively in a single session. The process:

1. **Surveyed remaining work** -- Enumerated all un-distilled modules from the four scouting reports (~20k LOC across context management, memory/search, agent alignment, session management).
2. **Identified dependencies** -- Mapped which modules depend on which, producing a partial order.
3. **Applied scope reduction** -- Deferred everything not needed for a minimal viable single-agent, single-session system. This eliminated vector search, file sync, memory orchestration, cross-agent access, and multi-agent routing.
4. **Pre-resolved decision points** -- Walked through each phase and made architectural calls upfront rather than leaving them for Claude to encounter mid-implementation.
5. **Documented reasoning** -- Every deferral and decision includes its rationale, so future sessions can understand *why* without re-deriving it.

The safety net: each completed module is committed and available for human review before dependent modules are built. If drift occurs, it surfaces at module boundaries -- not after the entire system is built.

---

## Session Protocol

Each autonomous session follows this protocol:

1. **Read PROGRESS.md** -- Orient to current state.
2. **Identify the next roadmap item** -- Pick the next incomplete phase/module.
3. **Execute the distillation cycle**:
   - Study the scouting report for relevant sections
   - Design the interface (types, function signatures, error cases)
   - Build the implementation
   - Write tests (following `docs/testing-strategy.md`)
   - Write DECISIONS.md for the module
4. **Update PROGRESS.md** -- Record what was completed, any insights discovered, any new open questions.
5. **Commit** -- One commit per module, with PROGRESS.md updated.

### When to Stop and Ask

Claude should stop and surface a question (in PROGRESS.md under Open Questions, and in the commit message) when:

- A design choice contradicts or isn't covered by the principles in DISTILLATION.md
- The scouting report reveals essential functionality that the roadmap explicitly deferred
- An interface decision would constrain a future module in a way not anticipated here
- The implementation is significantly larger or more complex than expected (suggesting the scope was underestimated)
- Two modules want incompatible interfaces

These are logged, not blocking. Claude should make its best judgment call, document the reasoning, and continue. The human reviews at module boundaries.

---

## Decision Authority

### Decisions Claude Can Make

These follow directly from DISTILLATION.md principles and established patterns:

- **Interface design** -- Choosing function signatures, type shapes, error types. Precedent: embeddings module's `EmbeddingProvider` interface.
- **What to omit** -- Removing accidental complexity identified in scouting reports (unused config, dead code paths, over-generalized abstractions). This is the core distillation act.
- **Implementation approach** -- Choosing data structures, algorithms, internal organization within a module. Must follow coding philosophy in CLAUDE.md (immutability, Rust-compatible TypeScript, clarity over brevity).
- **Test strategy** -- Deciding what to test and how, following `docs/testing-strategy.md` (leaf layers mock externals, core layers use pure functions, orchestration mocks only external boundaries).
- **Module-internal boundaries** -- Splitting or merging functions/types within a single module.

### Decisions That Need Discussion

These involve cross-module architectural choices or scope changes:

- **Adding scope** -- If a module seems to need functionality not in the roadmap, flag it. Don't build it.
- **Changing interfaces of completed modules** -- If a new module needs a different interface from an already-built module, document the need rather than changing the existing module.
- **Promoting a deferred item** -- If deferred functionality (e.g., vector search) turns out to be needed earlier than planned, flag it.
- **New architectural decisions** -- Choices that would be added to the "Key Decisions" list in PROGRESS.md.

### Pre-Resolved Decisions

These were discussed during roadmap creation and are settled:

1. **File-based storage, not SQLite** -- OpenClaw uses file-based storage (JSON metadata, JSONL transcripts) for sessions and conversation history. SQLite is only used for the derived memory search index. Since we are deferring vector search, there is no need for SQLite in the initial system. Storage is JSON/JSONL files with file locking.

2. **Single-session assumption** -- The initial system manages one session at a time. Session Store is implemented, but multi-session management is deferred. The interface must support future multi-session without breaking callers.

3. **Single-agent, routing as stub** -- Routing resolves every message to the one active session. The interface is designed for multi-agent dispatch so it can be replaced later, but the implementation is trivial.

4. **History Management merges into Context Window** -- In the original, these are separate because history has independent pruning rules. With a single session and modern context windows, the distilled version treats history management as a policy within the Context Window module, not a separate module. The interface allows separating them later if needed.

5. **Agent Alignment is thin** -- The scouting report covers plugin hooks, skills config, extension loading -- all dropped per "no plugin hooks for core behavior" (Decision #2 in PROGRESS.md). What remains: prompt assembly from parts, a tool permission model, and project config loading. Each is a small, focused module.

6. **Cross-Agent Access is out of scope** -- Already deferred in PROGRESS.md Decision #4. Not on this roadmap.

7. **Vector search, file sync, memory manager deferred** -- These compose the "smart memory" layer that requires SQLite + embeddings infrastructure. The minimal viable agent uses file-based conversation history and does not need semantic search over past sessions. When the time comes, the embeddings module (already built) and the storage interfaces (designed for extensibility) provide the foundation.

---

## The Roadmap

### Phase 1: Storage & Session Foundation

The persistence layer everything else builds on.

**1.1 -- Storage**

Scope: File-based persistence primitives. JSON read/write with atomic operations. JSONL append-only logs. File locking for concurrency safety.

Source material: `scouting/session-management.md` (store.ts ~440 lines, transcript.ts ~133 lines, paths.ts ~73 lines).

What to build:
- JSON store: read, write, atomic update (read-modify-write with lock)
- JSONL log: append, read-all, read-range
- File locking: advisory locks to prevent concurrent corruption
- Path resolution: deterministic file paths from session/entity IDs

What to omit:
- SQLite (deferred -- see Pre-Resolved Decision #1)
- Caching layer (if needed, it's a separate concern above storage)
- Migration logic (no legacy data to migrate)

Key interface question (pre-resolved): Storage is generic -- it doesn't know about sessions or messages. It stores and retrieves JSON documents and appends to JSONL logs. Session-specific semantics live in the Session Store layer above.

**1.2 -- Session Store**

Scope: Session lifecycle management. Create, resume, end sessions. Persist session metadata and message history. Single-session to start.

Source material: `scouting/session-management.md` (store.ts ~440 lines, lifecycle in state machine).

What to build:
- Session creation with metadata (ID, timestamps, status)
- Message appending (to JSONL transcript via Storage)
- Session resume (load metadata + transcript)
- Session end (mark status, finalize transcript)
- Interface designed for multi-session (list, get-by-ID) even if only one exists

What to omit:
- Multi-session management (deferred -- see Pre-Resolved Decision #2)
- Session search/filtering
- Auto-cleanup / TTL
- Session forking or branching

**1.3 -- Session State**

Scope: State machine for session lifecycle. Tracks current state and enforces valid transitions.

Source material: `scouting/session-management.md` (state tracking sections).

What to build:
- State enum: Created, Active, Compacting, Ended
- Transition rules (Created->Active, Active->Compacting, Compacting->Active, Active->Ended)
- Invalid transition rejection (fail clearly)
- State change logging for auditability

What to omit:
- Complex state like "paused", "error-recovery", "migrating"
- Undo/rollback of state transitions
- State persistence separate from session metadata (state is a field on the session, not its own store)

Open question: Session State might be thin enough to fold into Session Store as an internal detail rather than a standalone module. Claude should make this call during design. If it's fewer than ~50 lines of logic, fold it in. If the state machine has meaningful complexity, keep it separate.

---

### Phase 2: Context Pipeline

How conversations are managed within token limits.

**2.1 -- Context Window**

Scope: Given a conversation history and a token budget, decide which messages to include and how to present them. This is where compaction (already built) gets orchestrated.

Source material: `scouting/context-management.md` (~2,630 lines total; context assembly + pruning + history limiting).

What to build:
- Token budget allocation (system prompt, tools, history, response reserve)
- Message selection (recent messages first, respect token budget)
- Compaction trigger (when history exceeds budget, invoke compaction)
- History policy (max messages, max age -- the "History Management" concern folded in per Pre-Resolved Decision #4)

What to omit:
- Multi-stage summarization (compaction handles this in one pass)
- Adaptive ratios (fixed budget allocation is simpler and sufficient)
- Priority-based message retention (unnecessary complexity for single-session)
- Token counting for tool definitions (the LLM API handles this)

Key dependency: Uses `src/compaction/` for summarization. Uses Session Store for message retrieval.

---

### Phase 3: Agent Alignment

How the agent knows what it is and what it can do.

**3.1 -- System Prompt**

Scope: Assemble the system prompt from parts. The system prompt defines the agent's identity, instructions, and constraints.

Source material: `scouting/agent-alignment.md` (prompt generation sections, ~4,261 lines total but much of this is plugin/extension machinery we're dropping).

What to build:
- Prompt assembly from ordered sections (identity, instructions, constraints, project context)
- Section registry (named sections that can be added/replaced)
- Template rendering (variable substitution for dynamic content like project name, current date)

What to omit:
- Plugin hooks for prompt modification
- Dynamic prompt adjustment based on conversation state
- Skills/capability injection from extensions
- Prompt versioning or A/B testing

**3.2 -- Tool Policy**

Scope: Define which tools the agent can use and under what conditions.

Source material: `scouting/agent-alignment.md` (tool policy sections).

What to build:
- Tool registry (name, description, schema, handler reference)
- Permission model (allow/deny per tool, possibly per-project config)
- Tool definition export (format tools for LLM API consumption)

What to omit:
- Dynamic tool enabling/disabling mid-conversation
- Tool usage analytics
- Tool fallback chains
- Per-user tool permissions (single-user system)

**3.3 -- Workspace Bootstrap**

Scope: Detect what project/workspace the agent is operating in and load relevant configuration.

Source material: `scouting/agent-alignment.md` (workspace detection, config loading).

What to build:
- Project detection (find project root, identify project type)
- Config file loading (read project-specific agent config)
- Configuration object assembly (merge defaults with project overrides)
- Feed configuration into System Prompt and Tool Policy

What to omit:
- Extension/plugin discovery and loading
- Remote configuration
- Config file generation/scaffolding
- Multi-project workspaces

---

### Phase 4: Routing (Stub)

**4.1 -- Routing Stub**

Scope: Accept an incoming message and resolve it to the active session.

Source material: `scouting/session-management.md` (routing sections).

What to build:
- Router interface: `resolve(message) -> session` (designed for multi-agent/multi-session)
- Single-agent implementation: always returns the one active session
- Message dispatch: pass resolved message to session for processing

What to omit:
- Multi-agent dispatch logic
- Session creation on first message (session already exists)
- Load balancing or queue management
- Channel-specific routing (Telegram, Discord, etc.)

Design note: The Router interface should be defined during Phase 1 alongside Session Store, even though the implementation waits until Phase 4. This ensures Session Store exposes what Router needs.

---

### Phase 5: Integration

**5.1 -- Integration Validation**

Scope: Verify that all modules compose correctly into a working agent loop.

What to build:
- Integration test: message in -> routing -> session -> context window -> LLM call (mocked) -> response -> session append
- Verify the full pipeline works end-to-end with mocked LLM
- Identify any interface mismatches between modules

This is the checkpoint where we verify the architecture holds together. Any interface friction discovered here gets resolved before building further.

---

### Deferred Work (Out of Scope)

Explicitly not on this roadmap. Documented here so future sessions don't re-derive these decisions.

| Item | Reason Deferred |
|------|----------------|
| Vector search index (SQLite + sqlite-vec) | No semantic search needed for minimal viable agent. Embeddings module is ready when needed. |
| File sync / file watching | Only needed for memory indexing, which depends on vector search. |
| Memory Manager | Orchestrator for search + sync + embeddings. Deferred with its dependencies. |
| Cross-Agent Access | Multi-agent feature. Single-agent assumption for now (PROGRESS.md Decision #4). |
| BM25 / hybrid search | Already decided against (PROGRESS.md Decision #3). Vector-only when search is added. |
| Multi-session management | Single-session assumption. Interface supports it; implementation deferred. |
| Multi-agent routing | Single-agent assumption. Router interface supports it; implementation is a stub. |
| Gateway / IPC broker | Only needed for multi-agent or multi-client. Single-process for now (PROGRESS.md Decision #7). |

---

## Tracking Progress

As each module is completed:

1. Update PROGRESS.md with completion status, metrics (LOC, test count), and any insights
2. Move to the next roadmap item
3. If a module surfaces an issue with a previous module's interface, document it in PROGRESS.md under Open Questions rather than modifying the completed module

The roadmap is a plan, not a prison. If the plan is wrong, document why and propose an adjustment. But the bar for deviation is high -- most "this needs to change" impulses are better resolved by working within the constraints than by changing them.
