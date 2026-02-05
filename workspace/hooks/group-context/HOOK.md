---
name: group-context
description: Inject group-specific context files based on channel/group config
metadata: {"moltbot":{"events":["agent:bootstrap"]}}
enabled: true
---

# Group Context Hook

This hook loads group-specific context files when a session starts.

## Configuration

In `moltbot.json`, add `contextFiles` to any group config:

```json
{
  "channels": {
    "line": {
      "groups": {
        "Cxxxxxx": {
          "enabled": true,
          "contextFiles": [
            "contexts/my-group-context.md"
          ]
        }
      }
    }
  }
}
```

## How it works

1. When an agent session bootstraps, this hook checks the session key
2. Extracts channel and group ID from the session key
3. Looks up the group config for `contextFiles`
4. Loads those files and appends them to the bootstrap files
