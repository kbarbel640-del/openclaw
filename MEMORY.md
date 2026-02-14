# Memory

## Operational Notes

- **Tool Usage**: When using `read` with `offset`, ensure the offset is within the file's bounds. If a read fails with "Offset X is beyond end of file", retry without an offset or with a smaller offset to get the correct content.
- **Edit Reliability Rule**: Before `edit`, first `read`/`grep -n` the exact target line and copy it verbatim (including punctuation/whitespace, e.g., `Spec-driven development:` vs `Spec-driven development :`). Prefer replacing a unique block with nearby context to avoid "Could not find the exact text" errors.
- **Environment Limitations**:
  - `rg` (ripgrep) is **not installed**. **ALWAYS use `grep -r`** instead.
  - `python` is **not installed** in this runtime. Use `node -e` (or available shell tools) for JSON/state processing scripts.
  - `openclaw` CLI binary may be unavailable in this execution PATH; prefer native tools (`session_status`, `gateway`, etc.) over shelling out to `openclaw ...`.
  - **Directory Checks**: Before listing or traversing directories (like `/app/specs`), verify existence (e.g., `ls -d /path 2>/dev/null || echo missing`) to avoid "No such file" errors.
