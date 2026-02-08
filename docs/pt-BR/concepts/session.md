---
summary: "Regras de gerenciamento de sessoes, chaves e persistencia para chats"
read_when:
  - Modificando o tratamento ou armazenamento de sessoes
title: "Gerenciamento de Sessoes"
x-i18n:
  source_path: concepts/session.md
  source_hash: 1486759a5c2fdced
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:19Z
---

# Gerenciamento de Sessoes

O OpenClaw trata **uma sessao de chat direto por agente** como primaria. Chats diretos colapsam para `agent:<agentId>:<mainKey>` (padrao `main`), enquanto chats em grupo/canal recebem suas proprias chaves. `session.mainKey` e respeitado.

Use `session.dmScope` para controlar como **mensagens diretas** sao agrupadas:

- `main` (padrao): todas as DMs compartilham a sessao principal para continuidade.
- `per-peer`: isolar por id do remetente entre canais.
- `per-channel-peer`: isolar por canal + remetente (recomendado para caixas de entrada multiusuario).
- `per-account-channel-peer`: isolar por conta + canal + remetente (recomendado para caixas de entrada multicontas).
  Use `session.identityLinks` para mapear ids de pares com prefixo de provedor para uma identidade canonica, de modo que a mesma pessoa compartilhe uma sessao de DM entre canais ao usar `per-peer`, `per-channel-peer` ou `per-account-channel-peer`.

### Modo DM seguro (recomendado para configuracoes multiusuario)

> **Aviso de seguranca:** Se seu agente pode receber DMs de **varias pessoas**, voce deve considerar fortemente habilitar o modo DM seguro. Sem ele, todos os usuarios compartilham o mesmo contexto de conversa, o que pode vazar informacoes privadas entre usuarios.

**Exemplo do problema com as configuracoes padrao:**

- Alice (`<SENDER_A>`) envia uma mensagem ao seu agente sobre um assunto privado (por exemplo, uma consulta medica)
- Bob (`<SENDER_B>`) envia uma mensagem ao seu agente perguntando "Sobre o que estavamos falando?"
- Como ambas as DMs compartilham a mesma sessao, o modelo pode responder a Bob usando o contexto anterior de Alice.

**A solucao:** Defina `dmScope` para isolar sessoes por usuario:

```json5
// ~/.openclaw/openclaw.json
{
  session: {
    // Secure DM mode: isolate DM context per channel + sender.
    dmScope: "per-channel-peer",
  },
}
```

**Quando habilitar isso:**

- Voce tem aprovacoes de pareamento para mais de um remetente
- Voce usa uma allowlist de DM com varias entradas
- Voce define `dmPolicy: "open"`
- Varios numeros de telefone ou contas podem enviar mensagens ao seu agente

Notas:

- O padrao e `dmScope: "main"` para continuidade (todas as DMs compartilham a sessao principal). Isso e adequado para configuracoes de usuario unico.
- Para caixas de entrada multicontas no mesmo canal, prefira `per-account-channel-peer`.
- Se a mesma pessoa entra em contato com voce em varios canais, use `session.identityLinks` para colapsar suas sessoes de DM em uma unica identidade canonica.
- Voce pode verificar suas configuracoes de DM com `openclaw security audit` (veja [security](/cli/security)).

## Gateway e a fonte da verdade

Todo o estado de sessao e **de propriedade do gateway** (o OpenClaw “mestre”). Clientes de UI (app macOS, WebChat, etc.) devem consultar o gateway para listas de sessoes e contagens de tokens, em vez de ler arquivos locais.

- Em **modo remoto**, o armazenamento de sessoes que importa fica no host do gateway remoto, nao no seu Mac.
- As contagens de tokens mostradas nas UIs vem dos campos de armazenamento do gateway (`inputTokens`, `outputTokens`, `totalTokens`, `contextTokens`). Os clientes nao fazem parsing de transcricoes JSONL para “ajustar” totais.

## Onde o estado vive

- No **host do gateway**:
  - Arquivo de armazenamento: `~/.openclaw/agents/<agentId>/sessions/sessions.json` (por agente).
