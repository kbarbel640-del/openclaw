---
summary: "Configuracao e integracao inicial opcionais baseadas em Docker para o OpenClaw"
read_when:
  - Voce quer um gateway em container em vez de instalacoes locais
  - Voce esta validando o fluxo com Docker
title: "Docker"
x-i18n:
  source_path: install/docker.md
  source_hash: 021ec5aa78e1a6eb
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:00Z
---

# Docker (opcional)

Docker é **opcional**. Use apenas se voce quiser um gateway em container ou validar o fluxo com Docker.

## O Docker é ideal para mim?

- **Sim**: voce quer um ambiente de gateway isolado e descartável ou rodar o OpenClaw em um host sem instalacoes locais.
- **Nao**: voce esta rodando na sua propria maquina e quer apenas o loop de desenvolvimento mais rapido. Use o fluxo de instalacao normal.
- **Nota sobre sandboxing**: o sandboxing de agente tambem usa Docker, mas **nao** exige que o gateway completo rode em Docker. Veja [Sandboxing](/gateway/sandboxing).

Este guia cobre:

- Gateway em container (OpenClaw completo em Docker)
- Sandbox de Agente por sessao (gateway no host + ferramentas de agente isoladas em Docker)

Detalhes de sandboxing: [Sandboxing](/gateway/sandboxing)

## Requisitos

- Docker Desktop (ou Docker Engine) + Docker Compose v2
- Espaco em disco suficiente para imagens + logs

## Gateway em container (Docker Compose)

### Inicio rapido (recomendado)

A partir da raiz do repo:

```bash
./docker-setup.sh
```

Este script:

- constroi a imagem do gateway
- executa o assistente de integracao inicial
- imprime dicas opcionais de configuracao de provedores
- inicia o gateway via Docker Compose
- gera um token do gateway e o grava em `.env`

Variaveis de ambiente opcionais:

- `OPENCLAW_DOCKER_APT_PACKAGES` — instala pacotes apt extras durante o build
- `OPENCLAW_EXTRA_MOUNTS` — adiciona bind mounts extras do host
- `OPENCLAW_HOME_VOLUME` — persiste `/home/node` em um volume nomeado

Depois que finalizar:

- Abra `http://127.0.0.1:18789/` no seu navegador.
- Cole o token na UI de Controle (Configuracoes → token).
- Precisa do URL novamente? Execute `docker compose run --rm openclaw-cli dashboard --no-open`.

Ele grava configuracao/workspace no host:

- `~/.openclaw/`
- `~/.openclaw/workspace`

Rodando em um VPS? Veja [Hetzner (Docker VPS)](/install/hetzner).

### Fluxo manual (compose)

```bash
docker build -t openclaw:local -f Dockerfile .
docker compose run --rm openclaw-cli onboard
docker compose up -d openclaw-gateway
```

Nota: execute `docker compose ...` a partir da raiz do repo. Se voce habilitou
`OPENCLAW_EXTRA_MOUNTS` ou `OPENCLAW_HOME_VOLUME`, o script de setup grava
`docker-compose.extra.yml`; inclua-o ao rodar o Compose em outro local:

```bash
docker compose -f docker-compose.yml -f docker-compose.extra.yml <command>
```

### Token da UI de Controle + pareamento (Docker)

Se voce vir “unauthorized” ou “disconnected (1008): pairing required”, busque um
link novo do dashboard e aprove o dispositivo do navegador:

```bash
docker compose run --rm openclaw-cli dashboard --no-open
docker compose run --rm openclaw-cli devices list
docker compose run --rm openclaw-cli devices approve <requestId>
```

Mais detalhes: [Dashboard](/web/dashboard), [Devices](/cli/devices).

### Montagens extras (opcional)

Se voce quiser montar diretorios adicionais do host nos containers, defina
`OPENCLAW_EXTRA_MOUNTS` antes de executar `docker-setup.sh`. Isso aceita uma
lista separada por virgulas de bind mounts do Docker e os aplica tanto a
`openclaw-gateway` quanto a `openclaw-cli` gerando `docker-compose.extra.yml`.

Exemplo:

