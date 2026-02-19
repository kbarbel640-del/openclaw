# Security & Privacy - Evidence Vault (Local)

## Threat Model

### 1. External Tampering
- **Risk**: A user or malicious process modifies a file within the vault objects directory.
- **Mitigation**: The `evidence_verify` tool re-hashes the file and compares it with the immutable record in the SQLite catalog. The catalog itself is protected by filesystem permissions (0600).

### 2. Path Traversal
- **Risk**: An agent is tricked into ingesting files outside the intended workspace (e.g., `/etc/shadow`).
- **Mitigation**: All input paths are resolved against the OpenClaw safe base directory using `api.resolvePath`. Symlink traversal is blocked by the core's file-system guards.

### 3. Log Leakage
- **Risk**: Sensitive filenames or paths appear in the agent's debug logs.
- **Mitigation**: The `audit.jsonl` and tools use "Redaction-by-Default". Only the SHA256 and the base filename are logged for ingestion events.

## Data Sovereignty
- **No Cloud Egress**: This extension explicitly does not use any network APIs. All hashing and storage are performed by the host's CPU and local disk.
- **Append-Only**: Once a file is ingested, the extension provides no tools for deletion or modification. Removal requires manual administrative action on the host filesystem.

## Privacy Settings
- **Sensitivity Tags**: 
  - `low`: Public info, no special handling.
  - `medium`: Default. Internal investigation data.
  - `high`: Strictly confidential. Evidence results are summarized with minimal detail in the chat.
