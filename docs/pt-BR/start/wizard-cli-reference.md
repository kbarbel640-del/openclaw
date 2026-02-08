---
summary: "Referência completa para o fluxo de integracao inicial via CLI, configuracao de auth/modelo, saidas e detalhes internos"
read_when:
  - Voce precisa de comportamento detalhado para openclaw onboard
  - Voce esta depurando resultados de integracao inicial ou integrando clientes de onboarding
title: "Referencia de Integracao Inicial via CLI"
sidebarTitle: "Referencia da CLI"
x-i18n:
  source_path: start/wizard-cli-reference.md
  source_hash: 0ef6f01c3e29187b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:43Z
---

# Referencia de Integracao Inicial via CLI

Esta pagina é a referencia completa para `openclaw onboard`.
Para o guia curto, veja [Assistente de Integracao Inicial (CLI)](/start/wizard).

## O que o assistente faz

O modo local (padrao) guia voce por:

- Configuracao de modelo e auth (OAuth da assinatura OpenAI Code, chave de API da Anthropic ou token de configuracao, alem de opcoes MiniMax, GLM, Moonshot e AI Gateway)
- Localizacao do workspace e arquivos de bootstrap
- Configuracoes do Gateway (porta, bind, auth, tailscale)
- Canais e provedores (Telegram, WhatsApp, Discord, Google Chat, plugin do Mattermost, Signal)
- Instalacao do daemon (LaunchAgent ou unidade systemd de usuario)
- Verificacao de saude
- Configuracao de Skills

O modo remoto configura esta maquina para se conectar a um gateway em outro local.
Ele nao instala nem modifica nada no host remoto.

## Detalhes do fluxo local

