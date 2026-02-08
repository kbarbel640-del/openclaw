---
summary: "Execute o OpenClaw Gateway 24/7 em um VPS barato da Hetzner (Docker) com estado duravel e binarios incorporados"
read_when:
  - Voce quer o OpenClaw rodando 24/7 em um VPS na nuvem (nao no seu laptop)
  - Voce quer um Gateway sempre ligado, de nivel de producao, no seu proprio VPS
  - Voce quer controle total sobre persistencia, binarios e comportamento de reinicio
  - Voce esta executando o OpenClaw em Docker na Hetzner ou em um provedor similar
title: "Hetzner"
x-i18n:
  source_path: install/hetzner.md
  source_hash: 84d9f24f1a803aa1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:41Z
---

# OpenClaw na Hetzner (Docker, Guia de VPS em Producao)

## Objetivo

Executar um OpenClaw Gateway persistente em um VPS da Hetzner usando Docker, com estado duravel, binarios incorporados e comportamento seguro de reinicio.

Se voce quer “OpenClaw 24/7 por ~$5”, esta e a configuracao confiavel mais simples.
Os precos da Hetzner mudam; escolha o menor VPS Debian/Ubuntu e aumente se voce atingir OOMs.

## O que estamos fazendo (em termos simples)?

- Alugar um pequeno servidor Linux (VPS da Hetzner)
- Instalar Docker (runtime de aplicativo isolado)
- Iniciar o OpenClaw Gateway em Docker
- Persistir `~/.openclaw` + `~/.openclaw/workspace` no host (sobrevive a reinicios/rebuilds)
- Acessar a UI de Controle a partir do seu laptop via um tunel SSH

O Gateway pode ser acessado via:

- Encaminhamento de porta SSH a partir do seu laptop
- Exposicao direta de porta se voce gerenciar firewall e tokens por conta propria

Este guia assume Ubuntu ou Debian na Hetzner.  
Se voce estiver em outro VPS Linux, mapeie os pacotes de acordo.
Para o fluxo Docker generico, veja [Docker](/install/docker).

---

## Caminho rapido (operadores experientes)

1. Provisionar o VPS da Hetzner
2. Instalar Docker
3. Clonar o repositorio do OpenClaw
4. Criar diretorios persistentes no host
5. Configurar `.env` e `docker-compose.yml`
6. Incorporar os binarios necessarios na imagem
7. `docker compose up -d`
8. Verificar persistencia e acesso ao Gateway

---

## O que voce precisa

- VPS da Hetzner com acesso root
- Acesso SSH a partir do seu laptop
- Conforto basico com SSH + copiar/colar
- ~20 minutos
- Docker e Docker Compose
- Credenciais de autenticacao do modelo
- Credenciais opcionais de provedores
  - QR do WhatsApp
  - Token de bot do Telegram
  - OAuth do Gmail

---

## 1) Provisionar o VPS

Crie um VPS Ubuntu ou Debian na Hetzner.

Conecte como root:

```bash
ssh root@YOUR_VPS_IP
```

Este guia assume que o VPS e stateful.
Nao o trate como infraestrutura descartavel.

---

## 2) Instalar Docker (no VPS)

```bash
apt-get update
apt-get install -y git curl ca-certificates
curl -fsSL https://get.docker.com | sh
```

Verifique:

```bash
docker --version
docker compose version
```

---

## 3) Clonar o repositorio do OpenClaw

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
```

Este guia assume que voce ira construir uma imagem personalizada para garantir persistencia de binarios.

---

## 4) Criar diretorios persistentes no host

Containers Docker sao efemeros.
Todo estado de longa duracao deve viver no host.

```bash
mkdir -p /root/.openclaw
mkdir -p /root/.openclaw/workspace

# Set ownership to the container user (uid 1000):
chown -R 1000:1000 /root/.openclaw
chown -R 1000:1000 /root/.openclaw/workspace
```

---

## 5) Configurar variaveis de ambiente

Crie `.env` na raiz do repositorio.

```bash
OPENCLAW_IMAGE=openclaw:latest
OPENCLAW_GATEWAY_TOKEN=change-me-now
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_GATEWAY_PORT=18789

OPENCLAW_CONFIG_DIR=/root/.openclaw
OPENCLAW_WORKSPACE_DIR=/root/.openclaw/workspace

