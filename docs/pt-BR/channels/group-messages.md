---
summary: "Comportamento e configuracao para o tratamento de mensagens de grupo do WhatsApp (mentionPatterns sao compartilhados entre superficies)"
read_when:
  - Alterando regras de mensagens de grupo ou mencoes
title: "Mensagens de Grupo"
x-i18n:
  source_path: channels/group-messages.md
  source_hash: 181a72f12f5021af
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:16Z
---

# Mensagens de grupo (canal web do WhatsApp)

Objetivo: permitir que o Clawd fique em grupos do WhatsApp, acorde apenas quando for acionado e mantenha essa thread separada da sessao de Mensagem direta pessoal.

Observacao: `agents.list[].groupChat.mentionPatterns` agora tambem e usado por Telegram/Discord/Slack/iMessage; este doc foca no comportamento especifico do WhatsApp. Para configuracoes com multiplos agentes, defina `agents.list[].groupChat.mentionPatterns` por agente (ou use `messages.groupChat.mentionPatterns` como fallback global).

## O que esta implementado (2025-12-03)

- Modos de ativacao: `mention` (padrao) ou `always`. `mention` exige um ping (mencoes reais do WhatsApp com @ via `mentionedJids`, padroes regex ou o E.164 do bot em qualquer lugar do texto). `always` acorda o agente em toda mensagem, mas ele deve responder apenas quando puder agregar valor significativo; caso contrario, retorna o token silencioso `NO_REPLY`. Os padroes podem ser definidos na configuracao (`channels.whatsapp.groups`) e sobrescritos por grupo via `/activation`. Quando `channels.whatsapp.groups` esta definido, ele tambem atua como uma allowlist de grupos (inclua `"*"` para permitir todos).
- Politica de grupo: `channels.whatsapp.groupPolicy` controla se mensagens de grupo sao aceitas (`open|disabled|allowlist`). `allowlist` usa `channels.whatsapp.groupAllowFrom` (fallback: `channels.whatsapp.allowFrom` explicito). O padrao e `allowlist` (bloqueado ate voce adicionar remetentes).
- Sessoes por grupo: chaves de sessao se parecem com `agent:<agentId>:whatsapp:group:<jid>`, portanto comandos como `/verbose on` ou `/think high` (enviados como mensagens isoladas) ficam restritos a esse grupo; o estado da Mensagem direta pessoal permanece intacto. Heartbeats sao ignorados para threads de grupo.
- Injecao de contexto: mensagens de grupo **apenas pendentes** (padrao 50) que _nao_ dispararam uma execucao sao prefixadas sob `[Chat messages since your last reply - for context]`, com a linha acionadora sob `[Current message - respond to this]`. Mensagens ja presentes na sessao nao sao reinjetadas.
- Exposicao do remetente: cada lote de grupo agora termina com `[from: Sender Name (+E164)]` para que o Pi saiba quem esta falando.
- Efemeras/view-once: nos desembrulhamos essas mensagens antes de extrair texto/mencoes, para que pings dentro delas ainda acionem.
- Prompt de sistema do grupo: no primeiro turno de uma sessao de grupo (e sempre que `/activation` muda o modo) injetamos um breve texto no prompt do sistema como `You are replying inside the WhatsApp group "<subject>". Group members: Alice (+44...), Bob (+43...), … Activation: trigger-only … Address the specific sender noted in the message context.`. Se os metadados nao estiverem disponiveis, ainda informamos ao agente que e um chat em grupo.

## Exemplo de configuracao (WhatsApp)

Adicione um bloco `groupChat` ao `~/.openclaw/openclaw.json` para que pings por nome de exibicao funcionem mesmo quando o WhatsApp remove o `@` visual no corpo do texto:

```json5
{
  channels: {
    whatsapp: {
      groups: {
        "*": { requireMention: true },
      },
    },
  },
  agents: {
    list: [
      {
        id: "main",
        groupChat: {
          historyLimit: 50,
          mentionPatterns: ["@?openclaw", "\\+?15555550123"],
        },
      },
    ],
  },
}
```

Notas:

- As regex sao case-insensitive; elas cobrem um ping por nome de exibicao como `@openclaw` e o numero bruto com ou sem `+`/espacos.
- O WhatsApp ainda envia mencoes canonicas via `mentionedJids` quando alguem toca no contato, entao o fallback por numero raramente e necessario, mas e uma rede de seguranca util.

### Comando de ativacao (somente dono)

Use o comando no chat do grupo:

- `/activation mention`
- `/activation always`

Apenas o numero do dono (de `channels.whatsapp.allowFrom`, ou o E.164 do proprio bot quando nao definido) pode alterar isso. Envie `/status` como uma mensagem isolada no grupo para ver o modo de ativacao atual.

## Como usar

1. Adicione sua conta do WhatsApp (a que executa o OpenClaw) ao grupo.
2. Diga `@openclaw …` (ou inclua o numero). Apenas remetentes em allowlist podem acionar, a menos que voce defina `groupPolicy: "open"`.
3. O prompt do agente incluira o contexto recente do grupo mais o marcador final `[from: …]` para que ele possa se dirigir a pessoa certa.
4. Diretivas em nivel de sessao (`/verbose on`, `/think high`, `/new` ou `/reset`, `/compact`) se aplicam apenas a sessao desse grupo; envie-as como mensagens isoladas para que sejam registradas. Sua sessao de Mensagem direta pessoal permanece independente.

## Testes / verificacao

- Smoke manual:
  - Envie um ping `@openclaw` no grupo e confirme uma resposta que referencia o nome do remetente.
  - Envie um segundo ping e verifique se o bloco de historico e incluido e depois limpo no proximo turno.
- Verifique os logs do gateway (execute com `--verbose`) para ver entradas `inbound web message` mostrando `from: <groupJid>` e o sufixo `[from: …]`.

## Consideracoes conhecidas

- Heartbeats sao intencionalmente ignorados para grupos para evitar transmissao ruidosa.
- A supressao de eco usa a string combinada do lote; se voce enviar texto identico duas vezes sem mencoes, apenas o primeiro recebera resposta.
- Entradas do store de sessao aparecerao como `agent:<agentId>:whatsapp:group:<jid>` no store de sessao (`~/.openclaw/agents/<agentId>/sessions/sessions.json` por padrao); uma entrada ausente apenas significa que o grupo ainda nao disparou uma execucao.
- Indicadores de digitacao em grupos seguem `agents.defaults.typingMode` (padrao: `message` quando nao mencionado).