<Steps>
  <Step title="Deteccao de configuracao existente">
    - Se `~/.openclaw/openclaw.json` existir, escolha Manter, Modificar ou Redefinir.
    - Executar o assistente novamente nao apaga nada a menos que voce escolha explicitamente Redefinir (ou passe `--reset`).
    - Se a configuracao for invalida ou contiver chaves legadas, o assistente para e solicita que voce execute `openclaw doctor` antes de continuar.
    - A redefinicao usa `trash` e oferece escopos:
      - Apenas configuracao
      - Configuracao + credenciais + sessoes
      - Redefinicao completa (tambem remove o workspace)
  </Step>
  <Step title="Modelo e auth">
    - A matriz completa de opcoes esta em [Opcoes de auth e modelo](#auth-and-model-options).
  </Step>
  <Step title="Workspace">
    - Padrao `~/.openclaw/workspace` (configuravel).
    - Preenche arquivos do workspace necessarios para o ritual de bootstrap da primeira execucao.
    - Layout do workspace: [Workspace do agente](/concepts/agent-workspace).
  </Step>
  <Step title="Gateway">
    - Solicita porta, bind, modo de auth e exposicao via tailscale.
    - Recomendado: manter auth por token habilitada mesmo para loopback, para que clientes WS locais precisem se autenticar.
    - Desabilite auth apenas se voce confiar totalmente em todos os processos locais.
    - Binds fora de loopback ainda exigem auth.
  </Step>
  <Step title="Canais">
    - [WhatsApp](/channels/whatsapp): login opcional via QR
    - [Telegram](/channels/telegram): token do bot
    - [Discord](/channels/discord): token do bot
    - [Google Chat](/channels/googlechat): JSON de conta de servico + audiencia do webhook
    - Plugin do [Mattermost](/channels/mattermost): token do bot + URL base
    - [Signal](/channels/signal): instalacao opcional de `signal-cli` + configuracao da conta
    - [BlueBubbles](/channels/bluebubbles): recomendado para iMessage; URL do servidor + senha + webhook
    - [iMessage](/channels/imessage): caminho legado de CLI `imsg` + acesso ao DB
    - Seguranca de DM: o padrao é pareamento. A primeira DM envia um codigo; aprove via
      `openclaw pairing approve <channel> <code>` ou use allowlists.
  </Step>
  <Step title="Instalacao do daemon">
    - macOS: LaunchAgent
      - Requer sessao de usuario autenticada; para headless, use um LaunchDaemon customizado (nao fornecido).
    - Linux e Windows via WSL2: unidade systemd de usuario
      - O assistente tenta `loginctl enable-linger <user>` para que o gateway continue ativo apos logout.
      - Pode solicitar sudo (grava `/var/lib/systemd/linger`); ele tenta sem sudo primeiro.
    - Selecao de runtime: Node (recomendado; exigido para WhatsApp e Telegram). Bun nao é recomendado.
  </Step>
  <Step title="Verificacao de saude">
    - Inicia o gateway (se necessario) e executa `openclaw health`.
    - `openclaw status --deep` adiciona probes de saude do gateway à saida de status.
  </Step>
  <Step title="Skills">
    - Le as skills disponiveis e verifica requisitos.
    - Permite escolher o gerenciador de node: npm ou pnpm (bun nao é recomendado).
    - Instala dependencias opcionais (algumas usam Homebrew no macOS).
  </Step>
  <Step title="Conclusao">
    - Resumo e proximos passos, incluindo opcoes de apps para iOS, Android e macOS.
  </Step>
</Steps>

<Note>
Se nenhuma GUI for detectada, o assistente imprime instrucoes de port-forward via SSH para a Control UI em vez de abrir um navegador.
Se os assets da Control UI estiverem ausentes, o assistente tenta construi-los; o fallback é `pnpm ui:build` (auto-instala dependencias da UI).
</Note>

## Detalhes do modo remoto

O modo remoto configura esta maquina para se conectar a um gateway em outro local.

<Info>
O modo remoto nao instala nem modifica nada no host remoto.
</Info>

O que voce define:

- URL do gateway remoto (`ws://...`)
- Token se a auth do gateway remoto for exigida (recomendado)

<Note>
- Se o gateway for apenas loopback, use tunelamento SSH ou uma tailnet.
- Dicas de descoberta:
  - macOS: Bonjour (`dns-sd`)
  - Linux: Avahi (`avahi-browse`)
</Note>

## Opcoes de auth e modelo

<AccordionGroup>
  <Accordion title="Chave de API da Anthropic (recomendado)">
    Usa `ANTHROPIC_API_KEY` se presente ou solicita uma chave, depois a salva para uso pelo daemon.
  </Accordion>
  <Accordion title="OAuth da Anthropic (Claude Code CLI)">
    - macOS: verifica o item do Keychain "Claude Code-credentials"
    - Linux e Windows: reutiliza `~/.claude/.credentials.json` se presente

    No macOS, escolha "Always Allow" para que inicializacoes do launchd nao bloqueiem.

  </Accordion>
  <Accordion title="Token da Anthropic (colagem de setup-token)">
    Execute `claude setup-token` em qualquer maquina e depois cole o token.
    Voce pode nomea-lo; em branco usa o padrao.
  </Accordion>
  <Accordion title="Assinatura OpenAI Code (reuso do Codex CLI)">
    Se `~/.codex/auth.json` existir, o assistente pode reutiliza-la.
  </Accordion>
  <Accordion title="Assinatura OpenAI Code (OAuth)">
    Fluxo no navegador; cole `code#state`.

    Define `agents.defaults.model` como `openai-codex/gpt-5.3-codex` quando o modelo estiver indefinido ou `openai/*`.

  </Accordion>
  <Accordion title="Chave de API da OpenAI">
    Usa `OPENAI_API_KEY` se presente ou solicita uma chave, depois a salva em
    `~/.openclaw/.env` para que o launchd possa ler.

    Define `agents.defaults.model` como `openai/gpt-5.1-codex` quando o modelo estiver indefinido, `openai/*` ou `openai-codex/*`.

  </Accordion>
  <Accordion title="OpenCode Zen">
    Solicita `OPENCODE_API_KEY` (ou `OPENCODE_ZEN_API_KEY`).
    URL de configuracao: [opencode.ai/auth](https://opencode.ai/auth).
  </Accordion>
  <Accordion title="Chave de API (generica)">
    Armazena a chave para voce.
  </Accordion>
  <Accordion title="Vercel AI Gateway">
    Solicita `AI_GATEWAY_API_KEY`.
    Mais detalhes: [Vercel AI Gateway](/providers/vercel-ai-gateway).
  </Accordion>
  <Accordion title="Cloudflare AI Gateway">
    Solicita ID da conta, ID do gateway e `CLOUDFLARE_AI_GATEWAY_API_KEY`.
    Mais detalhes: [Cloudflare AI Gateway](/providers/cloudflare-ai-gateway).
  </Accordion>
  <Accordion title="MiniMax M2.1">
    A configuracao é escrita automaticamente.
    Mais detalhes: [MiniMax](/providers/minimax).
  </Accordion>
  <Accordion title="Synthetic (compativel com Anthropic)">
    Solicita `SYNTHETIC_API_KEY`.
    Mais detalhes: [Synthetic](/providers/synthetic).
  </Accordion>
  <Accordion title="Moonshot e Kimi Coding">
    As configuracoes do Moonshot (Kimi K2) e do Kimi Coding sao escritas automaticamente.
    Mais detalhes: [Moonshot AI (Kimi + Kimi Coding)](/providers/moonshot).
  </Accordion>
  <Accordion title="Ignorar">
    Deixa auth nao configurada.
  </Accordion>
</AccordionGroup>

Comportamento do modelo:

- Escolha o modelo padrao dentre as opcoes detectadas ou informe provedor e modelo manualmente.
- O assistente executa uma verificacao do modelo e avisa se o modelo configurado for desconhecido ou se faltar auth.

Caminhos de credenciais e perfis:

- Credenciais OAuth: `~/.openclaw/credentials/oauth.json`
- Perfis de auth (chaves de API + OAuth): `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`

<Note>
Dica para headless e servidores: conclua o OAuth em uma maquina com navegador e depois copie
`~/.openclaw/credentials/oauth.json` (ou `$OPENCLAW_STATE_DIR/credentials/oauth.json`)
para o host do gateway.
</Note>

## Saidas e detalhes internos

Campos tipicos em `~/.openclaw/openclaw.json`:

- `agents.defaults.workspace`
- `agents.defaults.model` / `models.providers` (se Minimax for escolhido)
- `gateway.*` (modo, bind, auth, tailscale)
- `channels.telegram.botToken`, `channels.discord.token`, `channels.signal.*`, `channels.imessage.*`
- Allowlists de canais (Slack, Discord, Matrix, Microsoft Teams) quando voce opta durante os prompts (nomes resolvem para IDs quando possivel)
- `skills.install.nodeManager`
- `wizard.lastRunAt`
- `wizard.lastRunVersion`
- `wizard.lastRunCommit`
- `wizard.lastRunCommand`
- `wizard.lastRunMode`

`openclaw agents add` grava `agents.list[]` e opcionalmente `bindings`.

Credenciais do WhatsApp ficam em `~/.openclaw/credentials/whatsapp/<accountId>/`.
As sessoes sao armazenadas em `~/.openclaw/agents/<agentId>/sessions/`.

<Note>
Alguns canais sao entregues como plugins. Quando selecionados durante a integracao inicial, o assistente
solicita a instalacao do plugin (npm ou caminho local) antes da configuracao do canal.
</Note>

RPC do assistente do Gateway:

- `wizard.start`
- `wizard.next`
- `wizard.cancel`
- `wizard.status`

Clientes (app macOS e Control UI) podem renderizar etapas sem reimplementar a logica de integracao inicial.

Comportamento da configuracao do Signal:

- Baixa o asset de release apropriado
- Armazena em `~/.openclaw/tools/signal-cli/<version>/`
- Grava `channels.signal.cliPath` na configuracao
- Builds JVM exigem Java 21
- Builds nativas sao usadas quando disponiveis
- No Windows, usa WSL2 e segue o fluxo do signal-cli do Linux dentro do WSL

## Documentos relacionados

- Hub de integracao inicial: [Assistente de Integracao Inicial (CLI)](/start/wizard)
- Automacao e scripts: [Automacao da CLI](/start/wizard-cli-automation)
- Referencia de comandos: [`openclaw onboard`](/cli/onboard)
