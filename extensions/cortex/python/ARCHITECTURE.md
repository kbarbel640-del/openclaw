# ARCHITECTURE.md — Unified Brain

## Overview

brain-db is a unified SQLite database that merges two previously separate systems:

1. **SYNAPSE** — inter-agent messaging protocol (was JSON file)
2. **Cortex** — knowledge management (was separate JSON + SQLite files)

The key insight: *the conversation IS the memory*. When agents discuss a decision, that discussion should be searchable as knowledge. When knowledge is retrieved, it should trace back to the conversation that produced it.

## Data Flow

```
                  ┌─────────────────────────┐
                  │      MCP Clients         │
                  │  (Helios, Nova, agents)  │
                  └──────────┬──────────────┘
                             │
                    ┌────────▼────────┐
                    │   mcp_server.py  │
                    │  4 tools:        │
                    │  cortex, atom,   │
                    │  temporal,       │
                    │  synapse         │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │    brain.py      │
                    │  UnifiedBrain()  │
                    └────────┬────────┘
                             │
              ┌──────────────▼──────────────┐
              │         brain.db             │
              │    (SQLite + WAL mode)       │
              │                              │
              │  ┌────────┐  ┌───────────┐  │
              │  │SYNAPSE │  │  CORTEX   │  │
              │  │messages│  │  stm      │  │
              │  │threads │  │  atoms    │  │
              │  │receipts│  │  links    │  │
              │  │acks    │  │  embeds   │  │
              │  └───┬────┘  └────┬──────┘  │
              │      │            │         │
              │      └──FTS5 ────┘         │
              │  (unified full-text index)  │
              └─────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  ~/bin/brain     │
                    │  CLI wrapper     │
                    └─────────────────┘
```

## Concurrency Model

- **WAL (Write-Ahead Logging)**: Multiple readers, single writer
- **IMMEDIATE transactions**: All writes use `BEGIN IMMEDIATE` to prevent SQLITE_BUSY
- **No connection pooling**: Each operation opens/closes a connection (SQLite handles this efficiently)
- **FTS5 sync**: Managed manually via INSERT after each content write (no triggers, for simplicity)

## Tables

### SYNAPSE Layer

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `messages` | Core agent messages | id, thread_id, from_agent, to_agent, body |
| `threads` | Conversation threads | id, subject, message_count, status |
| `read_receipts` | Who read what | message_id, agent_id, read_at |
| `acks` | Message acknowledgments | message_id, agent_id, ack_body |

### Cortex Layer

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `stm` | Short-term memory | id, content, categories (JSON), importance |
| `atoms` | Causal knowledge units | id, subject, action, outcome, consequences |
| `atom_links` | Causal chains | from_atom_id, to_atom_id, link_type, strength |
| `embeddings` | 384-dim semantic vectors | source_type, source_id, embedding (BLOB) |

### FTS5 Indexes (content-less)

| Table | Indexes | Source |
|-------|---------|--------|
| `messages_fts` | subject, body | messages |
| `stm_fts` | content | stm |
| `atoms_fts` | subject, action, outcome, consequences | atoms |

## Provenance

The killer feature. Every knowledge item (STM entry or atom) has an optional `source_message_id` that links it back to the SYNAPSE message that produced it.

```
stm.source_message_id → messages.id
atoms.source_message_id → messages.id
```

This enables: "I know X because Nova and I discussed it in thread Y on date Z."

## Embedding Pipeline

- Model: `all-MiniLM-L6-v2` (384-dim)
- Server: GPU daemon at `http://localhost:8030/embed`
- Storage: BLOB in `embeddings` table
- Search: cosine similarity in Python (brute-force, sufficient for <100K vectors)
- Atom field embeddings: per-field BLOBs on `atoms` table directly

## File Map

```
~/Projects/helios/extensions/cortex/python/
├── brain.py          # UnifiedBrain class (1,291 lines)
├── mcp_server.py     # MCP tool handlers (wired to brain.py)
├── migrate.py        # One-time migration script
├── brain_cli.py      # Also at ~/bin/brain
├── atomizer.py       # Text → atom extraction
├── deep_abstraction.py  # Causal chain analysis
├── temporal_analysis.py # Time-aware search
├── embeddings_daemon.py # GPU embedding server
└── stm_manager.py    # Legacy (being replaced)

~/.openclaw/workspace/memory/
├── brain.db          # THE database (12MB, WAL mode)
├── brain.db-wal      # WAL file
├── brain.db-shm      # Shared memory file
├── working_memory.json  # Pin sidecar
└── categories.json   # Category sidecar
```

## Migration Path

```
BEFORE (v1):                    AFTER (v2):
~/.openclaw/workspace/memory/   ~/.openclaw/workspace/memory/
├── synapse.json      ─────►   ├── brain.db (unified)
├── stm.json          ─────►   │   ├── messages (from synapse.json)
├── .atoms.db         ─────►   │   ├── stm (from stm.json)
├── .embeddings.db    ─────►   │   ├── atoms (from .atoms.db)
└── (scattered files)          │   ├── embeddings (from .embeddings.db)
                               │   └── FTS5 indexes (new)
                               ├── working_memory.json (sidecar)
                               └── categories.json (sidecar)
```

## Performance

| Operation | JSON (v1) | SQLite (v2) |
|-----------|-----------|-------------|
| Send message | ~50ms (read-modify-write) | <1ms (INSERT) |
| Poll inbox | ~50ms (parse full file) | <1ms (indexed query) |
| FTS search | Impossible | <5ms |
| Semantic search | Separate DB | <50ms (brute-force cosine) |
| History depth | 200 msg cap | Unlimited |
| Concurrent reads | Race conditions | WAL-safe |

## Known Limitations

1. **Brute-force vector search**: O(n) cosine similarity. Fine for <100K embeddings. If scaling needed, add FAISS or sqlite-vss.
2. **Content-less FTS5**: Requires manual rowid sync on insert. No DELETE/UPDATE sync yet.
3. **Provenance not yet linked**: Existing STM entries don't have `source_message_id` set. Future writes will.
4. **Atomizer still writes to old .atoms.db**: TODO redirect to brain.create_atom().
5. **No retention policy**: All data kept forever. May need pruning at >1M entries.
6. **Working memory/categories as JSON sidecars**: Lightweight but inconsistent with "everything in SQLite" goal.

---

*Built by Helios (design) and Nova (implementation), Feb 2026.*
