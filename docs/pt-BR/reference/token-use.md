---
summary: "Como o OpenClaw constrói o contexto do prompt e relata o uso de tokens + custos"
read_when:
  - Ao explicar uso de tokens, custos ou janelas de contexto
  - Ao depurar crescimento de contexto ou comportamento de compactacao
title: "Uso de Tokens e Custos"
x-i18n:
  source_path: reference/token-use.md
  source_hash: f8bfadb36b51830c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:23Z
---

# Uso de tokens & custos

O OpenClaw rastreia **tokens**, não caracteres. Tokens são específicos do modelo, mas a maioria
dos modelos no estilo OpenAI tem média de ~4 caracteres por token para texto em inglês.

## Como o prompt de sistema é construído

O OpenClaw monta seu próprio prompt de sistema a cada execucao. Ele inclui:

- Lista de ferramentas + descricoes curtas
- Lista de Skills (apenas metadados; as instrucoes sao carregadas sob demanda com `read`)
- Instrucoes de autoatualizacao
- Workspace + arquivos de bootstrap (`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md` quando novos). Arquivos grandes sao truncados por `agents.defaults.bootstrapMaxChars` (padrao: 20000).
- Hora (UTC + fuso horario do usuario)
- Tags de resposta + comportamento de heartbeat
- Metadados de runtime (host/OS/modelo/pensamento)

Veja o detalhamento completo em [System Prompt](/concepts/system-prompt).

## O que conta na janela de contexto

Tudo o que o modelo recebe conta para o limite de contexto:

- Prompt de sistema (todas as secoes listadas acima)
- Historico da conversa (mensagens do usuario + do assistente)
- Chamadas de ferramentas e resultados das ferramentas
- Anexos/transcricoes (imagens, audio, arquivos)
- Resumos de compactacao e artefatos de poda
- Wrappers do provedor ou cabecalhos de seguranca (nao visiveis, mas ainda contabilizados)

Para um detalhamento pratico (por arquivo injetado, ferramentas, skills e tamanho do prompt de sistema), use `/context list` ou `/context detail`. Veja [Context](/concepts/context).

## Como ver o uso atual de tokens

Use estes no chat:

- `/status` → **cartao de status rico em emojis** com o modelo da sessao, uso de contexto,
  tokens de entrada/saida da ultima resposta e **custo estimado** (somente chave de API).
- `/usage off|tokens|full` → adiciona um **rodape de uso por resposta** a cada reply.
  - Persiste por sessao (armazenado como `responseUsage`).
  - Autenticacao OAuth **oculta o custo** (apenas tokens).
- `/usage cost` → mostra um resumo local de custos a partir dos logs de sessao do OpenClaw.

Outras superficies:

- **TUI/Web TUI:** `/status` + `/usage` sao suportados.
- **CLI:** `openclaw status --usage` e `openclaw channels list` mostram
  janelas de cota do provedor (nao custos por resposta).

## Estimativa de custos (quando exibida)

Os custos sao estimados a partir da configuracao de precos do seu modelo:

```
models.providers.<provider>.models[].cost
```

Estes sao **USD por 1M de tokens** para `input`, `output`, `cacheRead` e
`cacheWrite`. Se o preco estiver ausente, o OpenClaw mostra apenas tokens. Tokens OAuth
nunca exibem custo em dolares.

## TTL de cache e impacto da poda

O cache de prompt do provedor se aplica apenas dentro da janela de TTL do cache. O OpenClaw pode
opcionalmente executar **poda por cache-ttl**: ele poda a sessao quando o TTL do cache
expira, e entao redefine a janela de cache para que solicitacoes subsequentes possam reutilizar o
contexto recem armazenado em cache em vez de re-cachear todo o historico. Isso mantem os custos de
escrita de cache mais baixos quando uma sessao fica ociosa alem do TTL.

Configure em [Gateway configuration](/gateway/configuration) e veja os detalhes de comportamento em [Session pruning](/concepts/session-pruning).

O heartbeat pode manter o cache **aquecido** durante lacunas de inatividade. Se o TTL de cache do seu modelo
for `1h`, definir o intervalo de heartbeat logo abaixo disso (por exemplo, `55m`) pode evitar
re-cachear todo o prompt, reduzindo os custos de escrita de cache.

Para precificacao da API Anthropic, leituras de cache sao significativamente mais baratas do que tokens de entrada,
enquanto escritas de cache sao cobradas com um multiplicador mais alto. Veja a precificacao de cache de prompt da Anthropic
para as taxas e multiplicadores de TTL mais recentes:
[https://docs.anthropic.com/docs/build-with-claude/prompt-caching](https://docs.anthropic.com/docs/build-with-claude/prompt-caching)

### Exemplo: manter cache de 1h aquecido com heartbeat

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

## Dicas para reduzir a pressao de tokens

- Use `/compact` para resumir sessoes longas.
- Enxugue grandes saidas de ferramentas nos seus fluxos de trabalho.
- Mantenha descricoes de skills curtas (a lista de skills e injetada no prompt).
- Prefira modelos menores para trabalho verboso e exploratorio.

Veja [Skills](/tools/skills) para a formula exata de sobrecarga da lista de skills.