- Transcricoes: `~/.openclaw/agents/<agentId>/sessions/<SessionId>.jsonl` (sessoes de topicos do Telegram usam `.../<SessionId>-topic-<threadId>.jsonl`).
- O armazenamento e um mapa `sessionKey -> { sessionId, updatedAt, ... }`. Excluir entradas e seguro; elas sao recriadas sob demanda.
- Entradas de grupo podem incluir `displayName`, `channel`, `subject`, `room` e `space` para rotular sessoes nas UIs.
- Entradas de sessao incluem metadados `origin` (rotulo + dicas de roteamento) para que as UIs possam explicar de onde veio uma sessao.
- O OpenClaw **nao** le pastas legadas de sessao do Pi/Tau.

## Poda de sessoes

O OpenClaw remove **resultados antigos de ferramentas** do contexto em memoria imediatamente antes de chamadas ao LLM por padrao.
Isso **nao** reescreve o historico JSONL. Veja [/concepts/session-pruning](/concepts/session-pruning).

## Limpeza de memoria pre-compactacao

Quando uma sessao se aproxima da auto-compactacao, o OpenClaw pode executar uma **limpeza silenciosa de memoria**
que lembra o modelo de escrever notas duraveis em disco. Isso so ocorre quando
o workspace e gravavel. Veja [Memory](/concepts/memory) e
[Compaction](/concepts/compaction).

## Mapeamento de transportes → chaves de sessao

- Chats diretos seguem `session.dmScope` (padrao `main`).
  - `main`: `agent:<agentId>:<mainKey>` (continuidade entre dispositivos/canais).
    - Varios numeros de telefone e canais podem mapear para a mesma chave principal do agente; eles atuam como transportes para uma unica conversa.
  - `per-peer`: `agent:<agentId>:dm:<peerId>`.
  - `per-channel-peer`: `agent:<agentId>:<channel>:dm:<peerId>`.
  - `per-account-channel-peer`: `agent:<agentId>:<channel>:<accountId>:dm:<peerId>` (accountId padrao e `default`).
  - Se `session.identityLinks` corresponder a um id de par com prefixo de provedor (por exemplo `telegram:123`), a chave canonica substitui `<peerId>` para que a mesma pessoa compartilhe uma sessao entre canais.
- Chats em grupo isolam estado: `agent:<agentId>:<channel>:group:<id>` (salas/canais usam `agent:<agentId>:<channel>:channel:<id>`).
  - Topicos de forum do Telegram adicionam `:topic:<threadId>` ao id do grupo para isolamento.
  - Chaves legadas `group:<id>` ainda sao reconhecidas para migracao.
- Contextos de entrada ainda podem usar `group:<id>`; o canal e inferido a partir de `Provider` e normalizado para a forma canonica `agent:<agentId>:<channel>:group:<id>`.
- Outras fontes:
  - Tarefas cron: `cron:<job.id>`
  - Webhooks: `hook:<uuid>` (a menos que explicitamente definido pelo hook)
  - Execucoes de node: `node-<nodeId>`

## Ciclo de vida

- Politica de reset: sessoes sao reutilizadas ate expirarem, e a expiracao e avaliada na proxima mensagem de entrada.
- Reset diario: padrao **4:00 da manha no horario local do host do gateway**. Uma sessao fica obsoleta quando sua ultima atualizacao e anterior ao horario de reset diario mais recente.
- Reset por inatividade (opcional): `idleMinutes` adiciona uma janela deslizante de inatividade. Quando reset diario e por inatividade estao configurados, **o que expirar primeiro** força uma nova sessao.
- Inatividade legada apenas: se voce definir `session.idleMinutes` sem nenhuma configuracao `session.reset`/`resetByType`, o OpenClaw permanece em modo somente inatividade por compatibilidade retroativa.
- Substituicoes por tipo (opcional): `resetByType` permite substituir a politica para sessoes `dm`, `group` e `thread` (thread = threads do Slack/Discord, topicos do Telegram, threads do Matrix quando fornecidas pelo conector).
- Substituicoes por canal (opcional): `resetByChannel` substitui a politica de reset para um canal (aplica-se a todos os tipos de sessao desse canal e tem precedencia sobre `reset`/`resetByType`).
- Disparadores de reset: `/new` ou `/reset` exatos (mais quaisquer extras em `resetTriggers`) iniciam um novo id de sessao e passam o restante da mensagem. `/new <model>` aceita um alias de modelo, `provider/model` ou nome do provedor (correspondencia aproximada) para definir o novo modelo da sessao. Se `/new` ou `/reset` for enviado sozinho, o OpenClaw executa um curto turno de saudacao “hello” para confirmar o reset.
- Reset manual: exclua chaves especificas do armazenamento ou remova a transcricao JSONL; a proxima mensagem as recria.
- Tarefas cron isoladas sempre criam um novo `sessionId` por execucao (sem reutilizacao por inatividade).