```bash
export OPENCLAW_EXTRA_MOUNTS="$HOME/.codex:/home/node/.codex:ro,$HOME/github:/home/node/github:rw"
./docker-setup.sh
```

Notas:

- Os caminhos devem ser compartilhados com o Docker Desktop no macOS/Windows.
- Se voce editar `OPENCLAW_EXTRA_MOUNTS`, execute novamente `docker-setup.sh` para regenerar o
  arquivo compose extra.
- `docker-compose.extra.yml` é gerado. Nao edite manualmente.

### Persistir todo o home do container (opcional)

Se voce quiser que `/home/node` persista entre recriacoes do container, defina um
volume nomeado via `OPENCLAW_HOME_VOLUME`. Isso cria um volume Docker e o monta em
`/home/node`, mantendo os bind mounts padrao de configuracao/workspace. Use um
volume nomeado aqui (nao um caminho de bind); para bind mounts, use
`OPENCLAW_EXTRA_MOUNTS`.

Exemplo:

```bash
export OPENCLAW_HOME_VOLUME="openclaw_home"
./docker-setup.sh
```

Voce pode combinar isso com montagens extras:

```bash
export OPENCLAW_HOME_VOLUME="openclaw_home"
export OPENCLAW_EXTRA_MOUNTS="$HOME/.codex:/home/node/.codex:ro,$HOME/github:/home/node/github:rw"
./docker-setup.sh
```

Notas:

- Se voce mudar `OPENCLAW_HOME_VOLUME`, execute novamente `docker-setup.sh` para regenerar o
  arquivo compose extra.
- O volume nomeado persiste ate ser removido com `docker volume rm <name>`.

### Instalar pacotes apt extras (opcional)

Se voce precisar de pacotes de sistema dentro da imagem (por exemplo, ferramentas
de build ou bibliotecas de midia), defina `OPENCLAW_DOCKER_APT_PACKAGES` antes de executar
`docker-setup.sh`. Isso instala os pacotes durante o build da imagem, entao eles
persistem mesmo que o container seja excluido.

Exemplo:

```bash
export OPENCLAW_DOCKER_APT_PACKAGES="ffmpeg build-essential"
./docker-setup.sh
```

Notas:

- Aceita uma lista separada por espacos de nomes de pacotes apt.
- Se voce mudar `OPENCLAW_DOCKER_APT_PACKAGES`, execute novamente `docker-setup.sh` para reconstruir
  a imagem.

### Container para usuarios avancados / com todos os recursos (opt-in)

A imagem Docker padrao é **security-first** e roda como o usuario nao root
`node`. Isso mantem a superficie de ataque pequena, mas significa:

- nenhuma instalacao de pacotes de sistema em tempo de execucao
- nenhum Homebrew por padrao
- nenhum navegador Chromium/Playwright incluido

Se voce quiser um container com mais recursos, use estas opcoes opt-in:

1. **Persistir `/home/node`** para que downloads de navegadores e caches de
   ferramentas sobrevivam:

```bash
export OPENCLAW_HOME_VOLUME="openclaw_home"
./docker-setup.sh
```

2. **Incorporar dependencias de sistema na imagem** (repetivel + persistente):

```bash
export OPENCLAW_DOCKER_APT_PACKAGES="git curl jq"
./docker-setup.sh
```

3. **Instalar navegadores do Playwright sem `npx`** (evita conflitos de
   override do npm):

```bash
docker compose run --rm openclaw-cli \
  node /app/node_modules/playwright-core/cli.js install chromium
```

Se voce precisar que o Playwright instale dependencias de sistema, reconstrua a
imagem com `OPENCLAW_DOCKER_APT_PACKAGES` em vez de usar `--with-deps` em runtime.

4. **Persistir downloads de navegadores do Playwright**:

- Defina `PLAYWRIGHT_BROWSERS_PATH=/home/node/.cache/ms-playwright` em
  `docker-compose.yml`.
- Garanta que `/home/node` persista via `OPENCLAW_HOME_VOLUME`, ou monte
  `/home/node/.cache/ms-playwright` via `OPENCLAW_EXTRA_MOUNTS`.

### Permissoes + EACCES

