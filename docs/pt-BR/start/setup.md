---
summary: "Configuracao avancada e fluxos de trabalho de desenvolvimento para OpenClaw"
read_when:
  - Configurando uma nova maquina
  - Voce quer “o mais recente e melhor” sem quebrar sua configuracao pessoal
title: "Configuracao"
x-i18n:
  source_path: start/setup.md
  source_hash: 6620daddff099dc0
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:33Z
---

# Configuracao

<Note>
Se voce estiver configurando pela primeira vez, comece por [Getting Started](/start/getting-started).
Para detalhes do assistente, veja [Onboarding Wizard](/start/wizard).
</Note>

Ultima atualizacao: 2026-01-01

## TL;DR

- **A personalizacao fica fora do repo:** `~/.openclaw/workspace` (workspace) + `~/.openclaw/openclaw.json` (config).
- **Fluxo estavel:** instale o app do macOS; deixe-o executar o Gateway empacotado.
- **Fluxo bleeding edge:** execute o Gateway voce mesmo via `pnpm gateway:watch`, depois deixe o app do macOS se conectar em modo Local.

## Pre-requisitos (a partir do codigo-fonte)

- Node `>=22`
- `pnpm`
- Docker (opcional; apenas para configuracao containerizada/e2e — veja [Docker](/install/docker))

## Estrategia de personalizacao (para que atualizacoes nao doam)

Se voce quer “100% do meu jeito” _e_ atualizacoes faceis, mantenha sua customizacao em:

- **Config:** `~/.openclaw/openclaw.json` (JSON/JSON5-ish)
- **Workspace:** `~/.openclaw/workspace` (skills, prompts, memorias; torne um repo git privado)

Inicialize uma vez:

```bash
openclaw setup
```

De dentro deste repo, use a entrada local da CLI:

```bash
openclaw setup
```

Se voce ainda nao tem uma instalacao global, execute via `pnpm openclaw setup`.

## Executar o Gateway a partir deste repo

Apos `pnpm build`, voce pode executar a CLI empacotada diretamente:

```bash
node openclaw.mjs gateway --port 18789 --verbose
```

## Fluxo estavel (app do macOS primeiro)

1. Instale + inicie **OpenClaw.app** (barra de menus).
2. Conclua a lista de onboarding/permissoes (prompts do TCC).
3. Garanta que o Gateway esteja **Local** e em execucao (o app o gerencia).
4. Vincule superficies (exemplo: WhatsApp):

```bash
openclaw channels login
```

5. Verificacao rapida:

```bash
openclaw health
```

Se o onboarding nao estiver disponivel na sua build:

- Execute `openclaw setup`, depois `openclaw channels login`, e entao inicie o Gateway manualmente (`openclaw gateway`).

## Fluxo bleeding edge (Gateway em um terminal)

Objetivo: trabalhar no Gateway em TypeScript, obter hot reload e manter a UI do app do macOS conectada.

### 0) (Opcional) Executar o app do macOS a partir do codigo-fonte tambem

Se voce tambem quiser o app do macOS no bleeding edge:

```bash
./scripts/restart-mac.sh
```

### 1) Iniciar o Gateway de desenvolvimento

```bash
pnpm install
pnpm gateway:watch
```

`gateway:watch` executa o gateway em modo watch e recarrega em alteracoes de TypeScript.

### 2) Apontar o app do macOS para o seu Gateway em execucao

No **OpenClaw.app**:

- Modo de Conexao: **Local**
  O app se conectara ao gateway em execucao na porta configurada.

### 3) Verificar

- O status do Gateway no app deve mostrar **“Using existing gateway …”**
- Ou via CLI:

```bash
openclaw health
```

### Armadilhas comuns

- **Porta errada:** o WS do Gateway usa por padrao `ws://127.0.0.1:18789`; mantenha app + CLI na mesma porta.
- **Onde o estado fica:**
  - Credenciais: `~/.openclaw/credentials/`
  - Sessoes: `~/.openclaw/agents/<agentId>/sessions/`
  - Logs: `/tmp/openclaw/`

## Mapa de armazenamento de credenciais

Use isto ao depurar autenticacao ou decidir o que fazer backup:

- **WhatsApp**: `~/.openclaw/credentials/whatsapp/<accountId>/creds.json`
- **Token de bot do Telegram**: config/env ou `channels.telegram.tokenFile`
- **Token de bot do Discord**: config/env (arquivo de token ainda nao suportado)
- **Tokens do Slack**: config/env (`channels.slack.*`)
- **Allowlists de pareamento**: `~/.openclaw/credentials/<channel>-allowFrom.json`
- **Perfis de autenticacao de modelo**: `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`
- **Importacao de OAuth legado**: `~/.openclaw/credentials/oauth.json`
  Mais detalhes: [Security](/gateway/security#credential-storage-map).

## Atualizando (sem destruir sua configuracao)

- Mantenha `~/.openclaw/workspace` e `~/.openclaw/` como “suas coisas”; nao coloque prompts/config pessoais no repo `openclaw`.
- Atualizando o codigo-fonte: `git pull` + `pnpm install` (quando o lockfile mudar) + continue usando `pnpm gateway:watch`.

## Linux (servico systemd de usuario)

Instalacoes Linux usam um servico systemd **de usuario**. Por padrao, o systemd para servicos de usuario ao fazer logout/idle, o que derruba o Gateway. O onboarding tenta habilitar o lingering para voce (pode solicitar sudo). Se ainda estiver desativado, execute:

```bash
sudo loginctl enable-linger $USER
```

Para servidores always-on ou multiusuario, considere um servico **de sistema** em vez de um servico de usuario (sem necessidade de lingering). Veja [Gateway runbook](/gateway) para as notas de systemd.

## Documentos relacionados

- [Gateway runbook](/gateway) (flags, supervisao, portas)
- [Gateway configuration](/gateway/configuration) (esquema de configuracao + exemplos)
- [Discord](/channels/discord) e [Telegram](/channels/telegram) (reply tags + configuracoes de replyToMode)
- [OpenClaw assistant setup](/start/openclaw)
- [macOS app](/platforms/macos) (ciclo de vida do gateway)