## Politica de envio (opcional)

Bloqueie a entrega para tipos especificos de sessao sem listar ids individuais.

```json5
{
  session: {
    sendPolicy: {
      rules: [
        { action: "deny", match: { channel: "discord", chatType: "group" } },
        { action: "deny", match: { keyPrefix: "cron:" } },
      ],
      default: "allow",
    },
  },
}
```

Substituicao em tempo de execucao (apenas dono):

- `/send on` → permitir para esta sessao
- `/send off` → negar para esta sessao
- `/send inherit` → limpar substituicao e usar as regras de configuracao
  Envie como mensagens independentes para que sejam registradas.

## Configuracao (exemplo opcional de renomeacao)

```json5
// ~/.openclaw/openclaw.json
{
  session: {
    scope: "per-sender", // keep group keys separate
    dmScope: "main", // DM continuity (set per-channel-peer/per-account-channel-peer for shared inboxes)
    identityLinks: {
      alice: ["telegram:123456789", "discord:987654321012345678"],
    },
    reset: {
      // Defaults: mode=daily, atHour=4 (gateway host local time).
      // If you also set idleMinutes, whichever expires first wins.
      mode: "daily",
      atHour: 4,
      idleMinutes: 120,
    },
    resetByType: {
      thread: { mode: "daily", atHour: 4 },
      dm: { mode: "idle", idleMinutes: 240 },
      group: { mode: "idle", idleMinutes: 120 },
    },
    resetByChannel: {
      discord: { mode: "idle", idleMinutes: 10080 },
    },
    resetTriggers: ["/new", "/reset"],
    store: "~/.openclaw/agents/{agentId}/sessions/sessions.json",
    mainKey: "main",
  },
}
```

## Inspecao

- `openclaw status` — mostra o caminho do armazenamento e sessoes recentes.
- `openclaw sessions --json` — despeja todas as entradas (filtre com `--active <minutes>`).
- `openclaw gateway call sessions.list --params '{}'` — busca sessoes do gateway em execucao (use `--url`/`--token` para acesso a gateway remoto).
- Envie `/status` como uma mensagem independente no chat para ver se o agente esta acessivel, quanto do contexto da sessao esta sendo usado, alternancias atuais de pensamento/verboso e quando suas credenciais do WhatsApp web foram atualizadas pela ultima vez (ajuda a identificar necessidade de reconexao).
- Envie `/context list` ou `/context detail` para ver o que esta no prompt do sistema e nos arquivos de workspace injetados (e os maiores contribuintes de contexto).
- Envie `/stop` como uma mensagem independente para abortar a execucao atual, limpar acompanhamentos enfileirados para essa sessao e parar quaisquer execucoes de subagentes geradas a partir dela (a resposta inclui a contagem interrompida).
- Envie `/compact` (instrucoes opcionais) como uma mensagem independente para resumir contexto antigo e liberar espaco de janela. Veja [/concepts/compaction](/concepts/compaction).
- Transcricoes JSONL podem ser abertas diretamente para revisar turnos completos.

## Dicas

- Mantenha a chave primaria dedicada ao trafego 1:1; deixe grupos manterem suas proprias chaves.
- Ao automatizar limpeza, exclua chaves individuais em vez de todo o armazenamento para preservar contexto em outros lugares.

## Metadados de origem da sessao

Cada entrada de sessao registra de onde veio (best-effort) em `origin`:

- `label`: rotulo humano (resolvido a partir do rotulo da conversa + assunto do grupo/canal)
- `provider`: id de canal normalizado (incluindo extensoes)
- `from`/`to`: ids brutos de roteamento do envelope de entrada
- `accountId`: id da conta do provedor (quando multicontas)
- `threadId`: id de thread/topico quando o canal oferece suporte
  Os campos de origem sao preenchidos para mensagens diretas, canais e grupos. Se um
  conector apenas atualiza o roteamento de entrega (por exemplo, para manter uma sessao
  principal de DM atualizada), ele ainda deve fornecer contexto de entrada para que a sessao
  mantenha seus metadados explicativos. Extensoes podem fazer isso enviando `ConversationLabel`,
  `GroupSubject`, `GroupChannel`, `GroupSpace` e `SenderName` no contexto de entrada
  e chamando `recordSessionMetaFromInbound` (ou passando o mesmo contexto
  para `updateLastRoute`).