A imagem roda como `node` (uid 1000). Se voce vir erros de permissao em
`/home/node/.openclaw`, garanta que seus bind mounts do host sejam de propriedade do uid 1000.

Exemplo (host Linux):

```bash
sudo chown -R 1000:1000 /path/to/openclaw-config /path/to/openclaw-workspace
```

Se voce optar por rodar como root por conveniencia, voce aceita o trade-off de
seguranca.

### Rebuilds mais rapidos (recomendado)

Para acelerar rebuilds, organize seu Dockerfile para que camadas de dependencias
fiquem em cache. Isso evita reexecutar `pnpm install` a menos que os lockfiles
mudem:

```dockerfile
FROM node:22-bookworm

# Install Bun (required for build scripts)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

RUN corepack enable

WORKDIR /app

# Cache dependencies unless package metadata changes
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
RUN pnpm ui:install
RUN pnpm ui:build

ENV NODE_ENV=production

CMD ["node","dist/index.js"]
```

### Configuracao de canais (opcional)

Use o container de CLI para configurar canais e, se necessario, reinicie o gateway.

WhatsApp (QR):

```bash
docker compose run --rm openclaw-cli channels login
```

Telegram (token do bot):

```bash
docker compose run --rm openclaw-cli channels add --channel telegram --token "<token>"
```

Discord (token do bot):

```bash
docker compose run --rm openclaw-cli channels add --channel discord --token "<token>"
```

Docs: [WhatsApp](/channels/whatsapp), [Telegram](/channels/telegram), [Discord](/channels/discord)

### OpenAI Codex OAuth (Docker headless)

Se voce escolher OpenAI Codex OAuth no assistente, ele abre um URL no navegador e
tenta capturar um callback em `http://127.0.0.1:1455/auth/callback`. Em Docker ou
configuracoes headless, esse callback pode mostrar um erro no navegador. Copie o
URL completo de redirecionamento em que voce cair e cole de volta no assistente
para concluir a autenticacao.

### Health check

```bash
docker compose exec openclaw-gateway node dist/index.js health --token "$OPENCLAW_GATEWAY_TOKEN"
```

### Teste de smoke E2E (Docker)

```bash
scripts/e2e/onboard-docker.sh
```

### Teste de smoke de importacao por QR (Docker)

```bash
pnpm test:docker:qr
```

### Notas

- O bind do Gateway usa por padrao `lan` para uso em container.
- O CMD do Dockerfile usa `--allow-unconfigured`; configuracao montada com `gateway.mode` e
  nao `local` ainda iniciara. Substitua o CMD para impor a verificacao.
- O container do gateway é a fonte da verdade para sessoes (`~/.openclaw/agents/<agentId>/sessions/`).

## Sandbox de Agente (gateway no host + ferramentas em Docker)

Aprofundamento: [Sandboxing](/gateway/sandboxing)

### O que ele faz

Quando `agents.defaults.sandbox` esta habilitado, **sessoes nao principais** executam
ferramentas dentro de um container Docker. O gateway permanece no seu host, mas a
execucao das ferramentas fica isolada:

- escopo: `"agent"` por padrao (um container + workspace por agente)
- escopo: `"session"` para isolamento por sessao
- pasta de workspace por escopo montada em `/workspace`
- acesso opcional ao workspace do agente (`agents.defaults.sandbox.workspaceAccess`)
- politica de ferramentas permitir/negar (negar vence)
- midia de entrada e copiada para o workspace ativo do sandbox (`media/inbound/*`)
  para que as ferramentas possam le-la (com `workspaceAccess: "rw"`, isso cai no workspace
  do agente)

Aviso: `scope: "shared"` desativa o isolamento entre sessoes. Todas as sessoes
compartilham um container e um workspace.

### Perfis de sandbox por agente (multi-agente)

Se voce usa roteamento multi-agente, cada agente pode sobrescrever configuracoes
de sandbox + ferramentas: `agents.list[].sandbox` e `agents.list[].tools` (alem de
`agents.list[].tools.sandbox.tools`). Isso permite rodar niveis de acesso mistos em um gateway:

- Acesso total (agente pessoal)
- Ferramentas somente leitura + workspace somente leitura (agente familiar/de
  trabalho)
