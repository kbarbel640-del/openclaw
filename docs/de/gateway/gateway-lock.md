---
summary: "Gateway-Singleton-Schutz durch Bindung des WebSocket-Listeners"
read_when:
  - Beim Ausführen oder Debuggen des Gateway-Prozesses
  - Bei der Untersuchung der Durchsetzung einer Einzelinstanz
title: "Gateway-Sperre"
x-i18n:
  source_path: gateway/gateway-lock.md
  source_hash: 15fdfa066d1925da
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:24Z
---

# Gateway-Sperre

Zuletzt aktualisiert: 2025-12-11

## Warum

- Sicherstellen, dass pro Basis-Port auf demselben Host nur eine Gateway-Instanz läuft; zusätzliche Gateways müssen isolierte Profile und eindeutige Ports verwenden.
- Abstürze/SIGKILL überstehen, ohne veraltete Sperrdateien zu hinterlassen.
- Sofort mit einem klaren Fehler fehlschlagen, wenn der Steuerport bereits belegt ist.

## Mechanismus

- Das Gateway bindet den WebSocket-Listener (Standard: `ws://127.0.0.1:18789`) unmittelbar beim Start mithilfe eines exklusiven TCP-Listeners.
- Schlägt die Bindung mit `EADDRINUSE` fehl, wird beim Start `GatewayLockError("another gateway instance is already listening on ws://127.0.0.1:<port>")` ausgelöst.
- Das Betriebssystem gibt den Listener bei jedem Prozessende automatisch frei, einschließlich Abstürzen und SIGKILL — es ist keine separate Sperrdatei oder Aufräumaktion erforderlich.
- Beim Herunterfahren schließt das Gateway den WebSocket-Server und den zugrunde liegenden HTTP-Server, um den Port umgehend freizugeben.

## Fehlerbild

- Wenn ein anderer Prozess den Port hält, wird beim Start `GatewayLockError("another gateway instance is already listening on ws://127.0.0.1:<port>")` ausgelöst.
- Andere Bindungsfehler erscheinen als `GatewayLockError("failed to bind gateway socket on ws://127.0.0.1:<port>: …")`.

## Betriebshinweise

- Ist der Port von einem _anderen_ Prozess belegt, ist der Fehler derselbe; geben Sie den Port frei oder wählen Sie mit `openclaw gateway --port <port>` einen anderen.
- Die macOS-App hält weiterhin eine eigene, leichtgewichtige PID-Sperre, bevor sie das Gateway startet; die Laufzeitsperre wird durch die WebSocket-Bindung durchgesetzt.
