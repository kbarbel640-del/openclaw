---
summary: "Validacao estrita de configuracao + migracoes apenas pelo doctor"
read_when:
  - Ao projetar ou implementar comportamento de validacao de configuracao
  - Ao trabalhar em migracoes de configuracao ou fluxos do doctor
  - Ao lidar com esquemas de configuracao de plugins ou bloqueio de carregamento de plugins
title: "Validacao Estrita de Configuracao"
x-i18n:
  source_path: refactor/strict-config.md
  source_hash: 5bc7174a67d2234e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:15Z
---

# Validacao estrita de configuracao (migracoes apenas pelo doctor)

## Objetivos

- **Rejeitar chaves de configuracao desconhecidas em todos os lugares** (raiz + aninhadas).
- **Rejeitar configuracao de plugin sem um esquema**; nao carregar esse plugin.
- **Remover auto-migracao legada no carregamento**; migracoes rodam apenas via doctor.
- **Executar o doctor automaticamente (dry-run) na inicializacao**; se invalida, bloquear comandos nao diagnosticos.

## Nao objetivos

- Compatibilidade retroativa no carregamento (chaves legadas nao sao auto-migradas).
- Remocao silenciosa de chaves nao reconhecidas.

## Regras de validacao estrita

- A configuracao deve corresponder exatamente ao esquema em todos os niveis.
- Chaves desconhecidas sao erros de validacao (sem passthrough na raiz ou aninhado).
- `plugins.entries.<id>.config` deve ser validado pelo esquema do plugin.
  - Se um plugin nao tiver um esquema, **rejeitar o carregamento do plugin** e exibir um erro claro.
- Chaves `channels.<id>` desconhecidas sao erros, a menos que um manifesto de plugin declare o id do canal.
- Manifestos de plugin (`openclaw.plugin.json`) sao obrigatorios para todos os plugins.

## Aplicacao de esquemas de plugin

- Cada plugin fornece um JSON Schema estrito para sua configuracao (inline no manifesto).
- Fluxo de carregamento do plugin:
  1. Resolver manifesto do plugin + esquema (`openclaw.plugin.json`).
  2. Validar a configuracao contra o esquema.
  3. Se o esquema estiver ausente ou a configuracao for invalida: bloquear o carregamento do plugin e registrar o erro.
- A mensagem de erro inclui:
  - Id do plugin
  - Motivo (esquema ausente / configuracao invalida)
  - Caminho(s) que falharam na validacao
- Plugins desativados mantem sua configuracao, mas o Doctor + logs exibem um aviso.

## Fluxo do Doctor

- O Doctor roda **toda vez** que a configuracao e carregada (dry-run por padrao).
- Se a configuracao for invalida:
  - Imprimir um resumo + erros acionaveis.
  - Instruir: `openclaw doctor --fix`.
- `openclaw doctor --fix`:
  - Aplica migracoes.
  - Remove chaves desconhecidas.
  - Grava a configuracao atualizada.

## Bloqueio de comandos (quando a configuracao e invalida)

Permitidos (apenas diagnosticos):

- `openclaw doctor`
- `openclaw logs`
- `openclaw health`
- `openclaw help`
- `openclaw status`
- `openclaw gateway status`

Todo o resto deve falhar de forma definitiva com: “Configuracao invalida. Execute `openclaw doctor --fix`.”

## Formato de UX de erro

- Um unico cabecalho de resumo.
- Secoes agrupadas:
  - Chaves desconhecidas (caminhos completos)
  - Chaves legadas / migracoes necessarias
  - Falhas no carregamento de plugins (id do plugin + motivo + caminho)

## Pontos de implementacao

- `src/config/zod-schema.ts`: remover passthrough na raiz; objetos estritos em todos os lugares.
- `src/config/zod-schema.providers.ts`: garantir esquemas de canal estritos.
- `src/config/validation.ts`: falhar em chaves desconhecidas; nao aplicar migracoes legadas.
- `src/config/io.ts`: remover auto-migracoes legadas; sempre executar doctor em dry-run.
- `src/config/legacy*.ts`: mover o uso apenas para o doctor.
- `src/plugins/*`: adicionar registro de esquemas + bloqueio.
- Bloqueio de comandos da CLI em `src/cli`.

## Testes

- Rejeicao de chaves desconhecidas (raiz + aninhadas).
- Plugin sem esquema → carregamento do plugin bloqueado com erro claro.
- Configuracao invalida → inicializacao do Gateway bloqueada, exceto comandos diagnosticos.
- Doctor em dry-run automatico; `doctor --fix` grava a configuracao corrigida.
