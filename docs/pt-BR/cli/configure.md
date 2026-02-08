---
summary: "Referencia da CLI para `openclaw configure` (prompts interativos de configuracao)"
read_when:
  - Voce quer ajustar credenciais, dispositivos ou padroes do agente de forma interativa
title: "configurar"
x-i18n:
  source_path: cli/configure.md
  source_hash: 9cb2bb5237b02b3a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:36Z
---

# `openclaw configure`

Prompt interativo para configurar credenciais, dispositivos e padroes do agente.

Nota: A secao **Model** agora inclui uma selecao multipla para a allowlist `agents.defaults.models` (o que aparece em `/model` e no seletor de modelo).

Dica: `openclaw config` sem um subcomando abre o mesmo assistente. Use
`openclaw config get|set|unset` para edicoes nao interativas.

Relacionado:

- Referencia de configuracao do Gateway: [Configuration](/gateway/configuration)
- CLI de configuracao: [Config](/cli/config)

Observacoes:

- Escolher onde o Gateway roda sempre atualiza `gateway.mode`. Voce pode selecionar "Continue" sem outras secoes se isso for tudo de que precisa.
- Servicos orientados a canais (Slack/Discord/Matrix/Microsoft Teams) solicitam allowlists de canal/sala durante a configuracao. Voce pode inserir nomes ou IDs; o assistente resolve nomes para IDs quando possivel.

## Exemplos

```bash
openclaw configure
openclaw configure --section models --section channels
```
