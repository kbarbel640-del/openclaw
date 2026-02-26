## Problem

When running OpenClaw inside a Docker container with volume mounts, the `systemPromptReport` in `sessions.json` contains container-internal paths (e.g., `/root/.openclaw/workspace-guanguan/MEMORY.md`) instead of host-accessible paths.

This causes issues when external tools (like Claude Code running on the host) try to access these paths, as they don't exist on the host filesystem.

## Solution

Add configuration options:
- **Config file:** `docker.hostStateDir`
- **Environment variable:** `OPENCLAW_HOST_STATE_DIR`

When set, paths in `systemPromptReport` are converted from container paths to host paths.

## Usage

### Via docker-compose.yml

```yaml
services:
  openclaw:
    environment:
      - OPENCLAW_HOST_STATE_DIR=C:\Users\admin\.openclaw
    volumes:
      - C:\Users\admin\.openclaw:/root/.openclaw:rw
```

### Via config file

```json
{
  "docker": {
    "hostStateDir": "C:\\Users\\admin\\.openclaw"
  }
}
```

## Files Changed

- `src/config/zod-schema.docker.ts` - New Docker configuration schema
- `src/infra/docker-paths.ts` - Path conversion utilities
- `src/config/zod-schema.ts` - Added docker field

## Path Conversion Examples

| Container Path | Host Path |
|----------------|-----------|
| `/root/.openclaw/workspace-guanguan/MEMORY.md` | `C:\Users\admin\.openclaw\workspace-guanguan\MEMORY.md` |
| `/data/obsidian/note.md` | `/data/obsidian/note.md` (unchanged - outside state dir) |

## Backward Compatibility

Fully backward compatible - if `docker.hostStateDir` and `OPENCLAW_HOST_STATE_DIR` are not set, behavior is unchanged.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
