---
summary: "Análise de localização de canais de entrada (Telegram + WhatsApp) e campos de contexto"
read_when:
  - Ao adicionar ou modificar a análise de localização de canais
  - Ao usar campos de contexto de localização em prompts ou ferramentas do agente
title: "Análise de localização de canais"
x-i18n:
  source_path: channels/location.md
  source_hash: 5602ef105c3da7e4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:15Z
---

# Análise de localização de canais

O OpenClaw normaliza localizações compartilhadas a partir de canais de chat em:

- texto legível por humanos anexado ao corpo de entrada, e
- campos estruturados no payload de contexto de resposta automática.

Atualmente suportado:

- **Telegram** (pinos de localização + locais + localizações ao vivo)
- **WhatsApp** (locationMessage + liveLocationMessage)
- **Matrix** (`m.location` com `geo_uri`)

## Formatação de texto

As localizações são renderizadas como linhas amigáveis sem colchetes:

- Pino:
  - `📍 48.858844, 2.294351 ±12m`
- Local nomeado:
  - `📍 Eiffel Tower — Champ de Mars, Paris (48.858844, 2.294351 ±12m)`
- Compartilhamento ao vivo:
  - `🛰 Live location: 48.858844, 2.294351 ±12m`

Se o canal incluir uma legenda/comentário, ela é anexada na próxima linha:

```
📍 48.858844, 2.294351 ±12m
Meet here
```

## Campos de contexto

Quando uma localização está presente, estes campos são adicionados a `ctx`:

- `LocationLat` (número)
- `LocationLon` (número)
- `LocationAccuracy` (número, metros; opcional)
- `LocationName` (string; opcional)
- `LocationAddress` (string; opcional)
- `LocationSource` (`pin | place | live`)
- `LocationIsLive` (booleano)

## Notas por canal

- **Telegram**: locais mapeiam para `LocationName/LocationAddress`; localizações ao vivo usam `live_period`.
- **WhatsApp**: `locationMessage.comment` e `liveLocationMessage.caption` são anexados como a linha de legenda.
- **Matrix**: `geo_uri` é analisado como um pino de localização; a altitude é ignorada e `LocationIsLive` é sempre falso.
