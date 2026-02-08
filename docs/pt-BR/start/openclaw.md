---
summary: "Guia de ponta a ponta para executar o OpenClaw como um assistente pessoal com cuidados de segurança"
read_when:
  - Integracao inicial de uma nova instancia de assistente
  - Revisao das implicacoes de seguranca/permissoes
title: "Configuracao do Assistente Pessoal"
x-i18n:
  source_path: start/openclaw.md
  source_hash: 55cd0c67e5e3b28e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:32Z
---

# Construindo um assistente pessoal com OpenClaw

O OpenClaw é um gateway de WhatsApp + Telegram + Discord + iMessage para agentes **Pi**. Plugins adicionam Mattermost. Este guia é a configuracao de “assistente pessoal”: um numero de WhatsApp dedicado que se comporta como seu agente sempre ativo.

## ⚠️ Seguranca em primeiro lugar

Voce esta colocando um agente em uma posicao para:

- executar comandos na sua maquina (dependendo da configuracao da sua ferramenta Pi)
- ler/gravar arquivos no seu workspace
- enviar mensagens de volta via WhatsApp/Telegram/Discord/Mattermost (plugin)

Comece de forma conservadora:

- Sempre defina `channels.whatsapp.allowFrom` (nunca execute aberto para o mundo no seu Mac pessoal).
- Use um numero de WhatsApp dedicado para o assistente.
- Heartbeats agora padrao a cada 30 minutos. Desative ate confiar na configuracao definindo `agents.defaults.heartbeat.every: "0m"`.

## Pre-requisitos

- OpenClaw instalado e com integracao inicial concluida — veja [Primeiros Passos](/start/getting-started) se ainda nao fez isso
- Um segundo numero de telefone (SIM/eSIM/pre-pago) para o assistente

## A configuracao com dois telefones (recomendada)

Voce quer isto:

```
Your Phone (personal)          Second Phone (assistant)
┌─────────────────┐           ┌─────────────────┐
│  Your WhatsApp  │  ──────▶  │  Assistant WA   │
│  +1-555-YOU     │  message  │  +1-555-ASSIST  │
└─────────────────┘           └────────┬────────┘
                                       │ linked via QR
                                       ▼
                              ┌─────────────────┐
                              │  Your Mac       │
                              │  (openclaw)      │
                              │    Pi agent     │
                              └─────────────────┘
```

Se voce vincular seu WhatsApp pessoal ao OpenClaw, cada mensagem para voce se torna “entrada do agente”. Isso raramente e o que voce quer.

## Inicio rapido de 5 minutos

1. Pareie o WhatsApp Web (mostra QR; escaneie com o telefone do assistente):

```bash
openclaw channels login
```

2. Inicie o Gateway (deixe-o em execucao):

```bash
openclaw gateway --port 18789
```

3. Coloque uma configuracao minima em `~/.openclaw/openclaw.json`:

```json5
{
  channels: { whatsapp: { allowFrom: ["+15555550123"] } },
}
```

Agora envie uma mensagem para o numero do assistente a partir do seu telefone na allowlist.

Quando a integracao inicial terminar, abrimos automaticamente o dashboard e imprimimos um link limpo (sem token). Se solicitar autenticacao, cole o token de `gateway.auth.token` nas configuracoes da Control UI. Para reabrir depois: `openclaw dashboard`.

## Dê um workspace ao agente (AGENTS)

O OpenClaw le instrucoes operacionais e “memoria” a partir do diretorio de workspace.

Por padrao, o OpenClaw usa `~/.openclaw/workspace` como o workspace do agente, e o criara (mais os iniciais `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`) automaticamente na configuracao/primeira execucao do agente. `BOOTSTRAP.md` e criado apenas quando o workspace e totalmente novo (ele nao deve voltar depois que voce o apagar).

Dica: trate esta pasta como a “memoria” do OpenClaw e torne-a um repositorio git (idealmente privado) para que seus `AGENTS.md` + arquivos de memoria tenham backup. Se o git estiver instalado, workspaces totalmente novos sao inicializados automaticamente.

```bash
openclaw setup
```

Layout completo do workspace + guia de backup: [Workspace do agente](/concepts/agent-workspace)
Fluxo de trabalho de memoria: [Memoria](/concepts/memory)

Opcional: escolha um workspace diferente com `agents.defaults.workspace` (suporta `~`).

```json5
{
  agent: {
    workspace: "~/.openclaw/workspace",
  },
}
```

