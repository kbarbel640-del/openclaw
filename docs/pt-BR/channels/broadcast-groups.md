---
summary: "Transmitir uma mensagem do WhatsApp para varios agentes"
read_when:
  - Configurando grupos de broadcast
  - Depurando respostas multiagente no WhatsApp
status: experimental
title: "Grupos de Broadcast"
x-i18n:
  source_path: channels/broadcast-groups.md
  source_hash: 25866bc0d519552d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:19Z
---

# Grupos de Broadcast

**Status:** Experimental  
**Versao:** Adicionado em 2026.1.9

## Visao geral

Grupos de Broadcast permitem que varios agentes processem e respondam a mesma mensagem simultaneamente. Isso permite criar equipes de agentes especializados que trabalham juntos em um unico grupo do WhatsApp ou Mensagem direta — tudo usando um unico numero de telefone.

Escopo atual: **apenas WhatsApp** (canal web).

Os grupos de broadcast sao avaliados apos as allowlists de canal e as regras de ativacao de grupo. Em grupos do WhatsApp, isso significa que os broadcasts acontecem quando o OpenClaw normalmente responderia (por exemplo: ao ser mencionado, dependendo das configuracoes do grupo).

## Casos de uso

### 1. Equipes de agentes especializados

Implante varios agentes com responsabilidades atomicas e focadas:

```
Group: "Development Team"
Agents:
  - CodeReviewer (reviews code snippets)
  - DocumentationBot (generates docs)
  - SecurityAuditor (checks for vulnerabilities)
  - TestGenerator (suggests test cases)
```

Cada agente processa a mesma mensagem e fornece sua perspectiva especializada.

### 2. Suporte multilingue

```
Group: "International Support"
Agents:
  - Agent_EN (responds in English)
  - Agent_DE (responds in German)
  - Agent_ES (responds in Spanish)
```

### 3. Fluxos de trabalho de garantia de qualidade

```
Group: "Customer Support"
Agents:
  - SupportAgent (provides answer)
  - QAAgent (reviews quality, only responds if issues found)
```

### 4. Automacao de tarefas

```
Group: "Project Management"
Agents:
  - TaskTracker (updates task database)
  - TimeLogger (logs time spent)
  - ReportGenerator (creates summaries)
```

## Configuracao

### Configuracao basica

Adicione uma secao de nivel superior `broadcast` (ao lado de `bindings`). As chaves sao IDs de peer do WhatsApp:

- chats em grupo: JID do grupo (ex.: `120363403215116621@g.us`)
- Mensagens diretas: numero de telefone E.164 (ex.: `+15551234567`)

```json
{
  "broadcast": {
    "120363403215116621@g.us": ["alfred", "baerbel", "assistant3"]
  }
}
```

**Resultado:** Quando o OpenClaw responderia neste chat, ele executara todos os tres agentes.

### Estrategia de processamento

Controle como os agentes processam mensagens:

#### Paralelo (Padrao)

Todos os agentes processam simultaneamente:

```json
{
  "broadcast": {
    "strategy": "parallel",
    "120363403215116621@g.us": ["alfred", "baerbel"]
  }
}
```

#### Sequencial

Os agentes processam em ordem (um espera o anterior terminar):

```json
{
  "broadcast": {
    "strategy": "sequential",
    "120363403215116621@g.us": ["alfred", "baerbel"]
  }
}
```

### Exemplo completo

```json
{
  "agents": {
    "list": [
      {
        "id": "code-reviewer",
        "name": "Code Reviewer",
        "workspace": "/path/to/code-reviewer",
        "sandbox": { "mode": "all" }
      },
      {
        "id": "security-auditor",
        "name": "Security Auditor",
        "workspace": "/path/to/security-auditor",
        "sandbox": { "mode": "all" }
      },
      {
        "id": "docs-generator",
        "name": "Documentation Generator",
        "workspace": "/path/to/docs-generator",
        "sandbox": { "mode": "all" }
      }
    ]
  },
  "broadcast": {
    "strategy": "parallel",
    "120363403215116621@g.us": ["code-reviewer", "security-auditor", "docs-generator"],
    "120363424282127706@g.us": ["support-en", "support-de"],
    "+15555550123": ["assistant", "logger"]
  }
}
```

## Como funciona

### Fluxo de mensagens