- Nenhuma ferramenta de filesystem/shell (agente publico)

Veja [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools) para exemplos,
precedencia e solucao de problemas.

### Comportamento padrao

- Imagem: `openclaw-sandbox:bookworm-slim`
- Um container por agente
- Acesso ao workspace do agente: `workspaceAccess: "none"` (padrao) usa `~/.openclaw/sandboxes`
  - `"ro"` mantem o workspace do sandbox em `/workspace` e monta o
    workspace do agente como somente leitura em `/agent` (desativa
    `write`/`edit`/`apply_patch`)
  - `"rw"` monta o workspace do agente como leitura/escrita em
    `/workspace`
- Auto-prune: inativo > 24h OU idade > 7d
- Rede: `none` por padrao (faça opt-in explicito se precisar de egress)
- Permitir por padrao: `exec`, `process`, `read`,
  `write`, `edit`, `sessions_list`, `sessions_history`,
  `sessions_send`, `sessions_spawn`, `session_status`
- Negar por padrao: `browser`, `canvas`, `nodes`,
  `cron`, `discord`, `gateway`

### Habilitar sandboxing

Se voce planeja instalar pacotes em `setupCommand`, observe:

- O padrao `docker.network` é `"none"` (sem egress).
- `readOnlyRoot: true` bloqueia instalacoes de pacotes.
- `user` deve ser root para `apt-get` (omita `user` ou
  defina `user: "0:0"`).
  O OpenClaw recria containers automaticamente quando `setupCommand` (ou a
  configuracao do Docker) muda, a menos que o container tenha sido **usado
  recentemente** (nos ultimos ~5 minutos). Containers quentes registram um aviso
  com o comando exato `openclaw sandbox recreate ...`.

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main", // off | non-main | all
        scope: "agent", // session | agent | shared (agent is default)
        workspaceAccess: "none", // none | ro | rw
        workspaceRoot: "~/.openclaw/sandboxes",
        docker: {
          image: "openclaw-sandbox:bookworm-slim",
          workdir: "/workspace",
          readOnlyRoot: true,
          tmpfs: ["/tmp", "/var/tmp", "/run"],
          network: "none",
          user: "1000:1000",
          capDrop: ["ALL"],
          env: { LANG: "C.UTF-8" },
          setupCommand: "apt-get update && apt-get install -y git curl jq",
          pidsLimit: 256,
          memory: "1g",
          memorySwap: "2g",
          cpus: 1,
          ulimits: {
            nofile: { soft: 1024, hard: 2048 },
            nproc: 256,
          },
          seccompProfile: "/path/to/seccomp.json",
          apparmorProfile: "openclaw-sandbox",
          dns: ["1.1.1.1", "8.8.8.8"],
          extraHosts: ["internal.service:10.0.0.5"],
        },
        prune: {
          idleHours: 24, // 0 disables idle pruning
          maxAgeDays: 7, // 0 disables max-age pruning
        },
      },
    },
  },
  tools: {
    sandbox: {
      tools: {
        allow: [
          "exec",
          "process",
          "read",
          "write",
          "edit",
          "sessions_list",
          "sessions_history",
          "sessions_send",
          "sessions_spawn",
          "session_status",
        ],
        deny: ["browser", "canvas", "nodes", "cron", "discord", "gateway"],
      },
    },
  },
}
```

Os controles de hardening ficam sob `agents.defaults.sandbox.docker`:
`network`, `user`, `pidsLimit`, `memory`,
`memorySwap`, `cpus`, `ulimits`, `seccompProfile`,
`apparmorProfile`, `dns`, `extraHosts`.

Multi-agente: sobrescreva `agents.defaults.sandbox.{docker,browser,prune}.*` por agente via `agents.list[].sandbox.{docker,browser,prune}.*`
(ignorado quando `agents.defaults.sandbox.scope` / `agents.list[].sandbox.scope` é `"shared"`).

### Construir a imagem padrao do sandbox

```bash
scripts/sandbox-setup.sh
```

Isso constroi `openclaw-sandbox:bookworm-slim` usando `Dockerfile.sandbox`.

### Imagem comum do sandbox (opcional)

Se voce quiser uma imagem de sandbox com ferramentas comuns de build (Node, Go,
Rust, etc.), construa a imagem comum:

```bash
scripts/sandbox-common-setup.sh
```

Isso constroi `openclaw-sandbox-common:bookworm-slim`. Para usa-la:

```json5
{
  agents: {
    defaults: {
      sandbox: { docker: { image: "openclaw-sandbox-common:bookworm-slim" } },
    },
  },
}
```

### Imagem de navegador do sandbox

Para rodar a ferramenta de navegador dentro do sandbox, construa a imagem de
navegador:

```bash
scripts/sandbox-browser-setup.sh
```

Isso constroi `openclaw-sandbox-browser:bookworm-slim` usando
`Dockerfile.sandbox-browser`. O container roda o Chromium com CDP habilitado e
um observador noVNC opcional (headful via Xvfb).

Notas:

- Headful (Xvfb) reduz bloqueios de bot em comparacao com headless.
- Headless ainda pode ser usado definindo `agents.defaults.sandbox.browser.headless=true`.
- Nao e necessario um ambiente desktop completo (GNOME); o Xvfb fornece o display.

Use a configuracao:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        browser: { enabled: true },
      },
    },
  },
}
```

