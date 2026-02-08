---
summary: "Como a memoria do OpenClaw funciona (arquivos do workspace + limpeza automatica de memoria)"
read_when:
  - Voce quer o layout e o fluxo de trabalho dos arquivos de memoria
  - Voce quer ajustar a limpeza automatica de memoria antes da compactacao
x-i18n:
  source_path: concepts/memory.md
  source_hash: 5fe705d89fb30998
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:32Z
---

# Memoria

A memoria do OpenClaw e **Markdown simples no workspace do agente**. Os arquivos sao a
fonte da verdade; o modelo so “lembra” do que e gravado em disco.

As ferramentas de busca de memoria sao fornecidas pelo plugin de memoria ativo (padrao:
`memory-core`). Desative plugins de memoria com `plugins.slots.memory = "none"`.

## Arquivos de memoria (Markdown)

O layout padrao do workspace usa duas camadas de memoria:

- `memory/YYYY-MM-DD.md`
  - Registro diario (somente append).
  - Le hoje + ontem no inicio da sessao.
- `MEMORY.md` (opcional)
  - Memoria de longo prazo curada.
  - **Carregar apenas na sessao principal e privada** (nunca em contextos de grupo).

Esses arquivos ficam sob o workspace (`agents.defaults.workspace`, padrao
`~/.openclaw/workspace`). Veja [Workspace do agente](/concepts/agent-workspace) para o layout completo.

## Quando escrever memoria

- Decisoes, preferencias e fatos duraveis vao para `MEMORY.md`.
- Notas do dia a dia e contexto em andamento vao para `memory/YYYY-MM-DD.md`.
- Se alguem disser “lembre isto”, escreva (nao mantenha em RAM).
- Esta area ainda esta evoluindo. Ajuda lembrar o modelo de armazenar memorias; ele saberá o que fazer.
- Se voce quer que algo permaneça, **peça ao bot para escrever** na memoria.

## Limpeza automatica de memoria (ping de pre-compactacao)

Quando uma sessao esta **perto da auto-compactacao**, o OpenClaw dispara um **turno silencioso,
agentico** que lembra o modelo de escrever memoria duravel **antes** de o
contexto ser compactado. Os prompts padrao dizem explicitamente que o modelo _pode responder_,
mas geralmente `NO_REPLY` e a resposta correta para que o usuario nunca veja esse turno.

Isso e controlado por `agents.defaults.compaction.memoryFlush`:

```json5
{
  agents: {
    defaults: {
      compaction: {
        reserveTokensFloor: 20000,
        memoryFlush: {
          enabled: true,
          softThresholdTokens: 4000,
          systemPrompt: "Session nearing compaction. Store durable memories now.",
          prompt: "Write any lasting notes to memory/YYYY-MM-DD.md; reply with NO_REPLY if nothing to store.",
        },
      },
    },
  },
}
```

Detalhes:

- **Limite suave**: a limpeza dispara quando a estimativa de tokens da sessao cruza
  `contextWindow - reserveTokensFloor - softThresholdTokens`.
- **Silencioso** por padrao: os prompts incluem `NO_REPLY` para que nada seja entregue.
- **Dois prompts**: um prompt de usuario mais um prompt de sistema acrescentam o lembrete.
- **Uma limpeza por ciclo de compactacao** (rastreado em `sessions.json`).
- **O workspace deve ser gravavel**: se a sessao roda em sandbox com
  `workspaceAccess: "ro"` ou `"none"`, a limpeza e ignorada.

Para o ciclo completo de compactacao, veja
[Gerenciamento de sessao + compactacao](/reference/session-management-compaction).

## Busca de memoria vetorial

O OpenClaw pode construir um pequeno indice vetorial sobre `MEMORY.md` e `memory/*.md` para que
consultas semanticas encontrem notas relacionadas mesmo quando a redacao difere.

Padroes:

- Ativado por padrao.
- Observa arquivos de memoria por mudancas (com debounce).
- Usa embeddings remotos por padrao. Se `memorySearch.provider` nao estiver definido, o OpenClaw seleciona automaticamente:
  1. `local` se um `memorySearch.local.modelPath` estiver configurado e o arquivo existir.
  2. `openai` se uma chave OpenAI puder ser resolvida.
  3. `gemini` se uma chave Gemini puder ser resolvida.
  4. Caso contrario, a busca de memoria permanece desativada ate ser configurada.
