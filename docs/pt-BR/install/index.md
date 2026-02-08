---
summary: "Instale o OpenClaw (instalador recomendado, instalacao global ou a partir do codigo-fonte)"
read_when:
  - Instalando o OpenClaw
  - Voce quer instalar a partir do GitHub
title: "Visao geral da instalacao"
x-i18n:
  source_path: install/index.md
  source_hash: 228056bb0a2176b8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:37Z
---

# Visao geral da instalacao

Use o instalador, a menos que voce tenha um motivo para nao usar. Ele configura a CLI e executa a integracao inicial.

## Instalacao rapida (recomendado)

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

Windows (PowerShell):

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex
```

Proximo passo (se voce pulou a integracao inicial):

```bash
openclaw onboard --install-daemon
```

## Requisitos do sistema

- **Node >=22**
- macOS, Linux ou Windows via WSL2
- `pnpm` apenas se voce compilar a partir do codigo-fonte

## Escolha seu caminho de instalacao

### 1) Script do instalador (recomendado)

Instala `openclaw` globalmente via npm e executa a integracao inicial.

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

Flags do instalador:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --help
```

Detalhes: [Internos do instalador](/install/installer).

Nao interativo (pular integracao inicial):

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard
```

### 2) Instalacao global (manual)

Se voce ja tem Node:

```bash
npm install -g openclaw@latest
```

Se voce tem libvips instalado globalmente (comum no macOS via Homebrew) e `sharp` falhar ao instalar, force binarios precompilados:

```bash
SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install -g openclaw@latest
```

Se voce vir `sharp: Please add node-gyp to your dependencies`, instale as ferramentas de build (macOS: Xcode CLT + `npm install -g node-gyp`) ou use a solucao alternativa `SHARP_IGNORE_GLOBAL_LIBVIPS=1` acima para pular a build nativa.

Ou com pnpm:

```bash
pnpm add -g openclaw@latest
pnpm approve-builds -g                # approve openclaw, node-llama-cpp, sharp, etc.
```

O pnpm exige aprovacao explicita para pacotes com scripts de build. Depois que a primeira instalacao mostrar o aviso "Ignored build scripts", execute `pnpm approve-builds -g` e selecione os pacotes listados.

Em seguida:

```bash
openclaw onboard --install-daemon
```

### 3) A partir do codigo-fonte (contribuidores/dev)

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pnpm install
pnpm ui:build # auto-installs UI deps on first run
pnpm build
openclaw onboard --install-daemon
```

Dica: se voce ainda nao tem uma instalacao global, execute comandos do repo via `pnpm openclaw ...`.

Para fluxos de desenvolvimento mais profundos, veja [Configuracao](/start/setup).

### 4) Outras opcoes de instalacao

- Docker: [Docker](/install/docker)
- Nix: [Nix](/install/nix)
- Ansible: [Ansible](/install/ansible)
- Bun (somente CLI): [Bun](/install/bun)

## Depois da instalacao

- Executar integracao inicial: `openclaw onboard --install-daemon`
- Verificacao rapida: `openclaw doctor`
- Verificar a saude do Gateway: `openclaw status` + `openclaw health`
- Abrir o painel: `openclaw dashboard`

## Metodo de instalacao: npm vs git (instalador)

O instalador oferece suporte a dois metodos:

- `npm` (padrao): `npm install -g openclaw@latest`
- `git`: clonar/compilar a partir do GitHub e executar a partir de um checkout do codigo-fonte

### Flags da CLI

```bash
# Explicit npm
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method npm

# Install from GitHub (source checkout)
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git
```

Flags comuns:

- `--install-method npm|git`
- `--git-dir <path>` (padrao: `~/openclaw`)
- `--no-git-update` (pular `git pull` ao usar um checkout existente)
- `--no-prompt` (desativar prompts; necessario em CI/automacao)
- `--dry-run` (imprimir o que aconteceria; nao fazer alteracoes)
- `--no-onboard` (pular integracao inicial)

### Variaveis de ambiente

Variaveis de ambiente equivalentes (uteis para automacao):

- `OPENCLAW_INSTALL_METHOD=git|npm`
- `OPENCLAW_GIT_DIR=...`
- `OPENCLAW_GIT_UPDATE=0|1`
- `OPENCLAW_NO_PROMPT=1`
- `OPENCLAW_DRY_RUN=1`
- `OPENCLAW_NO_ONBOARD=1`
- `SHARP_IGNORE_GLOBAL_LIBVIPS=0|1` (padrao: `1`; evita `sharp` compilar contra a libvips do sistema)

## Solucao de problemas: `openclaw` nao encontrado (PATH)

Diagnostico rapido:

```bash
node -v
npm -v
npm prefix -g
echo "$PATH"
```

Se `$(npm prefix -g)/bin` (macOS/Linux) ou `$(npm prefix -g)` (Windows) **nao** estiver presente dentro de `echo "$PATH"`, seu shell nao consegue encontrar binarios globais do npm (incluindo `openclaw`).

Correcao: adicione-o ao arquivo de inicializacao do seu shell (zsh: `~/.zshrc`, bash: `~/.bashrc`):

```bash
# macOS / Linux
export PATH="$(npm prefix -g)/bin:$PATH"
```

No Windows, adicione a saida de `npm prefix -g` ao seu PATH.

Em seguida, abra um novo terminal (ou `rehash` no zsh / `hash -r` no bash).

## Atualizar / desinstalar

- Atualizacoes: [Atualizando](/install/updating)
- Migrar para uma nova maquina: [Migrando](/install/migrating)
- Desinstalar: [Desinstalar](/install/uninstall)
