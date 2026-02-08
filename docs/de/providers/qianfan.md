---
summary: „Verwenden Sie Qianfans einheitliche API, um in OpenClaw auf viele Modelle zuzugreifen“
read_when:
  - Sie moechten einen einzigen API-Schluessel fuer viele LLMs
  - Sie benoetigen eine Anleitung zur Einrichtung von Baidu Qianfan
title: „Qianfan“
x-i18n:
  source_path: providers/qianfan.md
  source_hash: 2ca710b422f190b6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:50Z
---

# Qianfan-Anbieterleitfaden

Qianfan ist Baidus MaaS-Plattform und stellt eine **einheitliche API** bereit, die Anfragen hinter einem einzigen
Endpunkt und API-Schluessel an viele Modelle weiterleitet. Sie ist OpenAI-kompatibel, sodass die meisten OpenAI-SDKs
durch Umstellen der Base-URL funktionieren.

## Voraussetzungen

1. Ein Baidu-Cloud-Konto mit Qianfan-API-Zugriff
2. Ein API-Schluessel aus der Qianfan-Konsole
3. OpenClaw auf Ihrem System installiert

## Ihren API-Schluessel erhalten

1. Besuchen Sie die [Qianfan-Konsole](https://console.bce.baidu.com/qianfan/ais/console/apiKey)
2. Erstellen Sie eine neue Anwendung oder waehlen Sie eine bestehende aus
3. Generieren Sie einen API-Schluessel (Format: `bce-v3/ALTAK-...`)
4. Kopieren Sie den API-Schluessel zur Verwendung mit OpenClaw

## CLI-Einrichtung

```bash
openclaw onboard --auth-choice qianfan-api-key
```

## Verwandte Dokumentation

- [OpenClaw-Konfiguration](/gateway/configuration)
- [Modellanbieter](/concepts/model-providers)
- [Agent-Einrichtung](/concepts/agent)
- [Qianfan-API-Dokumentation](https://cloud.baidu.com/doc/qianfan-api/s/3m7of64lb)
