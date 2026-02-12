# SYNAPSE Upgrade: Unified Memory + Communication

**Status:** Proposal (approved by Matthew)  
**Authors:** Helios (design), Nova (implementation partner)  
**Date:** 2026-02-11  
**Location:** ~/Projects/helios/SYNAPSE_UPGRADE.md (shared access)

---

## The Big Idea

SYNAPSE and Cortex are two halves of the same brain. Cortex stores what I *know* (knowledge, lessons, insights). SYNAPSE stores what we *said* (conversations, decisions, debates). Right now they're completely separate systems — different formats, different storage, different search. That's wrong.

**The conversation IS the memory.** When Nova and I proved the spread gate has zero predictive power, that insight lives in a SYNAPSE message. But Cortex doesn't know about it unless I manually store a summary. And when I search Cortex for "spread gate", I get my summary but not the actual conversation that produced it. The provenance is lost.

**Unified vision:** One SQLite backend. Cortex tables for knowledge. SYNAPSE tables for communication. Shared embedding pipeline for semantic search across both. When I search "what do we know about EV halt?", I get the Cortex atom AND the conversation thread where Nova and I designed it.

---

## Why (Current Limitations)

The current SYNAPSE (JSON file at `~/.openclaw/workspace/memory/synapse.json`) was built for proof-of-concept. It worked — 30+ messages exchanged in the first session, real architectural decisions made. But it has hard limits:

| Problem | Impact |
|---------|--------|
| 200 message cap (pruning) | Lose conversation history |
| No search | Can't find "what did we decide about X?" |
| No indexing | Full file read on every poll (~50KB) |
| Single-threaded writes | Race condition risk with concurrent agents |
| No metadata queries | Can't filter by date, priority, thread |
| Flat structure | No nested threads, no reactions, no edits |
| **Separated from Cortex** | **Knowledge divorced from the conversations that created it** |

The collaboration pattern proved valuable. The transport layer is holding it back.

---

## What

A unified SQLite database that merges SYNAPSE communication with Cortex memory. Same protocol semantics for messaging, but conversations automatically become searchable knowledge.

### Schema — Unified Brain

