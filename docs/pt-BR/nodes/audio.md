---
summary: "Como audios/notas de voz de entrada sao baixados, transcritos e injetados nas respostas"
read_when:
  - Alterar transcricao de audio ou manipulacao de midia
title: "Audio e Notas de Voz"
x-i18n:
  source_path: nodes/audio.md
  source_hash: b926c47989ab0d1e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:46Z
---

# Audio / Notas de Voz — 2026-01-17

## O que funciona

- **Compreensao de midia (audio)**: Se a compreensao de audio estiver habilitada (ou detectada automaticamente), o OpenClaw:
  1. Localiza o primeiro anexo de audio (caminho local ou URL) e faz o download se necessario.
  2. Aplica `maxBytes` antes de enviar para cada entrada de modelo.
  3. Executa a primeira entrada de modelo elegivel em ordem (provedor ou CLI).
  4. Se falhar ou pular (tamanho/timeout), tenta a proxima entrada.
  5. Em caso de sucesso, substitui `Body` por um bloco `[Audio]` e define `{{Transcript}}`.
- **Analise de comandos**: Quando a transcricao tem sucesso, `CommandBody`/`RawBody` sao definidos para a transcricao, para que comandos de barra continuem funcionando.
- **Logs detalhados**: Em `--verbose`, registramos quando a transcricao e executada e quando ela substitui o corpo.

## Deteccao automatica (padrao)

Se voce **nao configurar modelos** e `tools.media.audio.enabled` **nao** estiver definido como `false`,
o OpenClaw detecta automaticamente nesta ordem e para na primeira opcao funcional:

1. **CLIs locais** (se instaladas)
   - `sherpa-onnx-offline` (requer `SHERPA_ONNX_MODEL_DIR` com encoder/decoder/joiner/tokens)
   - `whisper-cli` (de `whisper-cpp`; usa `WHISPER_CPP_MODEL` ou o modelo tiny empacotado)
   - `whisper` (CLI em Python; baixa modelos automaticamente)
2. **Gemini CLI** (`gemini`) usando `read_many_files`
3. **Chaves de provedor** (OpenAI → Groq → Deepgram → Google)

Para desativar a deteccao automatica, defina `tools.media.audio.enabled: false`.
Para personalizar, defina `tools.media.audio.models`.
Observacao: A deteccao de binarios e feita por melhor esforco no macOS/Linux/Windows; garanta que a CLI esteja no `PATH` (expandimos `~`), ou defina um modelo de CLI explicito com o caminho completo do comando.

## Exemplos de configuracao

### Provedor + fallback de CLI (OpenAI + Whisper CLI)

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        maxBytes: 20971520,
        models: [
          { provider: "openai", model: "gpt-4o-mini-transcribe" },
          {
            type: "cli",
            command: "whisper",
            args: ["--model", "base", "{{MediaPath}}"],
            timeoutSeconds: 45,
          },
        ],
      },
    },
  },
}
```

### Somente provedor com controle por escopo

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        scope: {
          default: "allow",
          rules: [{ action: "deny", match: { chatType: "group" } }],
        },
        models: [{ provider: "openai", model: "gpt-4o-mini-transcribe" }],
      },
    },
  },
}
```

### Somente provedor (Deepgram)

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

## Observacoes e limites

- A autenticacao do provedor segue a ordem padrao de autenticacao de modelos (perfis de auth, variaveis de ambiente, `models.providers.*.apiKey`).
- O Deepgram utiliza `DEEPGRAM_API_KEY` quando `provider: "deepgram"` e usado.
- Detalhes de configuracao do Deepgram: [Deepgram (transcricao de audio)](/providers/deepgram).
- Provedores de audio podem substituir `baseUrl`, `headers` e `providerOptions` via `tools.media.audio`.
- O limite de tamanho padrao e 20MB (`tools.media.audio.maxBytes`). Audios acima do limite sao ignorados para aquele modelo e a proxima entrada e tentada.
- O `maxChars` padrao para audio esta **nao definido** (transcricao completa). Defina `tools.media.audio.maxChars` ou por entrada `maxChars` para reduzir a saida.
- O padrao automatico da OpenAI e `gpt-4o-mini-transcribe`; defina `model: "gpt-4o-transcribe"` para maior precisao.
- Use `tools.media.audio.attachments` para processar varias notas de voz (`mode: "all"` + `maxAttachments`).
- A transcricao fica disponivel para templates como `{{Transcript}}`.
- A saida stdout da CLI e limitada (5MB); mantenha a saida da CLI concisa.

## Armadilhas

- Regras de escopo usam o primeiro match como vencedor. `chatType` e normalizado para `direct`, `group` ou `room`.
- Garanta que sua CLI encerre com codigo 0 e imprima texto simples; JSON precisa ser ajustado via `jq -r .text`.
- Mantenha timeouts razoaveis (`timeoutSeconds`, padrao 60s) para evitar bloquear a fila de respostas.
