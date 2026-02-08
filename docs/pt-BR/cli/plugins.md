---
summary: "Referencia da CLI para `openclaw plugins` (listar, instalar, habilitar/desabilitar, doctor)"
read_when:
  - Voce quer instalar ou gerenciar plugins do Gateway em processo
  - Voce quer depurar falhas de carregamento de plugins
title: "plugins"
x-i18n:
  source_path: cli/plugins.md
  source_hash: c6bf76b1e766b912
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:45Z
---

# `openclaw plugins`

Gerencie plugins/extensoes do Gateway (carregados em processo).

Relacionado:

- Sistema de plugins: [Plugins](/plugin)
- Manifesto + esquema de plugin: [Plugin manifest](/plugins/manifest)
- Endurecimento de seguranca: [Security](/gateway/security)

## Commands

```bash
openclaw plugins list
openclaw plugins info <id>
openclaw plugins enable <id>
openclaw plugins disable <id>
openclaw plugins doctor
openclaw plugins update <id>
openclaw plugins update --all
```

Plugins incluidos sao distribuidos com o OpenClaw, mas iniciam desativados. Use `plugins enable` para
ativa-los.

Todos os plugins devem incluir um arquivo `openclaw.plugin.json` com um JSON Schema inline
(`configSchema`, mesmo que vazio). Manifestos ou esquemas ausentes/invalidos impedem
o carregamento do plugin e fazem a validacao de configuracao falhar.

### Instalar

```bash
openclaw plugins install <path-or-spec>
```

Nota de seguranca: trate a instalacao de plugins como a execucao de codigo. Prefira versoes fixadas.

Arquivos suportados: `.zip`, `.tgz`, `.tar.gz`, `.tar`.

Use `--link` para evitar copiar um diretorio local (adiciona a `plugins.load.paths`):

```bash
openclaw plugins install -l ./my-plugin
```

### Atualizar

```bash
openclaw plugins update <id>
openclaw plugins update --all
openclaw plugins update <id> --dry-run
```

As atualizacoes se aplicam apenas a plugins instalados a partir do npm (rastreados em `plugins.installs`).
