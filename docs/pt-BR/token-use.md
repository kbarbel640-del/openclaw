---
summary: "Como o OpenClaw constrói o contexto do prompt e reporta uso de tokens + custos"
read_when:
  - Explicando uso de tokens, custos ou janelas de contexto
  - Depurando crescimento de contexto ou comportamento de compactação
title: "Uso de tokens e custos"
x-i18n:
  source_path: token-use.md
  source_hash: cc914080a809ada2
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:33Z
---

# Uso de tokens & custos

O OpenClaw rastreia **tokens**, não caracteres. Tokens são específicos do modelo, mas a maioria
dos modelos no estilo OpenAI tem média de ~4 caracteres por token para texto em inglês.

## Como o prompt do sistema é construído

O OpenClaw monta seu próprio prompt de sistema a cada execução. Ele inclui:

- Lista de ferramentas + descrições curtas
- Lista de Skills (apenas metadados; as instruções são carregadas sob demanda com `read`)
- Instruções de autoatualização
- Workspace + arquivos de bootstrap (`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md` quando novos). Arquivos grandes são truncados por `agents.defaults.bootstrapMaxChars` (padrão: 20000).
- Horário (UTC + fuso horário do usuário)
- Tags de resposta + comportamento de heartbeat
- Metadados de runtime (host/OS/model/thinking)

Veja a decomposição completa em [System Prompt](/concepts/system-prompt).

## O que conta na janela de contexto

Tudo o que o modelo recebe conta para o limite de contexto:

- Prompt do sistema (todas as seções listadas acima)
- Histórico da conversa (mensagens do usuário + assistente)
- Chamadas de ferramentas e resultados de ferramentas
- Anexos/transcrições (imagens, áudio, arquivos)
- Resumos de compactação e artefatos de poda
- Wrappers do provedor ou cabeçalhos de segurança (não visíveis, mas ainda contados)

Para uma decomposição prática (por arquivo injetado, ferramentas, skills e tamanho do prompt do sistema), use `/context list` ou `/context detail`. Veja [Context](/concepts/context).

## Como ver o uso atual de tokens

Use estes comandos no chat:

- `/status` → **cartão de status rico em emojis** com o modelo da sessão, uso de contexto,
  tokens de entrada/saída da última resposta e **custo estimado** (apenas chave de API).
- `/usage off|tokens|full` → adiciona um **rodapé de uso por resposta** a cada reply.
  - Persiste por sessão (armazenado como `responseUsage`).
  - Autenticação OAuth **oculta o custo** (apenas tokens).
- `/usage cost` → mostra um resumo local de custos a partir dos logs de sessão do OpenClaw.

Outras superfícies:

- **TUI/Web TUI:** `/status` + `/usage` são suportados.
- **CLI:** `openclaw status --usage` e `openclaw channels list` mostram
  janelas de cota do provedor (não custos por resposta).

## Estimativa de custos (quando exibida)

Os custos são estimados a partir da configuracao de precos do seu modelo:

```
models.providers.<provider>.models[].cost
```

Estes valores são **USD por 1M de tokens** para `input`, `output`, `cacheRead` e
`cacheWrite`. Se o preço estiver ausente, o OpenClaw mostra apenas tokens. Tokens OAuth
nunca mostram custo em dólares.

## Impacto do TTL de cache e da poda

O cache de prompt do provedor só se aplica dentro da janela de TTL do cache. O OpenClaw pode
opcionalmente executar **poda por cache-ttl**: ele poda a sessão quando o TTL do cache
expira e, em seguida, redefine a janela de cache para que solicitações subsequentes possam reutilizar o
contexto recém-cacheado em vez de recachear todo o histórico. Isso mantém os custos de escrita de cache
mais baixos quando uma sessão fica ociosa além do TTL.

Configure isso em [Gateway configuration](/gateway/configuration) e veja os
detalhes de comportamento em [Session pruning](/concepts/session-pruning).

O heartbeat pode manter o cache **quente** ao longo de lacunas de ociosidade. Se o TTL de cache do seu modelo
for `1h`, definir o intervalo de heartbeat logo abaixo disso (por exemplo, `55m`) pode evitar
re-cachear todo o prompt, reduzindo os custos de escrita de cache.

Para preços da API Anthropic, leituras de cache são significativamente mais baratas do que tokens de entrada,
enquanto escritas de cache são cobradas com um multiplicador mais alto. Veja a precificação de cache de prompt da Anthropic
para as taxas e multiplicadores de TTL mais recentes:
https://docs.anthropic.com/docs/build-with-claude/prompt-caching

### Exemplo: manter o cache de 1h quente com heartbeat

```yaml
agents:
  defaults:
    model:
      primary: "anthropic/claude-opus-4-6"
    models:
      "anthropic/claude-opus-4-6":
        params:
          cacheRetention: "long"
    heartbeat:
      every: "55m"
```

## Dicas para reduzir a pressão de tokens

- Use `/compact` para resumir sessões longas.
- Corte saídas grandes de ferramentas nos seus fluxos de trabalho.
- Mantenha descrições de skills curtas (a lista de skills é injetada no prompt).
- Prefira modelos menores para trabalho verboso e exploratório.

Veja [Skills](/tools/skills) para a fórmula exata de overhead da lista de skills.
