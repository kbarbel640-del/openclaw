---
title: "Vercel AI Gateway"
summary: "Configuracao do Vercel AI Gateway (autenticacao + selecao de modelo)"
read_when:
  - Voce quer usar o Vercel AI Gateway com o OpenClaw
  - Voce precisa da variavel de ambiente da chave de API ou da opcao de autenticacao via CLI
x-i18n:
  source_path: providers/vercel-ai-gateway.md
  source_hash: 2bf1687c1152c6e1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:09Z
---

# Vercel AI Gateway

O [Vercel AI Gateway](https://vercel.com/ai-gateway) fornece uma API unificada para acessar centenas de modelos por meio de um unico endpoint.

- Provedor: `vercel-ai-gateway`
- Autenticacao: `AI_GATEWAY_API_KEY`
- API: compativel com Anthropic Messages

## Inicio rapido

1. Defina a chave de API (recomendado: armazena-la para o Gateway):

```bash
openclaw onboard --auth-choice ai-gateway-api-key
```

2. Defina um modelo padrao:

```json5
{
  agents: {
    defaults: {
      model: { primary: "vercel-ai-gateway/anthropic/claude-opus-4.6" },
    },
  },
}
```

## Exemplo nao interativo

```bash
openclaw onboard --non-interactive \
  --mode local \
  --auth-choice ai-gateway-api-key \
  --ai-gateway-api-key "$AI_GATEWAY_API_KEY"
```

## Observacao sobre o ambiente

Se o Gateway for executado como um daemon (launchd/systemd), certifique-se de que `AI_GATEWAY_API_KEY`
esteja disponivel para esse processo (por exemplo, em `~/.openclaw/.env` ou via
`env.shellEnv`).