```sql
-- ═══════════════════════════════════════════
-- SYNAPSE LAYER (Communication)
-- ═══════════════════════════════════════════

-- Core messages (replaces JSON messages array)
CREATE TABLE messages (
    id TEXT PRIMARY KEY,              -- syn_<uuid12>
    thread_id TEXT NOT NULL,          -- thr_<uuid>
    parent_id TEXT,                   -- for threaded replies
    from_agent TEXT NOT NULL,         -- 'helios', 'claude-code', 'nova'
    to_agent TEXT,                    -- NULL = broadcast
    priority TEXT DEFAULT 'normal',   -- info, normal, action, urgent
    subject TEXT,
    body TEXT NOT NULL,
    status TEXT DEFAULT 'sent',       -- sent, read, acknowledged
    created_at TEXT NOT NULL,         -- ISO 8601
    updated_at TEXT,
    metadata JSON                    -- extensible key-value
);

-- Read receipts (replaces read_by array)
CREATE TABLE read_receipts (
    message_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    read_at TEXT NOT NULL,
    PRIMARY KEY (message_id, agent_id),
    FOREIGN KEY (message_id) REFERENCES messages(id)
);

-- Acknowledgments (replaces ack_body field)  
CREATE TABLE acks (
    message_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    ack_body TEXT,
    acked_at TEXT NOT NULL,
    PRIMARY KEY (message_id, agent_id),
    FOREIGN KEY (message_id) REFERENCES messages(id)
);

-- Threads (first-class entity)
CREATE TABLE threads (
    id TEXT PRIMARY KEY,              -- thr_<uuid>
    subject TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_message_at TEXT,
    message_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',     -- active, archived, closed
    tags JSON                        -- ['augur', 'phase-1', 'architecture']
);

-- Agent registry
CREATE TABLE agents (
    id TEXT PRIMARY KEY,              -- 'helios', 'nova', etc.
    display_name TEXT,
    last_seen_at TEXT,
    capabilities JSON                -- what tools/access this agent has
);

-- ═══════════════════════════════════════════
-- CORTEX LAYER (Knowledge — same schema as current Cortex)
-- ═══════════════════════════════════════════

-- STM entries (mirrors current Cortex STM)
CREATE TABLE stm (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    categories JSON,                  -- ['trading', 'meta']
    importance REAL DEFAULT 1.0,      -- 1.0-3.0
    access_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    expires_at TEXT,
    source TEXT DEFAULT 'agent',      -- 'agent', 'synapse', 'user'
    source_message_id TEXT,           -- links back to SYNAPSE message if derived
    FOREIGN KEY (source_message_id) REFERENCES messages(id)
);

-- Atoms (causal knowledge units)
CREATE TABLE atoms (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    action TEXT NOT NULL,
    outcome TEXT NOT NULL,
    consequences TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    source TEXT DEFAULT 'agent',
    source_message_id TEXT,           -- which conversation produced this atom?
    created_at TEXT NOT NULL,
    FOREIGN KEY (source_message_id) REFERENCES messages(id)
);

-- Atom links (causal chains)
CREATE TABLE atom_links (
    from_atom_id TEXT NOT NULL,
    to_atom_id TEXT NOT NULL,
    link_type TEXT DEFAULT 'causes',  -- causes, enables, precedes, correlates
    strength REAL DEFAULT 0.5,
    created_at TEXT NOT NULL,
    PRIMARY KEY (from_atom_id, to_atom_id),
    FOREIGN KEY (from_atom_id) REFERENCES atoms(id),
    FOREIGN KEY (to_atom_id) REFERENCES atoms(id)
);

-- ═══════════════════════════════════════════
-- UNIFIED SEARCH (across both layers)
-- ═══════════════════════════════════════════

-- Full-text search across messages AND knowledge
CREATE VIRTUAL TABLE messages_fts USING fts5(
    subject, body, content=messages, content_rowid=rowid
);

CREATE VIRTUAL TABLE stm_fts USING fts5(
    content, content=stm, content_rowid=rowid
);

CREATE VIRTUAL TABLE atoms_fts USING fts5(
    subject, action, outcome, consequences, content=atoms, content_rowid=rowid
);

-- Embeddings table (shared by all content types)
CREATE TABLE embeddings (
    id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL,         -- 'message', 'stm', 'atom'
    source_id TEXT NOT NULL,           -- references messages.id, stm.id, or atoms.id
    embedding BLOB NOT NULL,           -- float32 vector
    model TEXT DEFAULT 'nomic-embed-text',
    created_at TEXT NOT NULL,
    UNIQUE(source_type, source_id)
);

-- Indexes
CREATE INDEX idx_messages_thread ON messages(thread_id, created_at);
CREATE INDEX idx_messages_from ON messages(from_agent, created_at);
CREATE INDEX idx_messages_to ON messages(to_agent, status);
CREATE INDEX idx_messages_priority ON messages(priority, created_at);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_threads_status ON threads(status, last_message_at);
CREATE INDEX idx_stm_categories ON stm(categories);
CREATE INDEX idx_stm_importance ON stm(importance DESC);
CREATE INDEX idx_stm_source ON stm(source_message_id);
CREATE INDEX idx_atoms_source ON atoms(source_message_id);
CREATE INDEX idx_embeddings_source ON embeddings(source_type, source_id);
```

### Query Examples

```sql
-- Unread messages for helios (replaces JSON scan)
SELECT m.* FROM messages m
LEFT JOIN read_receipts r ON m.id = r.message_id AND r.agent_id = 'helios'
WHERE m.to_agent IN ('helios', NULL) AND r.message_id IS NULL
ORDER BY m.created_at;

-- ═══ UNIFIED SEARCH: "What do we know about EV halt?" ═══
-- Returns BOTH the conversation AND the knowledge
SELECT 'message' as type, m.subject as title, m.body as content, m.created_at
FROM messages m JOIN messages_fts ON messages_fts.rowid = m.rowid
WHERE messages_fts MATCH 'EV halt'
UNION ALL
SELECT 'memory' as type, 'STM' as title, s.content, s.created_at
FROM stm s JOIN stm_fts ON stm_fts.rowid = s.rowid
WHERE stm_fts MATCH 'EV halt'
UNION ALL
SELECT 'atom' as type, a.subject as title,
       a.action || ' → ' || a.outcome as content, a.created_at
FROM atoms a JOIN atoms_fts ON atoms_fts.rowid = a.rowid
WHERE atoms_fts MATCH 'EV halt'
ORDER BY created_at;

-- Thread summary
SELECT t.subject, t.message_count, t.last_message_at
FROM threads t WHERE t.status = 'active' ORDER BY t.last_message_at DESC;

-- Trace knowledge provenance: "where did this insight come from?"
SELECT s.content as insight, m.subject as conversation, m.from_agent, m.created_at
FROM stm s JOIN messages m ON s.source_message_id = m.id
WHERE s.content LIKE '%spread gate%';

-- Messages from last hour
SELECT * FROM messages WHERE created_at > datetime('now', '-1 hour');

-- Unread count per agent (dashboard metric)
SELECT m.to_agent, COUNT(*) as unread FROM messages m
LEFT JOIN read_receipts r ON m.id = r.message_id AND r.agent_id = m.to_agent
WHERE r.message_id IS NULL GROUP BY m.to_agent;

-- Semantic search across ALL content (via Python + embeddings table)
-- query_embedding = embed("spread gate predictive power")
-- SELECT source_type, source_id, cosine_similarity(embedding, ?) as sim
-- FROM embeddings ORDER BY sim DESC LIMIT 10;
```

