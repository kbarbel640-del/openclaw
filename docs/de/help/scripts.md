---
summary: "Repository-Skripte: Zweck, Umfang und Sicherheitshinweise"
read_when:
  - Ausführen von Skripten aus dem Repository
  - Hinzufügen oder Ändern von Skripten unter ./scripts
title: "Skripte"
x-i18n:
  source_path: help/scripts.md
  source_hash: efd220df28f20b33
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:46Z
---

# Skripte

Das Verzeichnis `scripts/` enthält Hilfsskripte für lokale Workflows und operative Aufgaben.
Verwenden Sie diese, wenn eine Aufgabe klar an ein Skript gebunden ist; andernfalls bevorzugen Sie die CLI.

## Konventionen

- Skripte sind **optional**, sofern sie nicht in der Dokumentation oder in Release-Checklisten referenziert werden.
- Bevorzugen Sie CLI-Oberflächen, wenn sie vorhanden sind (Beispiel: Auth-Überwachung verwendet `openclaw models status --check`).
- Gehen Sie davon aus, dass Skripte hostspezifisch sind; lesen Sie sie, bevor Sie sie auf einem neuen Rechner ausführen.

## Skripte zur Auth-Überwachung

Skripte zur Auth-Überwachung sind hier dokumentiert:
[/automation/auth-monitoring](/automation/auth-monitoring)

## Beim Hinzufügen von Skripten

- Halten Sie Skripte fokussiert und dokumentiert.
- Fügen Sie einen kurzen Eintrag in der relevanten Dokumentation hinzu (oder erstellen Sie eine, falls sie fehlt).
