---
summary: "OpenClaw-Protokollierung: rollierende Diagnosedatei + Datenschutz-Flags der Unified Logging"
read_when:
  - Erfassen von macOS-Protokollen oder Untersuchung der Protokollierung privater Daten
  - Debugging von Voice-Wake-/Sitzungs-Lifecycle-Problemen
title: "macOS-Protokollierung"
x-i18n:
  source_path: platforms/mac/logging.md
  source_hash: c4c201d154915e0e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:01Z
---

# Protokollierung (macOS)

## Rollierende Diagnosedatei (Debug-Bereich)

OpenClaw leitet macOS-App-Protokolle über swift-log (standardmäßig Unified Logging) und kann bei Bedarf eine lokale, rotierende Protokolldatei auf die Festplatte schreiben, wenn Sie eine dauerhafte Erfassung benötigen.

- Ausführlichkeit: **Debug-Bereich → Logs → App logging → Verbosity**
- Aktivieren: **Debug-Bereich → Logs → App logging → „Write rolling diagnostics log (JSONL)”**
- Speicherort: `~/Library/Logs/OpenClaw/diagnostics.jsonl` (rotiert automatisch; alte Dateien erhalten die Suffixe `.1`, `.2`, …)
- Leeren: **Debug-Bereich → Logs → App logging → „Clear”**

Hinweise:

- Standardmäßig **deaktiviert**. Aktivieren Sie dies nur während aktiver Debugging-Arbeiten.
- Behandeln Sie die Datei als sensibel; teilen Sie sie nicht ohne vorherige Prüfung.

## Private Daten in der Unified Logging unter macOS

Unified Logging schwärzt die meisten Payloads, sofern sich ein Subsystem nicht explizit für `privacy -off` entscheidet. Laut Peters Beitrag zu macOS [logging privacy shenanigans](https://steipete.me/posts/2025/logging-privacy-shenanigans) (2025) wird dies über eine plist in `/Library/Preferences/Logging/Subsystems/` gesteuert, die nach dem Subsystem-Namen indiziert ist. Nur neue Protokolleinträge übernehmen das Flag; aktivieren Sie es daher, bevor Sie ein Problem reproduzieren.

## Aktivieren für OpenClaw (`bot.molt`)

- Schreiben Sie die plist zunächst in eine temporäre Datei und installieren Sie sie dann atomar als root:

```bash
cat <<'EOF' >/tmp/bot.molt.plist
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>DEFAULT-OPTIONS</key>
    <dict>
        <key>Enable-Private-Data</key>
        <true/>
    </dict>
</dict>
</plist>
EOF
sudo install -m 644 -o root -g wheel /tmp/bot.molt.plist /Library/Preferences/Logging/Subsystems/bot.molt.plist
```

- Ein Neustart ist nicht erforderlich; logd erkennt die Datei schnell, aber nur neue Logzeilen enthalten private Payloads.
- Zeigen Sie die ausführlichere Ausgabe mit dem vorhandenen Helfer an, z. B. `./scripts/clawlog.sh --category WebChat --last 5m`.

## Nach dem Debugging deaktivieren

- Entfernen Sie die Überschreibung: `sudo rm /Library/Preferences/Logging/Subsystems/bot.molt.plist`.
- Optional führen Sie `sudo log config --reload` aus, um logd zu zwingen, die Überschreibung sofort zu verwerfen.
- Denken Sie daran, dass diese Oberfläche Telefonnummern und Nachrichteninhalte enthalten kann; behalten Sie die plist nur so lange bei, wie Sie die zusätzlichen Details aktiv benötigen.