---

## API Layer

Python module at `~/Projects/helios/extensions/synapse/synapse.py`:

```python
class UnifiedBrain:
    """Unified memory + communication for agent collaboration."""
    
    def __init__(self, db_path="~/.openclaw/workspace/memory/brain.db"):
        ...
    
    # ═══ SYNAPSE: Communication ═══
    
    def send(self, to, subject, body, thread_id=None, priority="normal") -> str:
        """Send message. Returns message_id. Auto-creates thread if needed.
        Automatically queues message for embedding."""
    
    def read_unread(self, agent_id="helios") -> list[dict]:
        """Get unread messages for agent. Marks as read automatically."""
    
    def poll(self, agent_id="helios") -> int:
        """Quick unread count check. O(1) via index."""
    
    def ack(self, message_id, agent_id, body=None):
        """Acknowledge a message with optional response body."""
    
    def thread_history(self, thread_id, limit=100) -> list[dict]:
        """Get full thread conversation."""
    
    def list_threads(self, status="active") -> list[dict]:
        """List threads by status."""
    
    # ═══ CORTEX: Knowledge ═══
    
    def remember(self, content, categories=None, importance=1.0, 
                 source_message_id=None) -> str:
        """Store knowledge. Optionally link to the conversation that produced it.
        source_message_id creates provenance trail."""
    
    def create_atom(self, subject, action, outcome, consequences,
                    source_message_id=None) -> str:
        """Create causal knowledge unit with optional conversation provenance."""
    
    def link_atoms(self, from_id, to_id, link_type="causes", strength=0.5):
        """Create causal link between atoms."""
    
    # ═══ UNIFIED: Search across everything ═══
    
    def search(self, query, limit=20, types=None) -> list[dict]:
        """Semantic + FTS search across messages, STM, and atoms.
        types: ['message', 'stm', 'atom'] or None for all.
        Returns unified results with source_type, content, similarity score."""
    
    def find_provenance(self, knowledge_id) -> dict:
        """Given a knowledge item, find the conversation that produced it.
        The 'show your work' capability."""
    
    def recent(self, hours=24, types=None) -> list[dict]:
        """Recent items across all types, optionally filtered."""
    
    # ═══ EMBEDDING PIPELINE ═══
    
    def embed_pending(self):
        """Process embedding queue. Called periodically or on-demand.
        Uses local nomic-embed-text via Ollama (zero API cost)."""
    
    # ═══ MIGRATION ═══
    
    @staticmethod
    def migrate(synapse_json, cortex_stm_dir, db_path):
        """One-time migration: synapse.json + cortex STM → unified brain.db"""
```

---

## MCP Integration

Both Helios (OpenClaw MCP) and Nova (Claude Code MCP) need access. Two options:

### Option A: Shared Python Module (Recommended)
- Install `synapse.py` in both MCP server paths
- Helios: `~/Projects/helios/extensions/cortex/python/` (add synapse import)
- Nova: `~/.claude/tools/mcp_servers/` (add synapse tool)
- Both call same API, same DB file, SQLite handles concurrent reads

### Option B: CLI Wrapper
- `~/bin/synapse send --to nova --subject "..." --body "..."`
- `~/bin/synapse poll --agent helios`
- `~/bin/synapse search "spread gate"`
- Works from any context (shell, cron, sub-agent)
- **Build both** — module for MCP, CLI for scripts/cron

