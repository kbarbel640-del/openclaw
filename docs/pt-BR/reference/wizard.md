---
summary: "Referência completa do assistente de integracao inicial da CLI: todas as etapas, flags e campos de configuracao"
read_when:
  - Consultar uma etapa ou flag específica do assistente
  - Automatizar a integracao inicial com modo nao interativo
  - Depurar o comportamento do assistente
title: "Referencia do Assistente de Integracao Inicial"
sidebarTitle: "Referencia do Assistente"
x-i18n:
  source_path: reference/wizard.md
  source_hash: 1dd46ad12c53668c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:38Z
---

# Referencia do Assistente de Integracao Inicial

Esta é a referência completa do assistente de CLI `openclaw onboard`.
Para uma visão geral de alto nível, consulte [Onboarding Wizard](/start/wizard).

## Detalhes do fluxo (modo local)

<Steps>
  <Step title="Deteccao de configuracao existente">
    - Se `~/.openclaw/openclaw.json` existir, escolha **Manter / Modificar / Resetar**.
    - Executar o assistente novamente **nao** apaga nada, a menos que voce escolha explicitamente **Resetar**
      (ou passe `--reset`).
    - Se a configuracao for invalida ou contiver chaves legadas, o assistente para e solicita
      que voce execute `openclaw doctor` antes de continuar.
    - O reset usa `trash` (nunca `rm`) e oferece escopos:
      - Apenas configuracao
      - Configuracao + credenciais + sessoes
      - Reset completo (tambem remove o workspace)
  </Step>
  <Step title="Modelo/Auth">
    - **Chave de API da Anthropic (recomendado)**: usa `ANTHROPIC_API_KEY` se presente ou solicita uma chave, depois a salva para uso pelo daemon.
    - **OAuth da Anthropic (Claude Code CLI)**: no macOS o assistente verifica o item do Keychain "Claude Code-credentials" (escolha "Always Allow" para que inicializacoes via launchd nao bloqueiem); no Linux/Windows ele reutiliza `~/.claude/.credentials.json` se presente.
    - **Token da Anthropic (colar setup-token)**: execute `claude setup-token` em qualquer maquina e depois cole o token (voce pode nomea-lo; em branco = padrao).
    - **Assinatura OpenAI Code (Codex) (Codex CLI)**: se `~/.codex/auth.json` existir, o assistente pode reutiliza-la.
    - **Assinatura OpenAI Code (Codex) (OAuth)**: fluxo via navegador; cole o `code#state`.
      - Define `agents.defaults.model` como `openai-codex/gpt-5.2` quando o modelo nao esta definido ou esta como `openai/*`.
    - **Chave de API da OpenAI**: usa `OPENAI_API_KEY` se presente ou solicita uma chave, depois a salva em `~/.openclaw/.env` para que o launchd possa le-la.
    - **OpenCode Zen (proxy multi-modelo)**: solicita `OPENCODE_API_KEY` (ou `OPENCODE_ZEN_API_KEY`, obtenha em https://opencode.ai/auth).
    - **Chave de API**: armazena a chave para voce.
    - **Vercel AI Gateway (proxy multi-modelo)**: solicita `AI_GATEWAY_API_KEY`.
    - Mais detalhes: [Vercel AI Gateway](/providers/vercel-ai-gateway)
    - **Cloudflare AI Gateway**: solicita Account ID, Gateway ID e `CLOUDFLARE_AI_GATEWAY_API_KEY`.
    - Mais detalhes: [Cloudflare AI Gateway](/providers/cloudflare-ai-gateway)
    - **MiniMax M2.1**: a configuracao é escrita automaticamente.
    - Mais detalhes: [MiniMax](/providers/minimax)
    - **Synthetic (compativel com Anthropic)**: solicita `SYNTHETIC_API_KEY`.
    - Mais detalhes: [Synthetic](/providers/synthetic)
    - **Moonshot (Kimi K2)**: a configuracao é escrita automaticamente.
    - **Kimi Coding**: a configuracao é escrita automaticamente.
    - Mais detalhes: [Moonshot AI (Kimi + Kimi Coding)](/providers/moonshot)
    - **Pular**: nenhuma autenticacao configurada ainda.
    - Escolha um modelo padrao dentre as opcoes detectadas (ou insira provedor/modelo manualmente).
    - O assistente executa uma verificacao de modelo e avisa se o modelo configurado for desconhecido ou estiver sem autenticacao.
    - Credenciais OAuth ficam em `~/.openclaw/credentials/oauth.json`; perfis de auth ficam em `~/.openclaw/agents/<agentId>/agent/auth-profiles.json` (chaves de API + OAuth).
    - Mais detalhes: [/concepts/oauth](/concepts/oauth)
    <Note>
    Dica para headless/servidor: conclua o OAuth em uma maquina com navegador e depois copie
    `~/.openclaw/credentials/oauth.json` (ou `$OPENCLAW_STATE_DIR/credentials/oauth.json`) para o
    host do Gateway.
    </Note>
  </Step>
  <Step title="Workspace">
    - Padrao `~/.openclaw/workspace` (configuravel).
    - Semeia os arquivos de workspace necessarios para o ritual de bootstrap do agente.
    - Layout completo do workspace + guia de backup: [Agent workspace](/concepts/agent-workspace)
  </Step>
  <Step title="Gateway">
    - Porta, bind, modo de auth, exposicao via tailscale.
    - Recomendacao de auth: mantenha **Token** mesmo para loopback para que clientes WS locais precisem se autenticar.
    - Desative a auth apenas se voce confiar totalmente em todos os processos locais.
    - Binds nao-loopback ainda exigem auth.
  </Step>
  <Step title="Canais">
    - [WhatsApp](/channels/whatsapp): login por QR opcional.
    - [Telegram](/channels/telegram): token do bot.
    - [Discord](/channels/discord): token do bot.
    - [Google Chat](/channels/googlechat): JSON de service account + audience do webhook.
    - [Mattermost](/channels/mattermost) (plugin): token do bot + URL base.
    - [Signal](/channels/signal): instalacao opcional de `signal-cli` + configuracao da conta.
    - [BlueBubbles](/channels/bluebubbles): **recomendado para iMessage**; URL do servidor + senha + webhook.
    - [iMessage](/channels/imessage): caminho legado da CLI `imsg` + acesso ao DB.
    - Seguranca de DM: o padrao é pareamento. A primeira DM envia um codigo; aprove via `openclaw pairing approve <channel> <code>` ou use allowlists.
  </Step>
  <Step title="Instalacao do daemon">
    - macOS: LaunchAgent
      - Requer uma sessao de usuario logada; para headless, use um LaunchDaemon customizado (nao fornecido).
    - Linux (e Windows via WSL2): unit de usuario systemd
      - O assistente tenta habilitar lingering via `loginctl enable-linger <user>` para que o Gateway permaneça ativo apos logout.
      - Pode solicitar sudo (escreve `/var/lib/systemd/linger`); ele tenta sem sudo primeiro.
    - **Selecao de runtime:** Node (recomendado; necessario para WhatsApp/Telegram). Bun **nao é recomendado**.
  </Step>
  <Step title="Verificacao de saude">
    - Inicia o Gateway (se necessario) e executa `openclaw health`.
    - Dica: `openclaw status --deep` adiciona probes de saude do gateway à saida de status (requer um gateway acessivel).
  </Step>
  <Step title="Skills (recomendado)">
    - Le as Skills disponiveis e verifica requisitos.
    - Permite escolher um gerenciador de node: **npm / pnpm** (bun nao recomendado).
    - Instala dependencias opcionais (algumas usam Homebrew no macOS).
  </Step>
  <Step title="Finalizar">
    - Resumo + proximos passos, incluindo apps iOS/Android/macOS para recursos extras.
  </Step>
</Steps>

<Note>
Se nenhuma GUI for detectada, o assistente imprime instrucoes de port-forward SSH para a Control UI em vez de abrir um navegador.
Se os assets da Control UI estiverem ausentes, o assistente tenta construi-los; o fallback é `pnpm ui:build` (instala automaticamente as dependencias da UI).
</Note>

## Modo nao interativo

Use `--non-interactive` para automatizar ou criar scripts de integracao inicial:

```bash
openclaw onboard --non-interactive \
  --mode local \
  --auth-choice apiKey \
  --anthropic-api-key "$ANTHROPIC_API_KEY" \
  --gateway-port 18789 \
  --gateway-bind loopback \
  --install-daemon \
  --daemon-runtime node \
  --skip-skills
```

Adicione `--json` para um resumo legivel por maquina.

<Note>
`--json` **nao** implica modo nao interativo. Use `--non-interactive` (e `--workspace`) para scripts.
</Note>

<AccordionGroup>
  <Accordion title="Exemplo Gemini">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice gemini-api-key \
      --gemini-api-key "$GEMINI_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Exemplo Z.AI">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice zai-api-key \
      --zai-api-key "$ZAI_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Exemplo Vercel AI Gateway">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice ai-gateway-api-key \
      --ai-gateway-api-key "$AI_GATEWAY_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Exemplo Cloudflare AI Gateway">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice cloudflare-ai-gateway-api-key \
      --cloudflare-ai-gateway-account-id "your-account-id" \
      --cloudflare-ai-gateway-gateway-id "your-gateway-id" \
      --cloudflare-ai-gateway-api-key "$CLOUDFLARE_AI_GATEWAY_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Exemplo Moonshot">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice moonshot-api-key \
      --moonshot-api-key "$MOONSHOT_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Exemplo Synthetic">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice synthetic-api-key \
      --synthetic-api-key "$SYNTHETIC_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Exemplo OpenCode Zen">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice opencode-zen \
      --opencode-zen-api-key "$OPENCODE_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
</AccordionGroup>

### Adicionar agente (nao interativo)

```bash
openclaw agents add work \
  --workspace ~/.openclaw/workspace-work \
  --model openai/gpt-5.2 \
  --bind whatsapp:biz \
  --non-interactive \
  --json
```

## RPC do assistente do Gateway

O Gateway expõe o fluxo do assistente via RPC (`wizard.start`, `wizard.next`, `wizard.cancel`, `wizard.status`).
Clientes (app macOS, Control UI) podem renderizar etapas sem reimplementar a logica de integracao inicial.

## Configuracao do Signal (signal-cli)

O assistente pode instalar `signal-cli` a partir dos releases do GitHub:

- Faz o download do asset de release apropriado.
- Armazena em `~/.openclaw/tools/signal-cli/<version>/`.
- Escreve `channels.signal.cliPath` na sua configuracao.

Notas:

- Builds JVM exigem **Java 21**.
- Builds nativos sao usados quando disponiveis.
- O Windows usa WSL2; a instalacao do signal-cli segue o fluxo Linux dentro do WSL.

## O que o assistente escreve

Campos tipicos em `~/.openclaw/openclaw.json`:

- `agents.defaults.workspace`
- `agents.defaults.model` / `models.providers` (se Minimax for escolhido)
- `gateway.*` (modo, bind, auth, tailscale)
- `channels.telegram.botToken`, `channels.discord.token`, `channels.signal.*`, `channels.imessage.*`
- Allowlists de canais (Slack/Discord/Matrix/Microsoft Teams) quando voce opta por elas durante os prompts (nomes resolvem para IDs quando possivel).
- `skills.install.nodeManager`
- `wizard.lastRunAt`
- `wizard.lastRunVersion`
- `wizard.lastRunCommit`
- `wizard.lastRunCommand`
- `wizard.lastRunMode`

`openclaw agents add` escreve `agents.list[]` e `bindings` opcional.

Credenciais do WhatsApp ficam em `~/.openclaw/credentials/whatsapp/<accountId>/`.
Sessoes sao armazenadas em `~/.openclaw/agents/<agentId>/sessions/`.

Alguns canais sao entregues como plugins. Quando voce escolhe um durante a integracao inicial, o assistente
solicita a instalacao (npm ou um caminho local) antes que ele possa ser configurado.

## Docs relacionados

- Visao geral do assistente: [Onboarding Wizard](/start/wizard)
- Integracao inicial do app macOS: [Onboarding](/start/onboarding)
- Referencia de configuracao: [Gateway configuration](/gateway/configuration)
- Provedores: [WhatsApp](/channels/whatsapp), [Telegram](/channels/telegram), [Discord](/channels/discord), [Google Chat](/channels/googlechat), [Signal](/channels/signal), [BlueBubbles](/channels/bluebubbles) (iMessage), [iMessage](/channels/imessage) (legado)
- Skills: [Skills](/tools/skills), [Skills config](/tools/skills-config)
