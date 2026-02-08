---
summary: "Manifesto de plugin + requisitos de esquema JSON (validacao estrita de configuracao)"
read_when:
  - Voce esta criando um plugin do OpenClaw
  - Voce precisa entregar um esquema de configuracao de plugin ou depurar erros de validacao de plugin
title: "Manifesto de Plugin"
x-i18n:
  source_path: plugins/manifest.md
  source_hash: 47b3e33c915f47bd
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:04Z
---

# Manifesto de plugin (openclaw.plugin.json)

Todo plugin **deve** incluir um arquivo `openclaw.plugin.json` na **raiz do plugin**.
O OpenClaw usa este manifesto para validar a configuracao **sem executar o codigo do plugin**.
Manifestos ausentes ou invalidos sao tratados como erros de plugin e bloqueiam a validacao de configuracao.

Veja o guia completo do sistema de plugins: [Plugins](/plugin).

## Campos obrigatorios

```json
{
  "id": "voice-call",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

Chaves obrigatorias:

- `id` (string): id canonico do plugin.
- `configSchema` (object): Esquema JSON para a configuracao do plugin (inline).

Chaves opcionais:

- `kind` (string): tipo do plugin (exemplo: `"memory"`).
- `channels` (array): ids de canais registrados por este plugin (exemplo: `["matrix"]`).
- `providers` (array): ids de provedores registrados por este plugin.
- `skills` (array): diretorios de Skills a carregar (relativos a raiz do plugin).
- `name` (string): nome de exibicao do plugin.
- `description` (string): resumo curto do plugin.
- `uiHints` (object): rotulos/placeholders/flags de sensibilidade de campos de configuracao para renderizacao de UI.
- `version` (string): versao do plugin (informativo).

## Requisitos de Esquema JSON

- **Todo plugin deve incluir um Esquema JSON**, mesmo que nao aceite configuracao.
- Um esquema vazio e aceitavel (por exemplo, `{ "type": "object", "additionalProperties": false }`).
- Os esquemas sao validados no momento de leitura/escrita da configuracao, nao em tempo de execucao.

## Comportamento de validacao

- Chaves `channels.*` desconhecidas sao **erros**, a menos que o id do canal seja declarado por
  um manifesto de plugin.
- `plugins.entries.<id>`, `plugins.allow`, `plugins.deny` e `plugins.slots.*`
  devem referenciar ids de plugins **descobrivels**. Ids desconhecidos sao **erros**.
- Se um plugin estiver instalado, mas tiver um manifesto ou esquema quebrado ou ausente,
  a validacao falha e o Doctor relata o erro do plugin.
- Se a configuracao do plugin existir, mas o plugin estiver **desabilitado**, a configuracao e mantida e
  um **aviso** e exibido no Doctor + logs.

## Observacoes

- O manifesto e **obrigatorio para todos os plugins**, incluindo carregamentos locais do sistema de arquivos.
- O runtime ainda carrega o modulo do plugin separadamente; o manifesto e apenas para
  descoberta + validacao.
- Se o seu plugin depender de modulos nativos, documente as etapas de build e quaisquer
  requisitos de allowlist do gerenciador de pacotes (por exemplo, pnpm `allow-build-scripts`
  - `pnpm rebuild <package>`).
