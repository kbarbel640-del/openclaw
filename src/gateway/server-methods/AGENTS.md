# Gateway Server Methods Notes

- Pi session transcripts are a `parentId` chain/DAG; never append Pi `type: "message"` entries via raw JSONL writes (missing `parentId` can sever the leaf path and break compaction/history). Always write transcript messages via `SessionManager.appendMessage(...)` (or a wrapper that uses it).

## Token Efficiency

- Never re-read files you just wrote or edited unless there was a write error or external modification risk.
- Never re-run commands just to “double check” when the first result is already deterministic and successful.
- Don’t echo large code/file contents in chat unless explicitly asked; summarize key diffs and outcomes.
- Batch related reads/commands and avoid redundant tool calls.
- Keep updates tight: what changed, why, and what remains.
