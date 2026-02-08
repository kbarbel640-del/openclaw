---
summary: "Use o OpenCode Zen (modelos selecionados) com o OpenClaw"
read_when:
  - Voce quer o OpenCode Zen para acesso a modelos
  - Voce quer uma lista selecionada de modelos amigaveis para codificacao
title: "OpenCode Zen"
x-i18n:
  source_path: providers/opencode.md
  source_hash: b3b5c640ac32f317
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:07Z
---

# OpenCode Zen

O OpenCode Zen é uma **lista selecionada de modelos** recomendados pela equipe do OpenCode para agentes de codificacao.
Ele e um caminho opcional e hospedado de acesso a modelos que usa uma chave de API e o provedor `opencode`.
O Zen esta atualmente em beta.

## Configuracao da CLI

```bash
openclaw onboard --auth-choice opencode-zen
# or non-interactive
openclaw onboard --opencode-zen-api-key "$OPENCODE_API_KEY"
```

## Trecho de configuracao

```json5
{
  env: { OPENCODE_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "opencode/claude-opus-4-6" } } },
}
```

## Notas

- `OPENCODE_ZEN_API_KEY` tambem e suportado.
- Voce faz login no Zen, adiciona os detalhes de faturamento e copia sua chave de API.
- O OpenCode Zen cobra por solicitacao; verifique o painel do OpenCode para mais detalhes.