1. **Mensagem recebida** chega em um grupo do WhatsApp
2. **Verificacao de broadcast**: o sistema verifica se o ID do peer esta em `broadcast`
3. **Se estiver na lista de broadcast**:
   - Todos os agentes listados processam a mensagem
   - Cada agente tem sua propria chave de sessao e contexto isolado
   - Os agentes processam em paralelo (padrao) ou sequencialmente
4. **Se nao estiver na lista de broadcast**:
   - O roteamento normal se aplica (primeiro binding correspondente)

Observacao: grupos de broadcast nao ignoram allowlists de canal nem regras de ativacao de grupo (mencoes/comandos/etc). Eles apenas mudam _quais agentes sao executados_ quando uma mensagem esta qualificada para processamento.

### Isolamento de sessao

Cada agente em um grupo de broadcast mantem completamente separado:

- **Chaves de sessao** (`agent:alfred:whatsapp:group:120363...` vs `agent:baerbel:whatsapp:group:120363...`)
- **Historico de conversa** (o agente nao ve as mensagens de outros agentes)
- **Espaco de trabalho** (sandboxes separados, se configurado)
- **Acesso a ferramentas** (listas diferentes de permitir/negar)
- **Memoria/contexto** (IDENTITY.md, SOUL.md, etc. separados)
- **Buffer de contexto do grupo** (mensagens recentes do grupo usadas para contexto) e compartilhado por peer, entao todos os agentes de broadcast veem o mesmo contexto quando acionados

Isso permite que cada agente tenha:

- Personalidades diferentes
- Acesso a ferramentas diferente (por exemplo, somente leitura vs. leitura e escrita)
- Modelos diferentes (por exemplo, opus vs. sonnet)
- Skills diferentes instaladas

### Exemplo: sessoes isoladas

No grupo `120363403215116621@g.us` com os agentes `["alfred", "baerbel"]`:

**Contexto do Alfred:**

```
Session: agent:alfred:whatsapp:group:120363403215116621@g.us
History: [user message, alfred's previous responses]
Workspace: /Users/pascal/openclaw-alfred/
Tools: read, write, exec
```

**Contexto da Bärbel:**

```
Session: agent:baerbel:whatsapp:group:120363403215116621@g.us
History: [user message, baerbel's previous responses]
Workspace: /Users/pascal/openclaw-baerbel/
Tools: read only
```

## Boas praticas

### 1. Mantenha os agentes focados

Projete cada agente com uma unica responsabilidade clara:

```json
{
  "broadcast": {
    "DEV_GROUP": ["formatter", "linter", "tester"]
  }
}
```

✅ **Bom:** Cada agente tem um unico trabalho  
❌ **Ruim:** Um unico agente generico "dev-helper"

### 2. Use nomes descritivos

Deixe claro o que cada agente faz:

```json
{
  "agents": {
    "security-scanner": { "name": "Security Scanner" },
    "code-formatter": { "name": "Code Formatter" },
    "test-generator": { "name": "Test Generator" }
  }
}
```

### 3. Configure acessos a ferramentas diferentes

Conceda aos agentes apenas as ferramentas de que precisam:

```json
{
  "agents": {
    "reviewer": {
      "tools": { "allow": ["read", "exec"] } // Read-only
    },
    "fixer": {
      "tools": { "allow": ["read", "write", "edit", "exec"] } // Read-write
    }
  }
}
```

### 4. Monitore o desempenho

Com muitos agentes, considere:

- Usar `"strategy": "parallel"` (padrao) para velocidade
- Limitar grupos de broadcast a 5–10 agentes
- Usar modelos mais rapidos para agentes mais simples

### 5. Lide com falhas de forma elegante

Os agentes falham de forma independente. O erro de um agente nao bloqueia os outros:

```
Message → [Agent A ✓, Agent B ✗ error, Agent C ✓]
Result: Agent A and C respond, Agent B logs error
```

## Compatibilidade

### Provedores

Os grupos de broadcast atualmente funcionam com:

- ✅ WhatsApp (implementado)
- 🚧 Telegram (planejado)
- 🚧 Discord (planejado)
- 🚧 Slack (planejado)

### Roteamento

Os grupos de broadcast funcionam junto com o roteamento existente:

```json
{
  "bindings": [
    {
      "match": { "channel": "whatsapp", "peer": { "kind": "group", "id": "GROUP_A" } },
      "agentId": "alfred"
    }
  ],
  "broadcast": {
    "GROUP_B": ["agent1", "agent2"]
  }
}
```

