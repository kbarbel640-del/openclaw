---
summary: "Transcricao da Deepgram para notas de voz de entrada"
read_when:
  - Voce quer speech-to-text da Deepgram para anexos de audio
  - Voce precisa de um exemplo rapido de configuracao da Deepgram
title: "Deepgram"
x-i18n:
  source_path: providers/deepgram.md
  source_hash: 8f19e072f0867211
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:04Z
---

# Deepgram (Transcricao de Audio)

Deepgram e uma API de speech-to-text. No OpenClaw, ela e usada para **transcricao de audio/notas de voz de entrada** via `tools.media.audio`.

Quando habilitado, o OpenClaw faz upload do arquivo de audio para a Deepgram e injeta a transcricao no pipeline de resposta (bloco `{{Transcript}}` + `[Audio]`). Isso **nao e streaming**; usa o endpoint de transcricao de audio pre-gravado.

Website: https://deepgram.com  
Docs: https://developers.deepgram.com

## Inicio rapido

1. Defina sua chave de API:

```
DEEPGRAM_API_KEY=dg_...
```

2. Habilite o provedor:

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        models: [{ provider: "deepgram", model: "nova-3" }],
      },
    },
  },
}
```

## Opcoes

- `model`: id do modelo da Deepgram (padrao: `nova-3`)
- `language`: dica de idioma (opcional)
- `tools.media.audio.providerOptions.deepgram.detect_language`: habilitar deteccao de idioma (opcional)
- `tools.media.audio.providerOptions.deepgram.punctuate`: habilitar pontuacao (opcional)
- `tools.media.audio.providerOptions.deepgram.smart_format`: habilitar formatacao inteligente (opcional)

Exemplo com idioma:

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        models: [{ provider: "deepgram", model: "nova-3", language: "en" }],
      },
    },
  },
}
```

Exemplo com opcoes da Deepgram:

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        providerOptions: {
          deepgram: {
            detect_language: true,
            punctuate: true,
            smart_format: true,
          },
        },
        models: [{ provider: "deepgram", model: "nova-3" }],
      },
    },
  },
}
```

## Notas

- A autenticacao segue a ordem padrao de autenticacao de provedores; `DEEPGRAM_API_KEY` e o caminho mais simples.
- Substitua endpoints ou cabecalhos com `tools.media.audio.baseUrl` e `tools.media.audio.headers` ao usar um proxy.
- A saida segue as mesmas regras de audio de outros provedores (limites de tamanho, timeouts, injecao de transcricao).
