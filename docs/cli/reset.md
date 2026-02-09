---
summary: "CLI reference for `amigo reset` (reset local state/config)"
read_when:
  - You want to wipe local state while keeping the CLI installed
  - You want a dry-run of what would be removed
title: "reset"
---

# `amigo reset`

Reset local config/state (keeps the CLI installed).

```bash
amigo reset
amigo reset --dry-run
amigo reset --scope config+creds+sessions --yes --non-interactive
```
