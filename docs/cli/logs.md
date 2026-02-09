---
summary: "CLI reference for `amigo logs` (tail gateway logs via RPC)"
read_when:
  - You need to tail Gateway logs remotely (without SSH)
  - You want JSON log lines for tooling
title: "logs"
---

# `amigo logs`

Tail Gateway file logs over RPC (works in remote mode).

Related:

- Logging overview: [Logging](/logging)

## Examples

```bash
amigo logs
amigo logs --follow
amigo logs --json
amigo logs --limit 500
```