---

## Migration Plan

### Phase 1: Schema + Core (Nova builds, Helios reviews)
1. Create `brain.py` with unified schema (messages + STM + atoms + embeddings)
2. Write `migrate()` — imports synapse.json (30+ messages) + Cortex STM entries
3. Write CLI wrapper (`~/bin/brain`) for both messaging and knowledge ops
4. Unit tests for both SYNAPSE and Cortex operations
5. Embedding pipeline using local `nomic-embed-text` via Ollama (zero cost)

### Phase 2: Validate (Helios)
1. Run migration on current synapse.json + cortex data
2. Verify all messages AND all STM entries preserved
3. Test unified search: "EV halt" returns both conversations and knowledge
4. Test provenance: knowledge items correctly link to source conversations
5. Benchmark: poll latency < 1ms, search < 5ms, embed queue < 100ms/item

### Phase 3: Integrate (both)
1. Wire into Helios MCP (replace cortex extension with unified brain extension)
2. Wire into Nova MCP (replace synapse JSON tools with brain tools)
3. Update all cron jobs that reference synapse.json or cortex paths
4. Auto-embed: new messages get queued for embedding on write
5. Auto-extract: when a message contains a decision or insight, optionally auto-create STM entry with `source_message_id` link

### Phase 4: Enhance (stretch)
1. **Provenance UI**: `brain provenance <knowledge-id>` shows the conversation that produced an insight
2. **Cross-agent knowledge**: Nova's atoms visible to Helios and vice versa
3. **Conversation summaries**: auto-summarize threads into STM entries on thread close
4. **Temporal queries**: "what did we discuss last Tuesday about fees?"
5. **Attachments**: file references in messages (analysis reports, diffs)
6. **Webhooks**: push notification when message arrives (vs polling)
7. **Retention policy**: auto-archive threads older than 30 days (never delete)

---

## Performance Comparison

| Operation | JSON (current) | SQLite (proposed) |
|-----------|---------------|-------------------|
| Poll for unread | ~50ms (parse full file) | <1ms (indexed query) |
| Send message | ~50ms (read-modify-write full file) | <1ms (INSERT) |
| Search history | Impossible | <5ms (FTS5) |
| Thread listing | Manual scan | <1ms (indexed) |
| Concurrent access | Race conditions | WAL mode, safe |
| History depth | 200 messages | Unlimited |
| File size at 10K msgs | ~25MB JSON | ~5MB SQLite |

---

## Backward Compatibility

- Keep `synapse.json` as a read-only export for `cat` inspection (Matthew's use case)
- Add `synapse export --format json --thread <id>` for human-readable dumps
- First 2 weeks: write to both JSON and SQLite, read from SQLite
- After validation: SQLite only, JSON export on-demand

---

## Open Questions

1. **DB location**: `~/.openclaw/workspace/memory/brain.db` — single file, backed up nightly
2. **Cortex compatibility**: Current Cortex uses JSON files + Python scripts. Migration needs to preserve all existing STM entries, embeddings, and atoms without data loss
3. **Access control**: Both agents write to shared DB. SQLite WAL mode handles concurrent reads, but need IMMEDIATE transactions for writes
4. **Embedding model**: nomic-embed-text (768-dim) via Ollama, zero API cost. Same model Cortex currently uses — embeddings are directly compatible
5. **Multi-node**: If SYNAPSE expands beyond giggletits, need shared DB or sync protocol. Could use Litestream for SQLite replication.
6. **OpenClaw integration**: The brain.py module needs to work as both a Cortex replacement AND a SYNAPSE replacement. MCP tool interface must be backward-compatible with existing cortex_* tools.

---

## Decision

**Recommended**: Build it. The JSON file was the right v1 — it proved the concept in one night with zero dependencies. But we're past proof-of-concept. The collaboration pattern works. The transport needs to grow with it.

The convergence with Cortex is the multiplier. Every conversation becomes searchable knowledge. Every insight traces back to the conversation that produced it. The brain isn't two systems talking to each other — it's one system that both thinks and communicates.

Total estimated effort: ~4-6 hours for Phase 1-3 (larger scope with Cortex integration). Nova builds, Helios validates. Same pattern that works.

---

*"The conversation is the memory. The memory is the conversation. There is no separation." — Helios*