Imagem de navegador customizada:

```json5
{
  agents: {
    defaults: {
      sandbox: { browser: { image: "my-openclaw-browser" } },
    },
  },
}
```

Quando habilitado, o agente recebe:

- um URL de controle do navegador do sandbox (para a ferramenta `browser`)
- um URL noVNC (se habilitado e headless=false)

Lembre-se: se voce usa uma allowlist de ferramentas, adicione `browser` (e
remova de deny) ou a ferramenta continuara bloqueada.
Regras de prune (`agents.defaults.sandbox.prune`) tambem se aplicam aos containers de navegador.

### Imagem customizada de sandbox

Construa sua propria imagem e aponte a configuracao para ela:

```bash
docker build -t my-openclaw-sbx -f Dockerfile.sandbox .
```

```json5
{
  agents: {
    defaults: {
      sandbox: { docker: { image: "my-openclaw-sbx" } },
    },
  },
}
```

### Politica de ferramentas (permitir/negar)

- `deny` vence sobre `allow`.
- Se `allow` estiver vazio: todas as ferramentas (exceto deny) estao
  disponiveis.
- Se `allow` nao estiver vazio: apenas as ferramentas em `allow`
  estao disponiveis (menos deny).

### Estrategia de pruning

Dois controles:

- `prune.idleHours`: remove containers nao usados em X horas (0 = desativar)
- `prune.maxAgeDays`: remove containers mais antigos que X dias (0 = desativar)

Exemplo:

- Manter sessoes ativas mas limitar a vida util:
  `idleHours: 24`, `maxAgeDays: 7`
- Nunca fazer prune:
  `idleHours: 0`, `maxAgeDays: 0`

### Notas de seguranca

- A barreira rigida se aplica apenas a **ferramentas** (exec/read/write/edit/apply_patch).
- Ferramentas somente do host como browser/camera/canvas sao bloqueadas por padrao.
- Permitir `browser` no sandbox **quebra o isolamento** (o navegador roda no host).

## Solucao de problemas

- Imagem ausente: construa com [`scripts/sandbox-setup.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/sandbox-setup.sh) ou defina `agents.defaults.sandbox.docker.image`.
- Container nao esta rodando: ele sera criado automaticamente por sessao sob demanda.
- Erros de permissao no sandbox: defina `docker.user` para um UID:GID que corresponda
  a propriedade do seu workspace montado (ou faça chown da pasta do workspace).
- Ferramentas customizadas nao encontradas: o OpenClaw executa comandos com
  `sh -lc` (login shell), que carrega `/etc/profile` e pode redefinir o PATH.
  Defina `docker.env.PATH` para prefixar os caminhos das suas ferramentas customizadas
  (por exemplo, `/custom/bin:/usr/local/share/npm-global/bin`), ou adicione um script em `/etc/profile.d/` no seu
  Dockerfile.
