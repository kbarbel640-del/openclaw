---
summary: „Repository-Skripte: Zweck, Umfang und Sicherheitshinweise“
read_when:
  - Beim Ausführen von Skripten aus dem Repository
  - Beim Hinzufügen oder Ändern von Skripten unter ./scripts
title: „Skripte“
x-i18n:
  source_path: scripts.md
  source_hash: efd220df28f20b33
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:32Z
---

# Skripte

Das Verzeichnis `scripts/` enthält Hilfsskripte für lokale Workflows und Betriebsaufgaben.
Verwenden Sie diese, wenn eine Aufgabe klar an ein Skript gebunden ist; andernfalls bevorzugen Sie die CLI.

## Konventionen

- Skripte sind **optional**, sofern sie nicht in der Dokumentation oder in Release-Checklisten referenziert werden.
- Bevorzugen Sie CLI-Oberflächen, wenn sie existieren (Beispiel: Auth-Überwachung nutzt `openclaw models status --check`).
- Gehen Sie davon aus, dass Skripte host-spezifisch sind; lesen Sie sie, bevor Sie sie auf einer neuen Maschine ausführen.

## Auth-Überwachungsskripte

Auth-Überwachungsskripte sind hier dokumentiert:
[/automation/auth-monitoring](/automation/auth-monitoring)

## Beim Hinzufügen von Skripten

- Halten Sie Skripte fokussiert und dokumentiert.
- Fügen Sie einen kurzen Eintrag in der relevanten Dokumentation hinzu (oder erstellen Sie eine, falls sie fehlt).