- `GROUP_A`: Apenas alfred responde (roteamento normal)
- `GROUP_B`: agent1 E agent2 respondem (broadcast)

**Precedencia:** `broadcast` tem prioridade sobre `bindings`.

## Solucao de problemas

### Agentes nao respondendo

**Verifique:**

1. Os IDs dos agentes existem em `agents.list`
2. O formato do ID do peer esta correto (ex.: `120363403215116621@g.us`)
3. Os agentes nao estao em listas de negacao

**Depuracao:**

```bash
tail -f ~/.openclaw/logs/gateway.log | grep broadcast
```

### Apenas um agente respondendo

**Causa:** O ID do peer pode estar em `bindings`, mas nao em `broadcast`.

**Correcao:** Adicione a configuracao de broadcast ou remova dos bindings.

### Problemas de desempenho

**Se estiver lento com muitos agentes:**

- Reduza o numero de agentes por grupo
- Use modelos mais leves (sonnet em vez de opus)
- Verifique o tempo de inicializacao do sandbox

## Exemplos

### Exemplo 1: Equipe de revisao de codigo

```json
{
  "broadcast": {
    "strategy": "parallel",
    "120363403215116621@g.us": [
      "code-formatter",
      "security-scanner",
      "test-coverage",
      "docs-checker"
    ]
  },
  "agents": {
    "list": [
      {
        "id": "code-formatter",
        "workspace": "~/agents/formatter",
        "tools": { "allow": ["read", "write"] }
      },
      {
        "id": "security-scanner",
        "workspace": "~/agents/security",
        "tools": { "allow": ["read", "exec"] }
      },
      {
        "id": "test-coverage",
        "workspace": "~/agents/testing",
        "tools": { "allow": ["read", "exec"] }
      },
      { "id": "docs-checker", "workspace": "~/agents/docs", "tools": { "allow": ["read"] } }
    ]
  }
}
```

**Usuario envia:** Trecho de codigo  
**Respostas:**

- code-formatter: "Corrigi a indentacao e adicionei type hints"
- security-scanner: "⚠️ Vulnerabilidade de injecao SQL na linha 12"
- test-coverage: "A cobertura e 45%, faltam testes para casos de erro"
- docs-checker: "Docstring ausente para a funcao `process_data`"

### Exemplo 2: Suporte multilingue

```json
{
  "broadcast": {
    "strategy": "sequential",
    "+15555550123": ["detect-language", "translator-en", "translator-de"]
  },
  "agents": {
    "list": [
      { "id": "detect-language", "workspace": "~/agents/lang-detect" },
      { "id": "translator-en", "workspace": "~/agents/translate-en" },
      { "id": "translator-de", "workspace": "~/agents/translate-de" }
    ]
  }
}
```

## Referencia da API

### Esquema de configuracao

```typescript
interface OpenClawConfig {
  broadcast?: {
    strategy?: "parallel" | "sequential";
    [peerId: string]: string[];
  };
}
```

### Campos

- `strategy` (opcional): Como processar os agentes
  - `"parallel"` (padrao): Todos os agentes processam simultaneamente
  - `"sequential"`: Os agentes processam na ordem do array
- `[peerId]`: JID de grupo do WhatsApp, numero E.164 ou outro ID de peer
  - Valor: Array de IDs de agentes que devem processar mensagens

## Limitacoes

1. **Maximo de agentes:** Sem limite rigido, mas 10+ agentes podem ser lentos
2. **Contexto compartilhado:** Os agentes nao veem as respostas uns dos outros (por design)
3. **Ordenacao de mensagens:** Respostas paralelas podem chegar em qualquer ordem
4. **Limites de taxa:** Todos os agentes contam para os limites de taxa do WhatsApp

## Melhorias futuras

Recursos planejados:

- [ ] Modo de contexto compartilhado (agentes veem as respostas uns dos outros)
- [ ] Coordenacao de agentes (agentes podem sinalizar uns aos outros)
- [ ] Selecao dinamica de agentes (escolher agentes com base no conteudo da mensagem)
- [ ] Prioridades de agentes (alguns agentes respondem antes de outros)

## Veja tambem

- [Configuracao multiagente](/tools/multi-agent-sandbox-tools)
- [Configuracao de roteamento](/channels/channel-routing)
- [Gerenciamento de sessoes](/concepts/sessions)