Se voce ja distribui seus proprios arquivos de workspace a partir de um repo, pode desativar totalmente a criacao de arquivos de bootstrap:

```json5
{
  agent: {
    skipBootstrap: true,
  },
}
```

## A configuracao que o transforma em “um assistente”

O OpenClaw vem por padrao com uma boa configuracao de assistente, mas geralmente voce vai querer ajustar:

- persona/instrucoes em `SOUL.md`
- padroes de raciocinio (se desejado)
- heartbeats (depois que confiar)

Exemplo:

```json5
{
  logging: { level: "info" },
  agent: {
    model: "anthropic/claude-opus-4-6",
    workspace: "~/.openclaw/workspace",
    thinkingDefault: "high",
    timeoutSeconds: 1800,
    // Start with 0; enable later.
    heartbeat: { every: "0m" },
  },
  channels: {
    whatsapp: {
      allowFrom: ["+15555550123"],
      groups: {
        "*": { requireMention: true },
      },
    },
  },
  routing: {
    groupChat: {
      mentionPatterns: ["@openclaw", "openclaw"],
    },
  },
  session: {
    scope: "per-sender",
    resetTriggers: ["/new", "/reset"],
    reset: {
      mode: "daily",
      atHour: 4,
      idleMinutes: 10080,
    },
  },
}
```

## Sessoes e memoria

- Arquivos de sessao: `~/.openclaw/agents/<agentId>/sessions/{{SessionId}}.jsonl`
- Metadados de sessao (uso de tokens, ultima rota, etc): `~/.openclaw/agents/<agentId>/sessions/sessions.json` (legado: `~/.openclaw/sessions/sessions.json`)
- `/new` ou `/reset` inicia uma nova sessao para aquele chat (configuravel via `resetTriggers`). Se enviado sozinho, o agente responde com um breve ola para confirmar o reset.
- `/compact [instructions]` compacta o contexto da sessao e informa o orcamento de contexto restante.

## Heartbeats (modo proativo)

Por padrao, o OpenClaw executa um heartbeat a cada 30 minutos com o prompt:
`Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.`
Defina `agents.defaults.heartbeat.every: "0m"` para desativar.

- Se `HEARTBEAT.md` existir mas estiver efetivamente vazio (apenas linhas em branco e cabecalhos markdown como `# Heading`), o OpenClaw ignora a execucao do heartbeat para economizar chamadas de API.
- Se o arquivo estiver ausente, o heartbeat ainda e executado e o modelo decide o que fazer.
- Se o agente responder com `HEARTBEAT_OK` (opcionalmente com pequeno padding; veja `agents.defaults.heartbeat.ackMaxChars`), o OpenClaw suprime o envio externo para aquele heartbeat.
- Heartbeats executam turnos completos do agente — intervalos mais curtos consomem mais tokens.

```json5
{
  agent: {
    heartbeat: { every: "30m" },
  },
}
```

## Midia de entrada e saida

Anexos de entrada (imagens/audio/docs) podem ser expostos ao seu comando via templates:

- `{{MediaPath}}` (caminho local de arquivo temporario)
- `{{MediaUrl}}` (pseudo-URL)
- `{{Transcript}}` (se a transcricao de audio estiver habilitada)

Anexos de saida do agente: inclua `MEDIA:<path-or-url>` em uma linha isolada (sem espacos). Exemplo:

```
Here’s the screenshot.
MEDIA:https://example.com/screenshot.png
```

O OpenClaw extrai isso e envia como midia junto com o texto.

## Checklist operacional

```bash
openclaw status          # local status (creds, sessions, queued events)
openclaw status --all    # full diagnosis (read-only, pasteable)
openclaw status --deep   # adds gateway health probes (Telegram + Discord)
openclaw health --json   # gateway health snapshot (WS)
```

Logs ficam em `/tmp/openclaw/` (padrao: `openclaw-YYYY-MM-DD.log`).

## Proximos passos

- WebChat: [WebChat](/web/webchat)
- Operacoes do Gateway: [Runbook do Gateway](/gateway)
- Cron + wakeups: [Jobs Cron](/automation/cron-jobs)
- Aplicativo complementar da barra de menus do macOS: [OpenClaw macOS app](/platforms/macos)
- App node para iOS: [iOS app](/platforms/ios)
- App node para Android: [Android app](/platforms/android)
- Status do Windows: [Windows (WSL2)](/platforms/windows)
- Status do Linux: [Linux app](/platforms/linux)
- Seguranca: [Seguranca](/gateway/security)
