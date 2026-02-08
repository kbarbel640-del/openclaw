---
summary: "Flags de diagnostico para logs de depuracao direcionados"
read_when:
  - Voce precisa de logs de depuracao direcionados sem elevar os niveis globais de log
  - Voce precisa capturar logs especificos de subsistemas para suporte
title: "Flags de Diagnostico"
x-i18n:
  source_path: diagnostics/flags.md
  source_hash: daf0eca0e6bd1cbc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:07Z
---

# Flags de Diagnostico

As flags de diagnostico permitem ativar logs de depuracao direcionados sem ligar logs verbosos em todo lugar. As flags sao opcionais e nao tem efeito a menos que um subsistema as verifique.

## Como funciona

- As flags sao strings (nao diferenciam maiusculas de minusculas).
- Voce pode ativar flags na configuracao ou por meio de uma substituicao por variavel de ambiente.
- Curingas sao suportados:
  - `telegram.*` corresponde a `telegram.http`
  - `*` ativa todas as flags

## Ativar via configuracao

```json
{
  "diagnostics": {
    "flags": ["telegram.http"]
  }
}
```

Multiplas flags:

```json
{
  "diagnostics": {
    "flags": ["telegram.http", "gateway.*"]
  }
}
```

Reinicie o Gateway apos alterar as flags.

## Substituicao por env (pontual)

```bash
OPENCLAW_DIAGNOSTICS=telegram.http,telegram.payload
```

Desativar todas as flags:

```bash
OPENCLAW_DIAGNOSTICS=0
```

## Para onde os logs vao

As flags emitem logs no arquivo padrao de diagnostico. Por padrao:

```
/tmp/openclaw/openclaw-YYYY-MM-DD.log
```

Se voce definir `logging.file`, use esse caminho em vez disso. Os logs sao JSONL (um objeto JSON por linha). A redacao ainda se aplica com base em `logging.redactSensitive`.

## Extrair logs

Escolha o arquivo de log mais recente:

```bash
ls -t /tmp/openclaw/openclaw-*.log | head -n 1
```

Filtre por diagnosticos HTTP do Telegram:

```bash
rg "telegram http error" /tmp/openclaw/openclaw-*.log
```

Ou acompanhe em tempo real enquanto reproduz:

```bash
tail -f /tmp/openclaw/openclaw-$(date +%F).log | rg "telegram http error"
```

Para Gateways remotos, voce tambem pode usar `openclaw logs --follow` (veja [/cli/logs](/cli/logs)).

## Observacoes

- Se `logging.level` estiver definido acima de `warn`, esses logs podem ser suprimidos. O padrao `info` e suficiente.
- As flags sao seguras para deixar ativadas; elas apenas afetam o volume de logs do subsistema especifico.
- Use [/logging](/logging) para alterar destinos de log, niveis e redacao.
