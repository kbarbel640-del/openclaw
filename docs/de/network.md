---
summary: "Netzwerk-Hub: Gateway-Oberflächen, Pairing, Erkennung und Sicherheit"
read_when:
  - Sie benötigen die Netzwerkarchitektur- und Sicherheitsübersicht
  - Sie debuggen lokalen vs. Tailnet-Zugriff oder Pairing
  - Sie möchten die kanonische Liste der Netzwerkdokumente
title: "Netzwerk"
x-i18n:
  source_path: network.md
  source_hash: 0fe4e7dbc8ddea31
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:49Z
---

# Netzwerk-Hub

Dieser Hub verknüpft die Kerndokumente dazu, wie OpenClaw Geräte über
localhost, LAN und Tailnet verbindet, paart und absichert.

## Kernmodell

- [Gateway-Architektur](/concepts/architecture)
- [Gateway-Protokoll](/gateway/protocol)
- [Gateway-Runbook](/gateway)
- [Web-Oberflächen + Bind-Modi](/web)

## Pairing + Identität

- [Pairing-Übersicht (Direktnachrichten + Knoten)](/start/pairing)
- [Gateway-eigenes Knoten-Pairing](/gateway/pairing)
- [Geräte-CLI (Pairing + Token-Rotation)](/cli/devices)
- [Pairing-CLI (Direktnachrichten-Freigaben)](/cli/pairing)

Lokales Vertrauen:

- Lokale Verbindungen (Loopback oder die eigene Tailnet-Adresse des Gateway-Hosts) können
  für das Pairing automatisch genehmigt werden, um die UX auf demselben Host reibungslos zu halten.
- Nicht-lokale Tailnet-/LAN-Clients erfordern weiterhin eine explizite Pairing-Freigabe.

## Erkennung + Transporte

- [Erkennung & Transporte](/gateway/discovery)
- [Bonjour / mDNS](/gateway/bonjour)
- [Remote-Zugriff (SSH)](/gateway/remote)
- [Tailscale](/gateway/tailscale)

## Knoten + Transporte

- [Knoten-Übersicht](/nodes)
- [Bridge-Protokoll (Legacy-Knoten)](/gateway/bridge-protocol)
- [Knoten-Runbook: iOS](/platforms/ios)
- [Knoten-Runbook: Android](/platforms/android)

## Sicherheit

- [Sicherheitsübersicht](/gateway/security)
- [Gateway-Konfigurationsreferenz](/gateway/configuration)
- [Fehlerbehebung](/gateway/troubleshooting)
- [Doctor](/gateway/doctor)
