---
summary: „Beheben Sie Probleme bei der Node-Paarung, Vordergrundanforderungen, Berechtigungen und Werkzeugfehlern“
read_when:
  - Node ist verbunden, aber Kamera-/Canvas-/Screen-/Exec-Werkzeuge schlagen fehl
  - Sie benötigen das mentale Modell zu Node-Paarung versus Genehmigungen
title: „Node-Fehlerbehebung“
x-i18n:
  source_path: nodes/troubleshooting.md
  source_hash: 5c40d298c9feaf8e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:52Z
---

# Node-Fehlerbehebung

Verwenden Sie diese Seite, wenn eine Node im Status sichtbar ist, aber Node-Werkzeuge fehlschlagen.

## Befehlsleiter

```bash
openclaw status
openclaw gateway status
openclaw logs --follow
openclaw doctor
openclaw channels status --probe
```

Führen Sie dann Node-spezifische Prüfungen aus:

```bash
openclaw nodes status
openclaw nodes describe --node <idOrNameOrIp>
openclaw approvals get --node <idOrNameOrIp>
```

Gesunde Signale:

- Node ist verbunden und für die Rolle `node` gepaart.
- `nodes describe` umfasst die von Ihnen aufgerufene Fähigkeit.
- Exec-Genehmigungen zeigen den erwarteten Modus bzw. die Allowlist.

## Vordergrundanforderungen

`canvas.*`, `camera.*` und `screen.*` sind auf iOS-/Android-Nodes nur im Vordergrund verfügbar.

Schnellprüfung und -behebung:

```bash
openclaw nodes describe --node <idOrNameOrIp>
openclaw nodes canvas snapshot --node <idOrNameOrIp>
openclaw logs --follow
```

Wenn Sie `NODE_BACKGROUND_UNAVAILABLE` sehen, bringen Sie die Node-App in den Vordergrund und versuchen Sie es erneut.

## Berechtigungsmatrix

| Fähigkeit                    | iOS                                                     | Android                                         | macOS-Node-App                     | Typischer Fehlercode           |
| ---------------------------- | ------------------------------------------------------- | ----------------------------------------------- | ---------------------------------- | ------------------------------ |
| `camera.snap`, `camera.clip` | Kamera (+ Mikrofon für Clip-Audio)                      | Kamera (+ Mikrofon für Clip-Audio)              | Kamera (+ Mikrofon für Clip-Audio) | `*_PERMISSION_REQUIRED`        |
| `screen.record`              | Bildschirmaufnahme (+ Mikrofon optional)                | Bildschirmaufnahme-Prompt (+ Mikrofon optional) | Bildschirmaufnahme                 | `*_PERMISSION_REQUIRED`        |
| `location.get`               | „Während der Nutzung“ oder „Immer“ (abhängig vom Modus) | Vordergrund-/Hintergrund-Standort je nach Modus | Standortberechtigung               | `LOCATION_PERMISSION_REQUIRED` |
| `system.run`                 | n/v (Node-Host-Pfad)                                    | n/v (Node-Host-Pfad)                            | Exec-Genehmigungen erforderlich    | `SYSTEM_RUN_DENIED`            |

## Paarung versus Genehmigungen

Dies sind unterschiedliche Hürden:

1. **Geräte-Paarung**: Kann diese Node eine Verbindung zum Gateway herstellen?
2. **Exec-Genehmigungen**: Darf diese Node einen bestimmten Shell-Befehl ausführen?

Schnellprüfungen:

```bash
openclaw devices list
openclaw nodes status
openclaw approvals get --node <idOrNameOrIp>
openclaw approvals allowlist add --node <idOrNameOrIp> "/usr/bin/uname"
```

Wenn die Paarung fehlt, genehmigen Sie zuerst das Node-Gerät.
Wenn die Paarung in Ordnung ist, aber `system.run` fehlschlägt, beheben Sie die Exec-Genehmigungen/Allowlist.

## Häufige Node-Fehlercodes

- `NODE_BACKGROUND_UNAVAILABLE` → App ist im Hintergrund; bringen Sie sie in den Vordergrund.
- `CAMERA_DISABLED` → Kamera-Umschalter in den Node-Einstellungen deaktiviert.
- `*_PERMISSION_REQUIRED` → OS-Berechtigung fehlt/wurde verweigert.
- `LOCATION_DISABLED` → Standortmodus ist ausgeschaltet.
- `LOCATION_PERMISSION_REQUIRED` → Angeforderter Standortmodus wurde nicht gewährt.
- `LOCATION_BACKGROUND_UNAVAILABLE` → App ist im Hintergrund, aber es existiert nur die Berechtigung „Während der Nutzung“.
- `SYSTEM_RUN_DENIED: approval required` → Exec-Anfrage benötigt eine explizite Genehmigung.
- `SYSTEM_RUN_DENIED: allowlist miss` → Befehl durch Allowlist-Modus blockiert.

## Schneller Wiederherstellungszyklus

```bash
openclaw nodes status
openclaw nodes describe --node <idOrNameOrIp>
openclaw approvals get --node <idOrNameOrIp>
openclaw logs --follow
```

Wenn Sie weiterhin feststecken:

- Geräte-Paarung erneut genehmigen.
- Node-App erneut öffnen (Vordergrund).
- OS-Berechtigungen erneut erteilen.
- Exec-Genehmigungsrichtlinie neu erstellen/anpassen.

Verwandt:

- [/nodes/index](/nodes/index)
- [/nodes/camera](/nodes/camera)
- [/nodes/location-command](/nodes/location-command)
- [/tools/exec-approvals](/tools/exec-approvals)
- [/gateway/pairing](/gateway/pairing)
