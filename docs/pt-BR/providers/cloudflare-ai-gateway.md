---
title: "Cloudflare AI Gateway"
summary: "Configuracao do Cloudflare AI Gateway (auth + selecao de modelo)"
read_when:
  - Voce quer usar o Cloudflare AI Gateway com o OpenClaw
  - Voce precisa do ID da conta, do ID do gateway ou da variavel de ambiente da chave de API
x-i18n:
  source_path: providers/cloudflare-ai-gateway.md
  source_hash: db77652c37652ca2
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:00Z
---

# Cloudflare AI Gateway

O Cloudflare AI Gateway fica na frente das APIs de provedores e permite adicionar analiticos, cache e controles. Para Anthropic, o OpenClaw usa a Anthropic Messages API por meio do endpoint do seu Gateway.

- Provedor: `cloudflare-ai-gateway`
- URL base: `https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_id>/anthropic`
- Modelo padrao: `cloudflare-ai-gateway/claude-sonnet-4-5`
- Chave de API: `CLOUDFLARE_AI_GATEWAY_API_KEY` (sua chave de API do provedor para requisicoes por meio do Gateway)

Para modelos da Anthropic, use sua chave de API da Anthropic.

## Inicio rapido

1. Defina a chave de API do provedor e os detalhes do Gateway:

```bash
openclaw onboard --auth-choice cloudflare-ai-gateway-api-key
```

2. Defina um modelo padrao:

```json5
{
  agents: {
    defaults: {
      model: { primary: "cloudflare-ai-gateway/claude-sonnet-4-5" },
    },
  },
}
```

## Exemplo nao interativo

```bash
openclaw onboard --non-interactive \
  --mode local \
  --auth-choice cloudflare-ai-gateway-api-key \
  --cloudflare-ai-gateway-account-id "your-account-id" \
  --cloudflare-ai-gateway-gateway-id "your-gateway-id" \
  --cloudflare-ai-gateway-api-key "$CLOUDFLARE_AI_GATEWAY_API_KEY"
```

## Gateways autenticados

Se voce habilitou a autenticacao do Gateway no Cloudflare, adicione o cabecalho `cf-aig-authorization` (isso e alem da sua chave de API do provedor).

```json5
{
  models: {
    providers: {
      "cloudflare-ai-gateway": {
        headers: {
          "cf-aig-authorization": "Bearer <cloudflare-ai-gateway-token>",
        },
      },
    },
  },
}
```

## Nota de ambiente

Se o Gateway roda como um daemon (launchd/systemd), certifique-se de que `CLOUDFLARE_AI_GATEWAY_API_KEY` esteja disponivel para esse processo (por exemplo, em `~/.openclaw/.env` ou via `env.shellEnv`).
