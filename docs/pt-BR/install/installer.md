---
summary: "Como os scripts do instalador funcionam (install.sh + install-cli.sh), flags e automação"
read_when:
  - Você quer entender `openclaw.ai/install.sh`
  - Você quer automatizar instalações (CI / headless)
  - Você quer instalar a partir de um checkout do GitHub
title: "Detalhes internos do instalador"
x-i18n:
  source_path: install/installer.md
  source_hash: 9e0a19ecb5da0a39
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:40Z
---

# Detalhes internos do instalador

O OpenClaw disponibiliza dois scripts de instalação (servidos a partir de `openclaw.ai`):

- `https://openclaw.ai/install.sh` — instalador “recomendado” (instalação global via npm por padrão; também pode instalar a partir de um checkout do GitHub)
- `https://openclaw.ai/install-cli.sh` — instalador de CLI amigável a não-root (instala em um prefixo com seu próprio Node)
- `https://openclaw.ai/install.ps1` — instalador do Windows PowerShell (npm por padrão; instalação via git opcional)

Para ver as flags/comportamento atuais, execute:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --help
```

Ajuda no Windows (PowerShell):

```powershell
& ([scriptblock]::Create((iwr -useb https://openclaw.ai/install.ps1))) -?
```

Se o instalador concluir, mas `openclaw` não for encontrado em um novo terminal, geralmente é um problema de PATH do Node/npm. Veja: [Install](/install#nodejs--npm-path-sanity).

## install.sh (recomendado)

O que ele faz (visão geral):

- Detecta o SO (macOS / Linux / WSL).
- Garante Node.js **22+** (macOS via Homebrew; Linux via NodeSource).
- Escolhe o método de instalação:
  - `npm` (padrão): `npm install -g openclaw@latest`
  - `git`: clona/compila um checkout de código-fonte e instala um script wrapper
- No Linux: evita erros de permissão do npm global alternando o prefixo do npm para `~/.npm-global` quando necessário.
- Ao atualizar uma instalação existente: executa `openclaw doctor --non-interactive` (best effort).
- Para instalações via git: executa `openclaw doctor --non-interactive` após instalar/atualizar (best effort).
- Mitiga armadilhas de instalação nativa do `sharp` ao usar `SHARP_IGNORE_GLOBAL_LIBVIPS=1` por padrão (evita compilar contra o libvips do sistema).

Se você _quiser_ que o `sharp` faça link contra um libvips instalado globalmente (ou se estiver depurando), defina:

```bash
SHARP_IGNORE_GLOBAL_LIBVIPS=0 curl -fsSL https://openclaw.ai/install.sh | bash
```

### Descoberta / prompt de “git install”

Se você executar o instalador enquanto **já estiver dentro de um checkout de código-fonte do OpenClaw** (detectado via `package.json` + `pnpm-workspace.yaml`), ele pergunta:

- atualizar e usar este checkout (`git`)
- ou migrar para a instalação global via npm (`npm`)

Em contextos não interativos (sem TTY / `--no-prompt`), você deve passar `--install-method git|npm` (ou definir `OPENCLAW_INSTALL_METHOD`), caso contrário o script sai com o código `2`.

### Por que o Git é necessário

O Git é necessário para o caminho `--install-method git` (clone / pull).

Para instalações `npm`, o Git _geralmente_ não é necessário, mas alguns ambientes ainda acabam precisando dele (por exemplo, quando um pacote ou dependência é obtido via uma URL git). Atualmente, o instalador garante que o Git esteja presente para evitar surpresas `spawn git ENOENT` em distros recém-instaladas.

### Por que o npm atinge `EACCES` em Linux recém-instalado

Em algumas configurações de Linux (especialmente após instalar o Node via o gerenciador de pacotes do sistema ou NodeSource), o prefixo global do npm aponta para um local pertencente ao root. Assim, `npm install -g ...` falha com erros de permissão `EACCES` / `mkdir`.

O `install.sh` mitiga isso alternando o prefixo para:

- `~/.npm-global` (e adicionando-o ao `PATH` em `~/.bashrc` / `~/.zshrc` quando presente)

## install-cli.sh (instalador de CLI sem root)

Este script instala `openclaw` em um prefixo (padrão: `~/.openclaw`) e também instala um runtime do Node dedicado sob esse prefixo, para funcionar em máquinas onde você não quer mexer no Node/npm do sistema.

Ajuda:

```bash
curl -fsSL https://openclaw.ai/install-cli.sh | bash -s -- --help
```

## install.ps1 (Windows PowerShell)

O que ele faz (visão geral):

- Garante Node.js **22+** (winget/Chocolatey/Scoop ou manual).
- Escolhe o método de instalação:
  - `npm` (padrão): `npm install -g openclaw@latest`
  - `git`: clona/compila um checkout de código-fonte e instala um script wrapper
- Executa `openclaw doctor --non-interactive` em atualizações e instalações via git (best effort).

Exemplos:

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex
```

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex -InstallMethod git
```

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex -InstallMethod git -GitDir "C:\\openclaw"
```

Variáveis de ambiente:

- `OPENCLAW_INSTALL_METHOD=git|npm`
- `OPENCLAW_GIT_DIR=...`

Requisito de Git:

Se você escolher `-InstallMethod git` e o Git estiver ausente, o instalador imprimirá o
link do Git for Windows (`https://git-scm.com/download/win`) e sairá.

Problemas comuns no Windows:

- **npm error spawn git / ENOENT**: instale o Git for Windows e reabra o PowerShell, depois execute o instalador novamente.
- **"openclaw" não é reconhecido**: a pasta de binários globais do npm não está no PATH. A maioria dos sistemas usa
  `%AppData%\\npm`. Você também pode executar `npm config get prefix` e adicionar `\\bin` ao PATH, depois reabra o PowerShell.
