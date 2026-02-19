# RECON.md - OpenClaw Fork Reconnaissance

## Architecture Mapping

### Extension System
- **Path**: `extensions/*`
- **Registry**: `src/plugins/registry.ts`
- **Loader**: `src/plugins/loader.ts`
- **SDK**: `src/plugin-sdk/`
- **Decision**: Evidence Vault is a standard extension.

### Skill System
- **Path**: `skills/*`
- **Mechanism**: Agent reads `SKILL.md` using `read` tool based on prompt instructions.
- **Decision**: EvidenceOps skill in `skills/evidenceops/`.

### Memory & Context (Mem0)
- **Path**: `extensions/memory-mem0/`
- **Persistence**: Isolated SQLite (`mem0.db`) with `sqlite-vec` support.
- **Context Assembly**: Budgeted retrieval (top-k) injected via system prompt.
- **Compaction**: Hooked into `after_agent_compaction` for session state persistence.

### Persistence Strategy
- **Evidence Vault**: `~/.openclaw/vault/` (append-only objects + `catalog.db`).
- **Audit**: Dual-log (SQLite + JSONL).

## Implementation Progress
- [x] Sprint 0: Recon & Docs
- [x] Sprint 1: Structure & Skeleton
- [x] Sprint 2: Vault Core (Ingest/Verify/Audit)
- [x] Sprint 3: Manifest & Export (ZIP)
- [x] Sprint 4: EvidenceOps Skill
- [x] Sprint 5: Mem0 Core (Layers & Retrieval)
- [x] Sprint 6: OpenClaw Pipeline Integration (Compaction Hook)
- [x] Sprint 7: Hardening & Initial Docs
- [/] Sprint 8: Advanced Hardening & Local Semantic Search (In Progress)

### Sprint 8: Hardening & Optimization
- **Security**: SQL Prepared Statements and Path Sanitization audit.
- **Semantic Search**: Integration of `sqlite-vec` for vector-based retrieval in Mem0.
- **Receipt Polish**: Formatting evidence receipts for better UX.
