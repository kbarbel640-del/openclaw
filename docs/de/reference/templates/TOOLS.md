---
summary: „Workspace-Vorlage für TOOLS.md“
read_when:
  - Manuelles Bootstrapping eines Workspace
x-i18n:
  source_path: reference/templates/TOOLS.md
  source_hash: 3ed08cd537620749
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:23Z
---

# TOOLS.md - Lokale Notizen

Skills definieren, _wie_ Werkzeuge funktionieren. Diese Datei ist für _Ihre_ Besonderheiten — die Dinge, die für Ihr Setup einzigartig sind.

## Was gehört hier hinein

Zum Beispiel:

- Kameranamen und -standorte
- SSH-Hosts und -Aliase
- Bevorzugte Stimmen für TTS
- Lautsprecher-/Raumnamen
- Gerätenicknames
- Alles Umgebungsabhängige

## Beispiele

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Warum trennen?

Skills werden geteilt. Ihr Setup gehört Ihnen. Die Trennung bedeutet, dass Sie Skills aktualisieren können, ohne Ihre Notizen zu verlieren, und Skills teilen können, ohne Ihre Infrastruktur preiszugeben.

---

Fügen Sie alles hinzu, was Ihnen bei Ihrer Arbeit hilft. Dies ist Ihr Spickzettel.
