---
summary: "Ferramentas de busca na web + fetch (Brave Search API, Perplexity direto/OpenRouter)"
read_when:
  - Voce quer habilitar web_search ou web_fetch
  - Voce precisa configurar a chave da Brave Search API
  - Voce quer usar o Perplexity Sonar para busca na web
title: "Ferramentas Web"
x-i18n:
  source_path: tools/web.md
  source_hash: f5f25d2b40ccf1e5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:50Z
---

# Ferramentas web

O OpenClaw inclui duas ferramentas web leves:

- `web_search` — Pesquisa na web via Brave Search API (padrão) ou Perplexity Sonar (direto ou via OpenRouter).
- `web_fetch` — Fetch HTTP + extração legível (HTML → markdown/texto).

Isso **não** é automação de navegador. Para sites com muito JavaScript ou logins, use a
[ferramenta de Navegador](/tools/browser).

## Como funciona

- `web_search` chama o provedor configurado e retorna resultados.
  - **Brave** (padrão): retorna resultados estruturados (título, URL, trecho).
  - **Perplexity**: retorna respostas sintetizadas por IA com citações de buscas na web em tempo real.
- Os resultados são armazenados em cache por consulta por 15 minutos (configurável).
- `web_fetch` faz um HTTP GET simples e extrai conteúdo legível
  (HTML → markdown/texto). **Não** executa JavaScript.
- `web_fetch` é habilitado por padrão (a menos que seja explicitamente desabilitado).

## Escolhendo um provedor de busca

| Provedor           | Prós                                                | Contras                                   | Chave de API                                 |
| ------------------ | --------------------------------------------------- | ----------------------------------------- | -------------------------------------------- |
| **Brave** (padrão) | Rápido, resultados estruturados, camada gratuita    | Resultados de busca tradicionais          | `BRAVE_API_KEY`                              |
| **Perplexity**     | Respostas sintetizadas por IA, citações, tempo real | Requer acesso ao Perplexity ou OpenRouter | `OPENROUTER_API_KEY` ou `PERPLEXITY_API_KEY` |

Veja [Configuração do Brave Search](/brave-search) e [Perplexity Sonar](/perplexity) para detalhes específicos de cada provedor.

Defina o provedor na configuração:

```json5
{
  tools: {
    web: {
      search: {
        provider: "brave", // or "perplexity"
      },
    },
  },
}
```

Exemplo: mudar para Perplexity Sonar (API direta):

```json5
{
  tools: {
    web: {
      search: {
        provider: "perplexity",
        perplexity: {
          apiKey: "pplx-...",
          baseUrl: "https://api.perplexity.ai",
          model: "perplexity/sonar-pro",
        },
      },
    },
  },
}
```

## Obtendo uma chave da Brave API

1. Crie uma conta da Brave Search API em https://brave.com/search/api/
2. No painel, escolha o plano **Data for Search** (não “Data for AI”) e gere uma chave de API.
3. Execute `openclaw configure --section web` para armazenar a chave na configuração (recomendado) ou defina `BRAVE_API_KEY` no seu ambiente.

A Brave oferece uma camada gratuita além de planos pagos; verifique o portal da Brave API para
os limites e preços atuais.

### Onde definir a chave (recomendado)

**Recomendado:** execute `openclaw configure --section web`. Ele armazena a chave em
`~/.openclaw/openclaw.json` sob `tools.web.search.apiKey`.

