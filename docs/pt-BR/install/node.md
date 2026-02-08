---
title: "Node.js + npm (sanidade do PATH)"
summary: "Verificacao de sanidade do Node.js + npm: versoes, PATH e instalacoes globais"
read_when:
  - "Voce instalou o OpenClaw, mas `openclaw` aparece como “command not found”"
  - "Voce esta configurando Node.js/npm em uma maquina nova"
  - "npm install -g ... falha com erros de permissao ou de PATH"
x-i18n:
  source_path: install/node.md
  source_hash: 9f6d83be362e3e14
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:38Z
---

# Node.js + npm (sanidade do PATH)

A linha de base de runtime do OpenClaw é **Node 22+**.

Se voce consegue executar `npm install -g openclaw@latest`, mas depois ve `openclaw: command not found`, quase sempre é um problema de **PATH**: o diretorio onde o npm coloca binarios globais nao esta no PATH do seu shell.

## Diagnostico rapido

Execute:

```bash
node -v
npm -v
npm prefix -g
echo "$PATH"
```

Se `$(npm prefix -g)/bin` (macOS/Linux) ou `$(npm prefix -g)` (Windows) **nao** estiver presente dentro de `echo "$PATH"`, seu shell nao consegue encontrar binarios globais do npm (incluindo `openclaw`).

## Correcao: colocar o diretorio bin global do npm no PATH

1. Encontre o prefixo global do npm:

```bash
npm prefix -g
```

2. Adicione o diretorio bin global do npm ao arquivo de inicializacao do seu shell:

- zsh: `~/.zshrc`
- bash: `~/.bashrc`

Exemplo (substitua o caminho pelo resultado de `npm prefix -g`):

```bash
# macOS / Linux
export PATH="/path/from/npm/prefix/bin:$PATH"
```

Depois, abra um **novo terminal** (ou execute `rehash` no zsh / `hash -r` no bash).

No Windows, adicione a saida de `npm prefix -g` ao seu PATH.

## Correcao: evitar `sudo npm install -g` / erros de permissao (Linux)

Se `npm install -g ...` falhar com `EACCES`, mude o prefixo global do npm para um diretorio gravavel pelo usuario:

```bash
mkdir -p "$HOME/.npm-global"
npm config set prefix "$HOME/.npm-global"
export PATH="$HOME/.npm-global/bin:$PATH"
```

Persista a linha `export PATH=...` no arquivo de inicializacao do seu shell.

## Opcoes recomendadas de instalacao do Node

Voce tera menos surpresas se o Node/npm forem instalados de uma forma que:

- mantenha o Node atualizado (22+)
- torne o diretorio bin global do npm estavel e presente no PATH em novos shells

Opcoes comuns:

- macOS: Homebrew (`brew install node`) ou um gerenciador de versoes
- Linux: seu gerenciador de versoes preferido, ou uma instalacao suportada pela distribuicao que forneca Node 22+
- Windows: instalador oficial do Node, `winget`, ou um gerenciador de versoes do Node para Windows

Se voce usar um gerenciador de versoes (nvm/fnm/asdf/etc), garanta que ele esteja inicializado no shell que voce usa no dia a dia (zsh vs bash), para que o PATH que ele define esteja presente quando voce executar instaladores.
