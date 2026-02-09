---
name: boot-md
description: "Run BOOT.md on gateway startup"
homepage: https://docs.amigo.ai/hooks#boot-md
metadata:
  {
    "amigo":
      {
        "emoji": "🚀",
        "events": ["gateway:startup"],
        "requires": { "config": ["workspace.dir"] },
        "install": [{ "id": "bundled", "kind": "bundled", "label": "Bundled with Amigo" }],
      },
  }
---

# Boot Checklist Hook

Runs `BOOT.md` every time the gateway starts, if the file exists in the workspace.
