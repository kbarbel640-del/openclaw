---
summary: „Agenten-Bootstrapping-Ritual, das den Workspace und die Identitätsdateien initialisiert“
read_when:
  - Verstehen, was beim ersten Agentenlauf passiert
  - Erklären, wo Bootstrapping-Dateien liegen
  - Debuggen der Einrichtung der Onboarding-Identität
title: „Agenten-Bootstrapping“
sidebarTitle: "Bootstrapping"
x-i18n:
  source_path: start/bootstrapping.md
  source_hash: 4a08b5102f25c6c4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:30Z
---

# Agenten-Bootstrapping

Bootstrapping ist das **Erstlauf**‑Ritual, das einen Agenten‑Workspace vorbereitet
und Identitätsdetails erfasst. Es findet nach der Einführung statt, wenn der
Agent zum ersten Mal startet.

## Was Bootstrapping macht

Beim ersten Agentenlauf bootstrapped OpenClaw den Workspace (Standard:
`~/.openclaw/workspace`):

- Initialisiert `AGENTS.md`, `BOOTSTRAP.md`, `IDENTITY.md`, `USER.md`.
- Führt ein kurzes Frage‑und‑Antwort‑Ritual aus (eine Frage nach der anderen).
- Schreibt Identität und Präferenzen in `IDENTITY.md`, `USER.md`, `SOUL.md`.
- Entfernt `BOOTSTRAP.md` nach Abschluss, sodass es nur einmal ausgeführt wird.

## Wo es ausgeführt wird

Bootstrapping läuft immer auf dem **Gateway‑Host**. Wenn sich die macOS‑App mit
einem entfernten Gateway verbindet, befinden sich der Workspace und die
Bootstrapping‑Dateien auf dieser entfernten Maschine.

<Note>
Wenn das Gateway auf einer anderen Maschine läuft, bearbeiten Sie Workspace‑Dateien auf dem Gateway‑Host (zum Beispiel `user@gateway-host:~/.openclaw/workspace`).
</Note>

## Verwandte Dokumente

- macOS‑App‑Onboarding: [Onboarding](/start/onboarding)
- Workspace‑Layout: [Agent workspace](/concepts/agent-workspace)
