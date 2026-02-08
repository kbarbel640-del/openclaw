---
summary: "Onde o OpenClaw carrega variaveis de ambiente e a ordem de precedencia"
read_when:
  - Voce precisa saber quais variaveis de ambiente sao carregadas e em que ordem
  - Voce esta depurando chaves de API ausentes no Gateway
  - Voce esta documentando autenticacao de provedores ou ambientes de implantacao
title: "Variaveis de ambiente"
x-i18n:
  source_path: help/environment.md
  source_hash: b49ae50e5d306612
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:13Z
---

# Variaveis de ambiente

O OpenClaw carrega variaveis de ambiente de varias fontes. A regra é **nunca substituir valores existentes**.

## Precedencia (mais alta → mais baixa)

1. **Ambiente do processo** (o que o processo do Gateway ja recebe do shell/daemon pai).
2. **`.env` no diretorio de trabalho atual** (padrao do dotenv; nao substitui).
3. **`.env` global** em `~/.openclaw/.env` (tambem conhecido como `$OPENCLAW_STATE_DIR/.env`; nao substitui).
4. **Bloco de configuracao `env`** em `~/.openclaw/openclaw.json` (aplicado apenas se estiver ausente).
5. **Importacao opcional do shell de login** (`env.shellEnv.enabled` ou `OPENCLAW_LOAD_SHELL_ENV=1`), aplicada apenas para chaves esperadas ausentes.

Se o arquivo de configuracao estiver totalmente ausente, a etapa 4 é ignorada; a importacao do shell ainda é executada se estiver habilitada.

## Bloco de configuracao `env`

Duas formas equivalentes de definir variaveis de ambiente inline (ambas nao substituem):

```json5
{
  env: {
    OPENROUTER_API_KEY: "sk-or-...",
    vars: {
      GROQ_API_KEY: "gsk-...",
    },
  },
}
```

## Importacao de variaveis de ambiente do shell

`env.shellEnv` executa seu shell de login e importa apenas chaves esperadas **ausentes**:

```json5
{
  env: {
    shellEnv: {
      enabled: true,
      timeoutMs: 15000,
    },
  },
}
```

Equivalentes em variaveis de ambiente:

- `OPENCLAW_LOAD_SHELL_ENV=1`
- `OPENCLAW_SHELL_ENV_TIMEOUT_MS=15000`

## Substituicao de variaveis de ambiente na configuracao

Voce pode referenciar variaveis de ambiente diretamente em valores de string da configuracao usando a sintaxe `${VAR_NAME}`:

```json5
{
  models: {
    providers: {
      "vercel-gateway": {
        apiKey: "${VERCEL_GATEWAY_API_KEY}",
      },
    },
  },
}
```

Veja [Configuracao: Substituicao de variaveis de ambiente](/gateway/configuration#env-var-substitution-in-config) para mais detalhes.

## Relacionado

- [Configuracao do Gateway](/gateway/configuration)
- [Perguntas frequentes: variaveis de ambiente e carregamento de .env](/help/faq#env-vars-and-env-loading)
- [Visao geral de modelos](/concepts/models)
