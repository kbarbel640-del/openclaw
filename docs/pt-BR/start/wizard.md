---
summary: "Assistente de integracao inicial da CLI: configuracao guiada para gateway, workspace, canais e skills"
read_when:
  - Executando ou configurando o assistente de integracao inicial
  - Configurando uma nova maquina
title: "Assistente de Integracao Inicial (CLI)"
sidebarTitle: "Onboarding: CLI"
x-i18n:
  source_path: start/wizard.md
  source_hash: 5495d951a2d78ffb
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:32Z
---

# Assistente de Integracao Inicial (CLI)

O assistente de integracao inicial é a forma **recomendada** de configurar o OpenClaw no macOS,
Linux ou Windows (via WSL2; fortemente recomendado).
Ele configura um Gateway local ou uma conexao remota com o Gateway, alem de canais, skills
e padroes de workspace em um unico fluxo guiado.

```bash
openclaw onboard
```

<Info>
Chat mais rapido: abra a Control UI (nao e necessario configurar canais). Execute
`openclaw dashboard` e converse no navegador. Docs: [Dashboard](/web/dashboard).
</Info>

Para reconfigurar mais tarde:

```bash
openclaw configure
openclaw agents add <name>
```

<Note>
`--json` nao implica modo nao interativo. Para scripts, use `--non-interactive`.
</Note>

<Tip>
Recomendado: configure uma chave de API do Brave Search para que o agente possa usar `web_search`
(`web_fetch` funciona sem chave). Caminho mais facil: `openclaw configure --section web`
que armazena `tools.web.search.apiKey`. Docs: [Web tools](/tools/web).
</Tip>

## Inicio rapido vs Avancado

O assistente comeca com **Inicio rapido** (padroes) vs **Avancado** (controle total).

<Tabs>
  <Tab title="Inicio rapido (padroes)">
    - Gateway local (loopback)
    - Workspace padrao (ou workspace existente)
    - Porta do Gateway **18789**
    - Autenticacao do Gateway **Token** (gerado automaticamente, mesmo em loopback)
    - Exposicao via Tailscale **Desativada**
    - Mensagens diretas do Telegram + WhatsApp com padrao **allowlist** (voce sera solicitado a informar seu numero de telefone)
  </Tab>
  <Tab title="Avancado (controle total)">
    - Exibe todas as etapas (modo, workspace, gateway, canais, daemon, skills).
  </Tab>
</Tabs>

## O que o assistente configura

**Modo local (padrao)** guia voce pelas seguintes etapas:

1. **Modelo/Auth** — Chave de API da Anthropic (recomendado), OAuth, OpenAI ou outros provedores. Escolha um modelo padrao.
2. **Workspace** — Local para arquivos do agente (padrao `~/.openclaw/workspace`). Cria arquivos iniciais.
3. **Gateway** — Porta, endereco de bind, modo de autenticacao, exposicao via Tailscale.
4. **Canais** — WhatsApp, Telegram, Discord, Google Chat, Mattermost, Signal, BlueBubbles ou iMessage.
5. **Daemon** — Instala um LaunchAgent (macOS) ou uma unidade de usuario systemd (Linux/WSL2).
6. **Verificacao de saude** — Inicia o Gateway e verifica se esta em execucao.
7. **Skills** — Instala skills recomendadas e dependencias opcionais.

<Note>
Executar o assistente novamente **nao** apaga nada, a menos que voce escolha explicitamente **Reset** (ou passe `--reset`).
Se a configuracao for invalida ou contiver chaves legadas, o assistente solicitara que voce execute `openclaw doctor` primeiro.
</Note>

**Modo remoto** apenas configura o cliente local para se conectar a um Gateway em outro local.
Ele **nao** instala nem altera nada no host remoto.

## Adicionar outro agente

Use `openclaw agents add <name>` para criar um agente separado com seu proprio workspace,
sessoes e perfis de autenticacao. Executar sem `--workspace` inicia o assistente.

O que ele define:

- `agents.list[].name`
- `agents.list[].workspace`
- `agents.list[].agentDir`

Observacoes:

- Workspaces padrao seguem `~/.openclaw/workspace-<agentId>`.
- Adicione `bindings` para rotear mensagens de entrada (o assistente pode fazer isso).
- Flags nao interativas: `--model`, `--agent-dir`, `--bind`, `--non-interactive`.

## Referencia completa

Para detalhamentos passo a passo, scripts nao interativos, configuracao do Signal,
API RPC e uma lista completa dos campos de configuracao que o assistente grava, veja a
[Referencia do Assistente](/reference/wizard).

## Docs relacionados

- Referencia de comandos da CLI: [`openclaw onboard`](/cli/onboard)
- Integracao inicial do app macOS: [Onboarding](/start/onboarding)
- Ritual de primeira execucao do agente: [Agent Bootstrapping](/start/bootstrapping)