**Alternativa por ambiente:** defina `BRAVE_API_KEY` no ambiente do processo do Gateway.
Para uma instalação do gateway, coloque em `~/.openclaw/.env` (ou no ambiente do seu
serviço). Veja [Env vars](/help/faq#how-does-openclaw-load-environment-variables).

## Usando Perplexity (direto ou via OpenRouter)

Os modelos Perplexity Sonar têm capacidades de busca na web integradas e retornam
respostas sintetizadas por IA com citações. Voce pode usá-los via OpenRouter (sem cartão
de crédito — suporta cripto/pré-pago).

### Obtendo uma chave de API do OpenRouter

1. Crie uma conta em https://openrouter.ai/
2. Adicione créditos (suporta cripto, pré-pago ou cartão de crédito)
3. Gere uma chave de API nas configurações da sua conta

### Configurando a busca do Perplexity

```json5
{
  tools: {
    web: {
      search: {
        enabled: true,
        provider: "perplexity",
        perplexity: {
          // API key (optional if OPENROUTER_API_KEY or PERPLEXITY_API_KEY is set)
          apiKey: "sk-or-v1-...",
          // Base URL (key-aware default if omitted)
          baseUrl: "https://openrouter.ai/api/v1",
          // Model (defaults to perplexity/sonar-pro)
          model: "perplexity/sonar-pro",
        },
      },
    },
  },
}
```

**Alternativa por ambiente:** defina `OPENROUTER_API_KEY` ou `PERPLEXITY_API_KEY` no ambiente do Gateway.
Para uma instalação do gateway, coloque em `~/.openclaw/.env`.

Se nenhuma URL base for definida, o OpenClaw escolhe um padrão com base na origem da chave de API:

- `PERPLEXITY_API_KEY` ou `pplx-...` → `https://api.perplexity.ai`
- `OPENROUTER_API_KEY` ou `sk-or-...` → `https://openrouter.ai/api/v1`
- Formatos de chave desconhecidos → OpenRouter (fallback seguro)

### Modelos Perplexity disponíveis

| Modelo                           | Descrição                                      | Melhor para         |
| -------------------------------- | ---------------------------------------------- | ------------------- |
| `perplexity/sonar`               | Perguntas e respostas rápidas com busca na web | Consultas rápidas   |
| `perplexity/sonar-pro` (padrão)  | Raciocínio em várias etapas com busca na web   | Perguntas complexas |
| `perplexity/sonar-reasoning-pro` | Análise de cadeia de pensamento                | Pesquisa profunda   |

## web_search

Pesquise na web usando o provedor configurado.

### Requisitos

- `tools.web.search.enabled` não deve ser `false` (padrão: habilitado)
- Chave de API para o provedor escolhido:
  - **Brave**: `BRAVE_API_KEY` ou `tools.web.search.apiKey`
  - **Perplexity**: `OPENROUTER_API_KEY`, `PERPLEXITY_API_KEY` ou `tools.web.search.perplexity.apiKey`

### Configuração

```json5
{
  tools: {
    web: {
      search: {
        enabled: true,
        apiKey: "BRAVE_API_KEY_HERE", // optional if BRAVE_API_KEY is set
        maxResults: 5,
        timeoutSeconds: 30,
        cacheTtlMinutes: 15,
      },
    },
  },
}
```

### Parâmetros da ferramenta

- `query` (obrigatório)
- `count` (1–10; padrão da configuração)
- `country` (opcional): código de país de 2 letras para resultados regionais (ex.: "DE", "US", "ALL"). Se omitido, o Brave escolhe sua região padrão.
- `search_lang` (opcional): código de idioma ISO para resultados de busca (ex.: "de", "en", "fr")
- `ui_lang` (opcional): código de idioma ISO para elementos de UI
- `freshness` (opcional, apenas Brave): filtrar por tempo de descoberta (`pd`, `pw`, `pm`, `py` ou `YYYY-MM-DDtoYYYY-MM-DD`)

**Exemplos:**

```javascript
// German-specific search
await web_search({
  query: "TV online schauen",
  count: 10,
  country: "DE",
  search_lang: "de",
});

// French search with French UI
await web_search({
  query: "actualités",
  country: "FR",
  search_lang: "fr",
  ui_lang: "fr",
});

// Recent results (past week)
await web_search({
  query: "TMBG interview",
  freshness: "pw",
});
```

## web_fetch

Busque uma URL e extraia conteúdo legível.

### Requisitos

- `tools.web.fetch.enabled` não deve ser `false` (padrão: habilitado)
- Fallback opcional do Firecrawl: defina `tools.web.fetch.firecrawl.apiKey` ou `FIRECRAWL_API_KEY`.

### Configuração

```json5
{
  tools: {
    web: {
      fetch: {
        enabled: true,
        maxChars: 50000,
        maxCharsCap: 50000,
        timeoutSeconds: 30,
        cacheTtlMinutes: 15,
        maxRedirects: 3,
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        readability: true,
        firecrawl: {
          enabled: true,
          apiKey: "FIRECRAWL_API_KEY_HERE", // optional if FIRECRAWL_API_KEY is set
          baseUrl: "https://api.firecrawl.dev",
          onlyMainContent: true,
          maxAgeMs: 86400000, // ms (1 day)
          timeoutSeconds: 60,
        },
      },
    },
  },
}
```

### Parâmetros da ferramenta

- `url` (obrigatório, apenas http/https)
- `extractMode` (`markdown` | `text`)
- `maxChars` (truncar páginas longas)

Notas:

- `web_fetch` usa Readability (extração do conteúdo principal) primeiro, depois Firecrawl (se configurado). Se ambos falharem, a ferramenta retorna um erro.
- As requisições do Firecrawl usam modo de contorno de bots e armazenam resultados em cache por padrão.
- `web_fetch` envia um User-Agent semelhante ao Chrome e `Accept-Language` por padrão; substitua `userAgent` se necessário.
- `web_fetch` bloqueia nomes de host privados/internos e revalida redirecionamentos (limite com `maxRedirects`).
- `maxChars` é limitado a `tools.web.fetch.maxCharsCap`.
- `web_fetch` é uma extração de melhor esforço; alguns sites precisarão da ferramenta de navegador.
- Veja [Firecrawl](/tools/firecrawl) para configuração de chave e detalhes do serviço.
- As respostas são armazenadas em cache (padrão de 15 minutos) para reduzir buscas repetidas.
- Se voce usa perfis/listas de permissão de ferramentas, adicione `web_search`/`web_fetch` ou `group:web`.
- Se a chave da Brave estiver ausente, `web_search` retorna uma dica curta de configuração com um link para a documentação.