GOG_KEYRING_PASSWORD=change-me-now
XDG_CONFIG_HOME=/home/node/.openclaw
```

Gere segredos fortes:

```bash
openssl rand -hex 32
```

**Nao comite este arquivo.**

---

## 6) Configuracao do Docker Compose

Crie ou atualize `docker-compose.yml`.

```yaml
services:
  openclaw-gateway:
    image: ${OPENCLAW_IMAGE}
    build: .
    restart: unless-stopped
    env_file:
      - .env
    environment:
      - HOME=/home/node
      - NODE_ENV=production
      - TERM=xterm-256color
      - OPENCLAW_GATEWAY_BIND=${OPENCLAW_GATEWAY_BIND}
      - OPENCLAW_GATEWAY_PORT=${OPENCLAW_GATEWAY_PORT}
      - OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}
      - GOG_KEYRING_PASSWORD=${GOG_KEYRING_PASSWORD}
      - XDG_CONFIG_HOME=${XDG_CONFIG_HOME}
      - PATH=/home/linuxbrew/.linuxbrew/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
    volumes:
      - ${OPENCLAW_CONFIG_DIR}:/home/node/.openclaw
      - ${OPENCLAW_WORKSPACE_DIR}:/home/node/.openclaw/workspace
    ports:
      # Recommended: keep the Gateway loopback-only on the VPS; access via SSH tunnel.
      # To expose it publicly, remove the `127.0.0.1:` prefix and firewall accordingly.
      - "127.0.0.1:${OPENCLAW_GATEWAY_PORT}:18789"

      # Optional: only if you run iOS/Android nodes against this VPS and need Canvas host.
      # If you expose this publicly, read /gateway/security and firewall accordingly.
      # - "18793:18793"
    command:
      [
        "node",
        "dist/index.js",
        "gateway",
        "--bind",
        "${OPENCLAW_GATEWAY_BIND}",
        "--port",
        "${OPENCLAW_GATEWAY_PORT}",
      ]
```

---

## 7) Incorporar os binarios necessarios na imagem (critico)

Instalar binarios dentro de um container em execucao e uma armadilha.
Qualquer coisa instalada em tempo de execucao sera perdida no reinicio.

Todos os binarios externos exigidos por skills devem ser instalados no momento do build da imagem.

Os exemplos abaixo mostram apenas tres binarios comuns:

- `gog` para acesso ao Gmail
- `goplaces` para Google Places
- `wacli` para WhatsApp

Estes sao exemplos, nao uma lista completa.
Voce pode instalar quantos binarios forem necessarios usando o mesmo padrao.

Se voce adicionar novas skills depois que dependam de binarios adicionais, voce deve:

1. Atualizar o Dockerfile
2. Rebuildar a imagem
3. Reiniciar os containers

**Exemplo de Dockerfile**

```dockerfile
FROM node:22-bookworm

RUN apt-get update && apt-get install -y socat && rm -rf /var/lib/apt/lists/*

# Example binary 1: Gmail CLI
RUN curl -L https://github.com/steipete/gog/releases/latest/download/gog_Linux_x86_64.tar.gz \
  | tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/gog

# Example binary 2: Google Places CLI
RUN curl -L https://github.com/steipete/goplaces/releases/latest/download/goplaces_Linux_x86_64.tar.gz \
  | tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/goplaces

# Example binary 3: WhatsApp CLI
RUN curl -L https://github.com/steipete/wacli/releases/latest/download/wacli_Linux_x86_64.tar.gz \
  | tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/wacli

# Add more binaries below using the same pattern

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY scripts ./scripts

RUN corepack enable
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
RUN pnpm ui:install
RUN pnpm ui:build

ENV NODE_ENV=production

CMD ["node","dist/index.js"]
```

---

## 8) Build e inicializacao

```bash
docker compose build
docker compose up -d openclaw-gateway
```

Verifique os binarios:

```bash
docker compose exec openclaw-gateway which gog
docker compose exec openclaw-gateway which goplaces
docker compose exec openclaw-gateway which wacli
```

Saida esperada:

```
/usr/local/bin/gog
/usr/local/bin/goplaces
/usr/local/bin/wacli
```

---

## 9) Verificar o Gateway

```bash
docker compose logs -f openclaw-gateway
```

Sucesso:

```
[gateway] listening on ws://0.0.0.0:18789
```

A partir do seu laptop:

```bash
ssh -N -L 18789:127.0.0.1:18789 root@YOUR_VPS_IP
```

Abra:

`http://127.0.0.1:18789/`

Cole o token do seu gateway.

---

## O que persiste onde (fonte da verdade)

O OpenClaw roda em Docker, mas o Docker nao e a fonte da verdade.
Todo estado de longa duracao deve sobreviver a reinicios, rebuilds e reboots.

| Componente               | Localizacao                       | Mecanismo de persistencia  | Observacoes                       |
| ------------------------ | --------------------------------- | -------------------------- | --------------------------------- |
| Configuracao do Gateway  | `/home/node/.openclaw/`           | Montagem de volume no host | Inclui `openclaw.json`, tokens    |
| Perfis de auth do modelo | `/home/node/.openclaw/`           | Montagem de volume no host | Tokens OAuth, chaves de API       |
| Configuracoes de Skills  | `/home/node/.openclaw/skills/`    | Montagem de volume no host | Estado no nivel da skill          |
| Workspace do agente      | `/home/node/.openclaw/workspace/` | Montagem de volume no host | Codigo e artefatos do agente      |
| Sessao do WhatsApp       | `/home/node/.openclaw/`           | Montagem de volume no host | Preserva login por QR             |
| Keyring do Gmail         | `/home/node/.openclaw/`           | Volume no host + senha     | Requer `GOG_KEYRING_PASSWORD`     |
| Binarios externos        | `/usr/local/bin/`                 | Imagem Docker              | Devem ser incorporados no build   |
| Runtime do Node          | Sistema de arquivos do container  | Imagem Docker              | Rebuildado a cada build da imagem |
| Pacotes do SO            | Sistema de arquivos do container  | Imagem Docker              | Nao instale em tempo de execucao  |
| Container Docker         | Efemero                           | Reiniciavel                | Seguro para destruir              |
