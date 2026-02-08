---
summary: "Use a OpenAI via chaves de API ou assinatura do Codex no OpenClaw"
read_when:
  - Voce quer usar modelos da OpenAI no OpenClaw
  - Voce quer autenticacao por assinatura do Codex em vez de chaves de API
title: "OpenAI"
x-i18n:
  source_path: providers/openai.md
  source_hash: 13d8fd7f1f935b0a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:05Z
---

# OpenAI

A OpenAI fornece APIs para desenvolvedores para modelos GPT. O Codex oferece **login com ChatGPT** para acesso por assinatura
ou **login com chave de API** para acesso baseado em uso. O Codex cloud exige login com ChatGPT.

## Opcao A: Chave de API da OpenAI (OpenAI Platform)

**Melhor para:** acesso direto a API e cobranca baseada em uso.
Obtenha sua chave de API no painel da OpenAI.

### Configuracao via CLI

```bash
openclaw onboard --auth-choice openai-api-key
# or non-interactive
openclaw onboard --openai-api-key "$OPENAI_API_KEY"
```

### Trecho de configuracao

```json5
{
  env: { OPENAI_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "openai/gpt-5.1-codex" } } },
}
```

## Opcao B: Assinatura OpenAI Code (Codex)

**Melhor para:** usar acesso por assinatura do ChatGPT/Codex em vez de uma chave de API.
O Codex cloud exige login com ChatGPT, enquanto a CLI do Codex suporta login com ChatGPT ou chave de API.

### Configuracao via CLI

```bash
# Run Codex OAuth in the wizard
openclaw onboard --auth-choice openai-codex

# Or run OAuth directly
openclaw models auth login --provider openai-codex
```

### Trecho de configuracao

```json5
{
  agents: { defaults: { model: { primary: "openai-codex/gpt-5.3-codex" } } },
}
```

## Observacoes

- Referencias de modelos sempre usam `provider/model` (veja [/concepts/models](/concepts/models)).
- Detalhes de autenticacao + regras de reutilizacao estao em [/concepts/oauth](/concepts/oauth).
