---
summary: "CLI-Referenz fuer `openclaw skills` (list/info/check) und Skill-Berechtigung"
read_when:
  - Sie moechten sehen, welche Skills verfuegbar und startbereit sind
  - Sie moechten fehlende Binaries/Umgebungsvariablen/Konfigurationen fuer Skills debuggen
title: "Skills"
x-i18n:
  source_path: cli/skills.md
  source_hash: 7878442c88a27ec8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:48Z
---

# `openclaw skills`

Untersuchen Sie Skills (gebuendelt + Workspace + verwaltete Overrides) und sehen Sie, was berechtigt ist vs. fehlende Anforderungen.

Verwandt:

- Skills-System: [Skills](/tools/skills)
- Skills-Konfiguration: [Skills config](/tools/skills-config)
- ClawHub-Installationen: [ClawHub](/tools/clawhub)

## Befehle

```bash
openclaw skills list
openclaw skills list --eligible
openclaw skills info <name>
openclaw skills check
```