- O modo local usa node-llama-cpp e pode exigir `pnpm approve-builds`.
- Usa sqlite-vec (quando disponivel) para acelerar a busca vetorial dentro do SQLite.

Embeddings remotos **exigem** uma chave de API do provedor de embeddings. O OpenClaw
resolve chaves a partir de perfis de autenticacao, `models.providers.*.apiKey` ou variaveis de ambiente.
O OAuth do Codex cobre apenas chat/completions e **nao** atende embeddings para busca de memoria.
Para Gemini, use `GEMINI_API_KEY` ou
`models.providers.google.apiKey`. Ao usar um endpoint OpenAI-compatível personalizado,
defina `memorySearch.remote.apiKey` (e opcionalmente `memorySearch.remote.headers`).

### Backend QMD (experimental)

Defina `memory.backend = "qmd"` para trocar o indexador SQLite embutido por
[QMD](https://github.com/tobi/qmd): um sidecar de busca local-first que combina
BM25 + vetores + reranking. O Markdown continua sendo a fonte da verdade; o OpenClaw
chama o QMD para recuperacao. Pontos-chave:

**Prerequisitos**

- Desativado por padrao. Opt-in por configuracao (`memory.backend = "qmd"`).
- Instale o CLI do QMD separadamente (`bun install -g github.com/tobi/qmd` ou baixe
  um release) e garanta que o binario `qmd` esteja no `PATH` do gateway.
- O QMD precisa de um build do SQLite que permita extensoes (`brew install sqlite` no
  macOS).
- O QMD roda totalmente local via Bun + `node-llama-cpp` e faz auto-download de modelos GGUF
  do HuggingFace no primeiro uso (nenhum daemon Ollama separado e necessario).
- O gateway executa o QMD em um XDG home autocontido sob
  `~/.openclaw/agents/<agentId>/qmd/` definindo `XDG_CONFIG_HOME` e
  `XDG_CACHE_HOME`.
- Suporte a SO: macOS e Linux funcionam out of the box quando Bun + SQLite estao
  instalados. Windows e melhor suportado via WSL2.

**Como o sidecar roda**

- O gateway grava um home QMD autocontido sob
  `~/.openclaw/agents/<agentId>/qmd/` (config + cache + DB sqlite).
- Colecoes sao reescritas a partir de `memory.qmd.paths` (mais os arquivos
  padrao de memoria do workspace) para `index.yml`, depois `qmd update` + `qmd embed` rodam no boot e
  em um intervalo configuravel (`memory.qmd.update.interval`, padrao 5 min).
- As buscas rodam via `qmd query --json`. Se o QMD falhar ou o binario estiver ausente,
  o OpenClaw automaticamente retorna ao gerenciador SQLite embutido para que as ferramentas
  de memoria continuem funcionando.
- **A primeira busca pode ser lenta**: o QMD pode baixar modelos GGUF locais (reranker/expansao de consulta)
  na primeira execucao de `qmd query`.
  - O OpenClaw define `XDG_CONFIG_HOME`/`XDG_CACHE_HOME` automaticamente quando executa o QMD.
  - Se voce quiser pre-baixar modelos manualmente (e aquecer o mesmo indice que o OpenClaw
    usa), execute uma consulta unica com os dirs XDG do agente.

    O estado do QMD do OpenClaw fica no seu **diretorio de estado** (padrao `~/.openclaw`).
    Voce pode apontar `qmd` para exatamente o mesmo indice exportando as mesmas variaveis XDG
    que o OpenClaw usa:

    ```bash
    # Pick the same state dir OpenClaw uses
    STATE_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
    if [ -d "$HOME/.moltbot" ] && [ ! -d "$HOME/.openclaw" ] \
      && [ -z "${OPENCLAW_STATE_DIR:-}" ]; then
      STATE_DIR="$HOME/.moltbot"
    fi

    export XDG_CONFIG_HOME="$STATE_DIR/agents/main/qmd/xdg-config"
    export XDG_CACHE_HOME="$STATE_DIR/agents/main/qmd/xdg-cache"

    # (Optional) force an index refresh + embeddings
    qmd update
    qmd embed

    # Warm up / trigger first-time model downloads
    qmd query "test" -c memory-root --json >/dev/null 2>&1
    ```

**Superficie de configuracao (`memory.qmd.*`)**

- `command` (padrao `qmd`): substitui o caminho do executavel.
- `includeDefaultMemory` (padrao `true`): auto-indexa `MEMORY.md` + `memory/**/*.md`.
- `paths[]`: adiciona diretorios/arquivos extras (`path`, opcional `pattern`, opcional
  estavel `name`).
- `sessions`: opt-in para indexacao de JSONL de sessao (`enabled`, `retentionDays`,
  `exportDir`).
- `update`: controla a cadencia de atualizacao (`interval`, `debounceMs`, `onBoot`, `embedInterval`).
- `limits`: limita o payload de recall (`maxResults`, `maxSnippetChars`,
  `maxInjectedChars`, `timeoutMs`).
- `scope`: mesmo esquema que [`session.sendPolicy`](/gateway/configuration#session).
  O padrao e apenas DM (`deny` todos, `allow` chats diretos); afrouxe para exibir resultados do QMD em grupos/canais.
- Trechos provenientes de fora do workspace aparecem como
  `qmd/<collection>/<relative-path>` nos resultados de `memory_search`; `memory_get`
  entende esse prefixo e le a partir da raiz da colecao QMD configurada.
- Quando `memory.qmd.sessions.enabled = true`, o OpenClaw exporta transcricoes de sessao higienizadas
  (turnos Usuario/Assistente) para uma colecao QMD dedicada sob
  `~/.openclaw/agents/<id>/qmd/sessions/`, para que `memory_search` possa recuperar
  conversas recentes sem tocar no indice SQLite embutido.
- Trechos `memory_search` agora incluem um rodape `Source: <path#line>` quando
  `memory.citations` e `auto`/`on`; defina `memory.citations = "off"` para manter
  os metadados de caminho internos (o agente ainda recebe o caminho para
  `memory_get`, mas o texto do trecho omite o rodape e o prompt de sistema
  avisa o agente para nao cita-lo).

**Exemplo**

```json5
memory: {
  backend: "qmd",
  citations: "auto",
  qmd: {
    includeDefaultMemory: true,
    update: { interval: "5m", debounceMs: 15000 },
    limits: { maxResults: 6, timeoutMs: 4000 },
    scope: {
      default: "deny",
      rules: [{ action: "allow", match: { chatType: "direct" } }]
    },
    paths: [
      { name: "docs", path: "~/notes", pattern: "**/*.md" }
    ]
  }
}
```

**Citacoes e fallback**

- `memory.citations` se aplica independentemente do backend (`auto`/`on`/`off`).
- Quando `qmd` roda, marcamos `status().backend = "qmd"` para que os diagnosticos mostrem qual
  engine serviu os resultados. Se o subprocesso do QMD encerrar ou a saida JSON nao puder
  ser analisada, o gerenciador de busca registra um aviso e retorna o provedor embutido
  (embeddings Markdown existentes) ate o QMD se recuperar.

### Caminhos adicionais de memoria

Se voce quiser indexar arquivos Markdown fora do layout padrao do workspace, adicione
caminhos explicitos:

```json5
agents: {
  defaults: {
    memorySearch: {
      extraPaths: ["../team-docs", "/srv/shared-notes/overview.md"]
    }
  }
}
```

Notas:

- Caminhos podem ser absolutos ou relativos ao workspace.
- Diretorios sao varridos recursivamente por arquivos `.md`.
- Apenas arquivos Markdown sao indexados.
- Symlinks sao ignorados (arquivos ou diretorios).

### Embeddings Gemini (nativo)

Defina o provedor como `gemini` para usar a API de embeddings do Gemini diretamente:

```json5
agents: {
  defaults: {
    memorySearch: {
      provider: "gemini",
      model: "gemini-embedding-001",
      remote: {
        apiKey: "YOUR_GEMINI_API_KEY"
      }
    }
  }
}
```

Notas:

- `remote.baseUrl` e opcional (padrao e a URL base da API Gemini).
- `remote.headers` permite adicionar cabecalhos extras, se necessario.
- Modelo padrao: `gemini-embedding-001`.

Se voce quiser usar um **endpoint OpenAI-compatível personalizado** (OpenRouter, vLLM ou um proxy),
voce pode usar a configuracao `remote` com o provedor OpenAI:

```json5
agents: {
  defaults: {
    memorySearch: {
      provider: "openai",
      model: "text-embedding-3-small",
      remote: {
        baseUrl: "https://api.example.com/v1/",
        apiKey: "YOUR_OPENAI_COMPAT_API_KEY",
        headers: { "X-Custom-Header": "value" }
      }
    }
  }
}
```

Se voce nao quiser definir uma chave de API, use `memorySearch.provider = "local"` ou defina
`memorySearch.fallback = "none"`.

Fallbacks:

- `memorySearch.fallback` pode ser `openai`, `gemini`, `local` ou `none`.
- O provedor de fallback so e usado quando o provedor primario de embeddings falha.

Indexacao em lote (OpenAI + Gemini):

- Ativada por padrao para embeddings OpenAI e Gemini. Defina `agents.defaults.memorySearch.remote.batch.enabled = false` para desativar.
- O comportamento padrao aguarda a conclusao do lote; ajuste `remote.batch.wait`, `remote.batch.pollIntervalMs` e `remote.batch.timeoutMinutes` se necessario.
- Defina `remote.batch.concurrency` para controlar quantos jobs de lote enviamos em paralelo (padrao: 2).
- O modo de lote se aplica quando `memorySearch.provider = "openai"` ou `"gemini"` e usa a chave de API correspondente.
- Jobs de lote do Gemini usam o endpoint assincrono de embeddings em lote e exigem disponibilidade da API Gemini Batch.

Por que o lote OpenAI e rapido + barato:

- Para grandes backfills, o OpenAI geralmente e a opcao mais rapida que suportamos porque podemos enviar muitas solicitacoes de embeddings em um unico job de lote e deixar o OpenAI processa-las de forma assincrona.
- O OpenAI oferece precos com desconto para cargas de trabalho da Batch API, entao grandes execucoes de indexacao costumam ser mais baratas do que enviar as mesmas solicitacoes de forma sincrona.
- Veja a documentacao e precos da OpenAI Batch API para detalhes:
  - https://platform.openai.com/docs/api-reference/batch
  - https://platform.openai.com/pricing

Exemplo de configuracao:

```json5
agents: {
  defaults: {
    memorySearch: {
      provider: "openai",
      model: "text-embedding-3-small",
      fallback: "openai",
      remote: {
        batch: { enabled: true, concurrency: 2 }
      },
      sync: { watch: true }
    }
  }
}
```

Ferramentas:

- `memory_search` — retorna trechos com arquivo + intervalos de linhas.
- `memory_get` — le o conteudo do arquivo de memoria por caminho.

Modo local:

- Defina `agents.defaults.memorySearch.provider = "local"`.
- Forneca `agents.defaults.memorySearch.local.modelPath` (GGUF ou URI `hf:`).
- Opcional: defina `agents.defaults.memorySearch.fallback = "none"` para evitar fallback remoto.

### Como as ferramentas de memoria funcionam

- `memory_search` busca semanticamente por chunks de Markdown (~alvo de 400 tokens, sobreposicao de 80 tokens) de `MEMORY.md` + `memory/**/*.md`. Ele retorna texto do trecho (limitado a ~700 caracteres), caminho do arquivo, intervalo de linhas, pontuacao, provedor/modelo e se houve fallback de embeddings locais → remotos. Nenhum payload de arquivo completo e retornado.
- `memory_get` le um arquivo Markdown de memoria especifico (relativo ao workspace), opcionalmente a partir de uma linha inicial e por N linhas. Caminhos fora de `MEMORY.md` / `memory/` sao rejeitados.
- Ambas as ferramentas so sao ativadas quando `memorySearch.enabled` resolve como verdadeiro para o agente.

### O que e indexado (e quando)

- Tipo de arquivo: apenas Markdown (`MEMORY.md`, `memory/**/*.md`).
- Armazenamento do indice: SQLite por agente em `~/.openclaw/memory/<agentId>.sqlite` (configuravel via `agents.defaults.memorySearch.store.path`, suporta token `{agentId}`).
- Atualidade: watcher em `MEMORY.md` + `memory/` marca o indice como sujo (debounce de 1,5s). A sincronizacao e agendada no inicio da sessao, na busca ou em um intervalo e roda de forma assincrona. Transcricoes de sessao usam limites de delta para acionar sincronizacao em background.
- Gatilhos de reindexacao: o indice armazena o **provedor/modelo de embedding + fingerprint do endpoint + parametros de chunking**. Se qualquer um mudar, o OpenClaw automaticamente reseta e reindexa todo o armazenamento.

### Busca hibrida (BM25 + vetor)

Quando ativado, o OpenClaw combina:

- **Similaridade vetorial** (correspondencia semantica, a redacao pode diferir)
- **Relevancia de palavras-chave BM25** (tokens exatos como IDs, variaveis de ambiente, simbolos de codigo)

Se a busca de texto completo nao estiver disponivel na sua plataforma, o OpenClaw retorna para busca somente vetorial.

#### Por que hibrida?

A busca vetorial e excelente em “isto significa a mesma coisa”:

- “Mac Studio gateway host” vs “a maquina executando o gateway”
- “debounce atualizacoes de arquivo” vs “evitar indexar a cada gravacao”

Mas pode ser fraca em tokens exatos e de alto sinal:

- IDs (`a828e60`, `b3b9895a…`)
- simbolos de codigo (`memorySearch.query.hybrid`)
- strings de erro (“sqlite-vec unavailable”)

BM25 (texto completo) e o oposto: forte em tokens exatos, mais fraco em parafrases.
A busca hibrida e o meio-termo pragmatico: **usar ambos os sinais de recuperacao** para obter
bons resultados tanto para consultas em “linguagem natural” quanto para consultas “agulha no palheiro”.

#### Como mesclamos resultados (design atual)

Esboco de implementacao:

1. Recuperar um pool de candidatos de ambos os lados:

- **Vetor**: top `maxResults * candidateMultiplier` por similaridade de cosseno.
- **BM25**: top `maxResults * candidateMultiplier` por rank BM25 do FTS5 (menor e melhor).

2. Converter o rank BM25 em uma pontuacao tipo 0..1:

- `textScore = 1 / (1 + max(0, bm25Rank))`

3. Unir candidatos por id do chunk e calcular uma pontuacao ponderada:

- `finalScore = vectorWeight * vectorScore + textWeight * textScore`

Notas:

- `vectorWeight` + `textWeight` e normalizado para 1,0 na resolucao de configuracao, entao os pesos se comportam como percentuais.
- Se embeddings nao estiverem disponiveis (ou o provedor retornar um vetor zero), ainda executamos BM25 e retornamos correspondencias por palavras-chave.
- Se o FTS5 nao puder ser criado, mantemos a busca somente vetorial (sem falha dura).

Isso nao e “perfeito em teoria de RI”, mas e simples, rapido e tende a melhorar recall/precisao em notas reais.
Se quisermos ficar mais sofisticados depois, passos comuns sao Reciprocal Rank Fusion (RRF) ou normalizacao de pontuacoes
(min/max ou z-score) antes de misturar.

Configuracao:

```json5
agents: {
  defaults: {
    memorySearch: {
      query: {
        hybrid: {
          enabled: true,
          vectorWeight: 0.7,
          textWeight: 0.3,
          candidateMultiplier: 4
        }
      }
    }
  }
}
```

### Cache de embeddings

O OpenClaw pode fazer cache de **embeddings de chunks** em SQLite para que reindexacoes e atualizacoes frequentes (especialmente transcricoes de sessao) nao re-embutam texto inalterado.

Configuracao:

```json5
agents: {
  defaults: {
    memorySearch: {
      cache: {
        enabled: true,
        maxEntries: 50000
      }
    }
  }
}
```

### Busca de memoria de sessao (experimental)

Voce pode opcionalmente indexar **transcricoes de sessao** e expô-las via `memory_search`.
Isso fica atras de uma flag experimental.

```json5
agents: {
  defaults: {
    memorySearch: {
      experimental: { sessionMemory: true },
      sources: ["memory", "sessions"]
    }
  }
}
```

Notas:

- A indexacao de sessao e **opt-in** (desligada por padrao).
- Atualizacoes de sessao tem debounce e sao **indexadas de forma assincrona** quando cruzam limites de delta (best-effort).
- `memory_search` nunca bloqueia aguardando indexacao; os resultados podem ficar levemente desatualizados ate a sincronizacao em background terminar.
- Os resultados ainda incluem apenas trechos; `memory_get` continua limitado a arquivos de memoria.
- A indexacao de sessao e isolada por agente (apenas os logs de sessao daquele agente sao indexados).
- Os logs de sessao ficam em disco (`~/.openclaw/agents/<agentId>/sessions/*.jsonl`). Qualquer processo/usuario com acesso ao sistema de arquivos pode le-los, entao trate o acesso ao disco como o limite de confianca. Para isolamento mais rigoroso, execute agentes sob usuarios de SO ou hosts separados.

Limites de delta (padroes mostrados):

```json5
agents: {
  defaults: {
    memorySearch: {
      sync: {
        sessions: {
          deltaBytes: 100000,   // ~100 KB
          deltaMessages: 50     // JSONL lines
        }
      }
    }
  }
}
```

### Aceleracao vetorial SQLite (sqlite-vec)

Quando a extensao sqlite-vec esta disponivel, o OpenClaw armazena embeddings em uma
tabela virtual SQLite (`vec0`) e executa consultas de distancia vetorial no
banco de dados. Isso mantem a busca rapida sem carregar cada embedding no JS.

Configuracao (opcional):

```json5
agents: {
  defaults: {
    memorySearch: {
      store: {
        vector: {
          enabled: true,
          extensionPath: "/path/to/sqlite-vec"
        }
      }
    }
  }
}
```

Notas:

- `enabled` padrao e true; quando desativado, a busca retorna para
  similaridade de cosseno em processo sobre embeddings armazenados.
- Se a extensao sqlite-vec estiver ausente ou falhar ao carregar, o OpenClaw registra o
  erro e continua com o fallback JS (sem tabela vetorial).
- `extensionPath` substitui o caminho do sqlite-vec empacotado (util para builds personalizados
  ou locais de instalacao nao padrao).

### Auto-download de embeddings locais

- Modelo padrao de embeddings locais: `hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf` (~0,6 GB).
- Quando `memorySearch.provider = "local"`, `node-llama-cpp` resolve `modelPath`; se o GGUF estiver ausente ele **faz auto-download** para o cache (ou `local.modelCacheDir` se definido), depois carrega. Downloads retomam em nova tentativa.
- Requisito de build nativo: execute `pnpm approve-builds`, escolha `node-llama-cpp`, depois `pnpm rebuild node-llama-cpp`.
- Fallback: se a configuracao local falhar e `memorySearch.fallback = "openai"`, mudamos automaticamente para embeddings remotos (`openai/text-embedding-3-small` a menos que substituido) e registramos o motivo.

### Exemplo de endpoint OpenAI-compatível personalizado

```json5
agents: {
  defaults: {
    memorySearch: {
      provider: "openai",
      model: "text-embedding-3-small",
      remote: {
        baseUrl: "https://api.example.com/v1/",
        apiKey: "YOUR_REMOTE_API_KEY",
        headers: {
          "X-Organization": "org-id",
          "X-Project": "project-id"
        }
      }
    }
  }
}
```

Notas:

- `remote.*` tem precedencia sobre `models.providers.openai.*`.
- `remote.headers` mescla com cabecalhos OpenAI; o remoto vence em conflitos de chave. Omita `remote.headers` para usar os padroes da OpenAI.
