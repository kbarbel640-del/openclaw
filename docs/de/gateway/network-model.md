---
summary: „Wie Gateway, Knoten und Canvas-Host verbunden sind.“
read_when:
  - Sie moechten eine kompakte Uebersicht ueber das Gateway-Netzwerkmodell
title: „Netzwerkmodell“
x-i18n:
  source_path: gateway/network-model.md
  source_hash: e3508b884757ef19
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:27Z
---

Die meisten Vorgaenge laufen ueber das Gateway (`openclaw gateway`), einen einzelnen, langfristig laufenden
Prozess, der Kanalverbindungen und die WebSocket-Steuerungsebene besitzt.

## Grundregeln

- Ein Gateway pro Host wird empfohlen. Es ist der einzige Prozess, der die WhatsApp-Web-Sitzung besitzen darf. Fuer Rettungsbots oder strikte Isolation betreiben Sie mehrere Gateways mit isolierten Profilen und Ports. Siehe [Multiple gateways](/gateway/multiple-gateways).
- Loopback zuerst: Das Gateway-WS verwendet standardmaessig `ws://127.0.0.1:18789`. Der Assistent erzeugt standardmaessig ein Gateway-Token, auch fuer Loopback. Fuer den Tailnet-Zugriff fuehren Sie `openclaw gateway --bind tailnet --token ...` aus, da Tokens fuer Nicht-Loopback-Bindungen erforderlich sind.
- Knoten verbinden sich je nach Bedarf ueber LAN, Tailnet oder SSH mit dem Gateway-WS. Die legacy TCP-Bridge ist veraltet.
- Der Canvas-Host ist ein HTTP-Dateiserver auf `canvasHost.port` (Standard `18793`), der `/__openclaw__/canvas/` fuer Knoten-WebViews bereitstellt. Siehe [Gateway configuration](/gateway/configuration) (`canvasHost`).
- Remote-Nutzung erfolgt typischerweise ueber einen SSH-Tunnel oder ein Tailnet-VPN. Siehe [Remote access](/gateway/remote) und [Discovery](/gateway/discovery).
