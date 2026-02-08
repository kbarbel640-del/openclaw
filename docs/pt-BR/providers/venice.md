---
summary: "Use os modelos focados em privacidade da Venice AI no OpenClaw"
read_when:
  - Voce quer inferencia focada em privacidade no OpenClaw
  - Voce quer orientacoes de configuracao da Venice AI
title: "Venice AI"
x-i18n:
  source_path: providers/venice.md
  source_hash: 2453a6ec3a715c24
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:24Z
---

# Venice AI (Destaque Venice)

**Venice** é nossa configuracao em destaque da Venice para inferencia com foco em privacidade, com acesso opcional anonimizado a modelos proprietarios.

A Venice AI fornece inferencia de IA focada em privacidade, com suporte a modelos sem censura e acesso aos principais modelos proprietarios por meio de seu proxy anonimizado. Toda a inferencia é privada por padrao — sem treinamento com seus dados, sem logs.

## Por que usar Venice no OpenClaw

- **Inferencia privada** para modelos open source (sem logs).
- **Modelos sem censura** quando voce precisa deles.
- **Acesso anonimizado** a modelos proprietarios (Opus/GPT/Gemini) quando a qualidade importa.
- Endpoints compatíveis com OpenAI `/v1`.

## Modos de Privacidade

A Venice oferece dois niveis de privacidade — entender isso é fundamental para escolher seu modelo:

| Modo           | Descricao                                                                                                           | Modelos                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Private**    | Totalmente privado. Prompts/respostas **nunca sao armazenados ou registrados**. Efemero.                            | Llama, Qwen, DeepSeek, Venice Uncensored etc |
| **Anonymized** | Proxied pela Venice com metadados removidos. O provedor subjacente (OpenAI, Anthropic) ve requisicoes anonimizadas. | Claude, GPT, Gemini, Grok, Kimi, MiniMax     |

## Recursos

- **Foco em privacidade**: Escolha entre os modos "private" (totalmente privado) e "anonymized" (proxied)
- **Modelos sem censura**: Acesso a modelos sem restricoes de conteudo
- **Acesso a modelos principais**: Use Claude, GPT-5.2, Gemini, Grok via o proxy anonimizado da Venice
- **API compatível com OpenAI**: Endpoints padrao `/v1` para integracao facil
- **Streaming**: ✅ Suportado em todos os modelos
- **Function calling**: ✅ Suportado em modelos selecionados (verifique as capacidades do modelo)
- **Visao**: ✅ Suportado em modelos com capacidade de visao
- **Sem limites rigidos de taxa**: Pode haver limitacao por uso justo em casos extremos

## Configuracao

### 1. Obter chave de API

1. Cadastre-se em [venice.ai](https://venice.ai)
2. Va para **Settings → API Keys → Create new key**
3. Copie sua chave de API (formato: `vapi_xxxxxxxxxxxx`)

### 2. Configurar o OpenClaw

**Opcao A: Variavel de ambiente**

```bash
export VENICE_API_KEY="vapi_xxxxxxxxxxxx"
```

**Opcao B: Configuracao interativa (Recomendado)**

```bash
openclaw onboard --auth-choice venice-api-key
```

Isso ira:

1. Solicitar sua chave de API (ou usar a existente `VENICE_API_KEY`)
2. Mostrar todos os modelos Venice disponiveis
3. Permitir que voce escolha seu modelo padrao
4. Configurar o provedor automaticamente

**Opcao C: Nao interativo**

```bash
openclaw onboard --non-interactive \
  --auth-choice venice-api-key \
  --venice-api-key "vapi_xxxxxxxxxxxx"
```

### 3. Verificar configuracao

```bash
openclaw chat --model venice/llama-3.3-70b "Hello, are you working?"
```

## Selecao de Modelo

Apos a configuracao, o OpenClaw mostra todos os modelos Venice disponiveis. Escolha com base nas suas necessidades:

- **Padrao (nossa escolha)**: `venice/llama-3.3-70b` para inferencia privada com desempenho equilibrado.
- **Melhor qualidade geral**: `venice/claude-opus-45` para tarefas dificeis (Opus continua sendo o mais forte).
- **Privacidade**: Escolha modelos "private" para inferencia totalmente privada.
- **Capacidade**: Escolha modelos "anonymized" para acessar Claude, GPT, Gemini via o proxy da Venice.

Altere seu modelo padrao a qualquer momento:

```bash
openclaw models set venice/claude-opus-45
openclaw models set venice/llama-3.3-70b
```

Liste todos os modelos disponiveis:

```bash
openclaw models list | grep venice
```

## Configurar via `openclaw configure`

1. Execute `openclaw configure`
2. Selecione **Model/auth**
3. Escolha **Venice AI**

## Qual modelo devo usar?

| Caso de uso                | Modelo recomendado               | Por que                                  |
| -------------------------- | -------------------------------- | ---------------------------------------- |
| **Chat geral**             | `llama-3.3-70b`                  | Bom desempenho geral, totalmente privado |
| **Melhor qualidade geral** | `claude-opus-45`                 | Opus continua sendo o mais forte         |
| **Privacidade + Claude**   | `claude-opus-45`                 | Melhor raciocinio via proxy anonimizado  |
| **Programacao**            | `qwen3-coder-480b-a35b-instruct` | Otimizado para codigo, contexto de 262k  |
| **Tarefas de visao**       | `qwen3-vl-235b-a22b`             | Melhor modelo privado de visao           |
| **Sem censura**            | `venice-uncensored`              | Sem restricoes de conteudo               |
| **Rapido + barato**        | `qwen3-4b`                       | Leve, ainda capaz                        |
| **Raciocinio complexo**    | `deepseek-v3.2`                  | Raciocinio forte, privado                |

## Modelos Disponiveis (25 no total)

### Modelos Private (15) — Totalmente privados, sem logs

| ID do modelo                     | Nome                    | Contexto (tokens) | Recursos                |
| -------------------------------- | ----------------------- | ----------------- | ----------------------- |
| `llama-3.3-70b`                  | Llama 3.3 70B           | 131k              | Geral                   |
| `llama-3.2-3b`                   | Llama 3.2 3B            | 131k              | Rapido, leve            |
| `hermes-3-llama-3.1-405b`        | Hermes 3 Llama 3.1 405B | 131k              | Tarefas complexas       |
| `qwen3-235b-a22b-thinking-2507`  | Qwen3 235B Thinking     | 131k              | Raciocinio              |
| `qwen3-235b-a22b-instruct-2507`  | Qwen3 235B Instruct     | 131k              | Geral                   |
| `qwen3-coder-480b-a35b-instruct` | Qwen3 Coder 480B        | 262k              | Codigo                  |
| `qwen3-next-80b`                 | Qwen3 Next 80B          | 262k              | Geral                   |
| `qwen3-vl-235b-a22b`             | Qwen3 VL 235B           | 262k              | Visao                   |
| `qwen3-4b`                       | Venice Small (Qwen3 4B) | 32k               | Rapido, raciocinio      |
| `deepseek-v3.2`                  | DeepSeek V3.2           | 163k              | Raciocinio              |
| `venice-uncensored`              | Venice Uncensored       | 32k               | Sem censura             |
| `mistral-31-24b`                 | Venice Medium (Mistral) | 131k              | Visao                   |
| `google-gemma-3-27b-it`          | Gemma 3 27B Instruct    | 202k              | Visao                   |
| `openai-gpt-oss-120b`            | OpenAI GPT OSS 120B     | 131k              | Geral                   |
| `zai-org-glm-4.7`                | GLM 4.7                 | 202k              | Raciocinio, multilingue |

### Modelos Anonymized (10) — Via proxy da Venice

| ID do modelo             | Original          | Contexto (tokens) | Recursos           |
| ------------------------ | ----------------- | ----------------- | ------------------ |
| `claude-opus-45`         | Claude Opus 4.5   | 202k              | Raciocinio, visao  |
| `claude-sonnet-45`       | Claude Sonnet 4.5 | 202k              | Raciocinio, visao  |
| `openai-gpt-52`          | GPT-5.2           | 262k              | Raciocinio         |
| `openai-gpt-52-codex`    | GPT-5.2 Codex     | 262k              | Raciocinio, visao  |
| `gemini-3-pro-preview`   | Gemini 3 Pro      | 202k              | Raciocinio, visao  |
| `gemini-3-flash-preview` | Gemini 3 Flash    | 262k              | Raciocinio, visao  |
| `grok-41-fast`           | Grok 4.1 Fast     | 262k              | Raciocinio, visao  |
| `grok-code-fast-1`       | Grok Code Fast 1  | 262k              | Raciocinio, codigo |
| `kimi-k2-thinking`       | Kimi K2 Thinking  | 262k              | Raciocinio         |
| `minimax-m21`            | MiniMax M2.1      | 202k              | Raciocinio         |

## Descoberta de Modelos

O OpenClaw descobre automaticamente os modelos da API da Venice quando `VENICE_API_KEY` esta definido. Se a API estiver indisponivel, ele faz fallback para um catalogo estatico.

O endpoint `/models` é publico (nao requer autenticacao para listagem), mas a inferencia exige uma chave de API valida.

## Streaming e Suporte a Ferramentas

| Recurso              | Suporte                                                               |
| -------------------- | --------------------------------------------------------------------- |
| **Streaming**        | ✅ Todos os modelos                                                   |
| **Function calling** | ✅ A maioria dos modelos (verifique `supportsFunctionCalling` na API) |
| **Visao/Imagens**    | ✅ Modelos marcados com o recurso "Vision"                            |
| **Modo JSON**        | ✅ Suportado via `response_format`                                    |

## Precos

A Venice usa um sistema baseado em creditos. Consulte [venice.ai/pricing](https://venice.ai/pricing) para valores atuais:

- **Modelos private**: Geralmente custo mais baixo
- **Modelos anonymized**: Semelhante ao preco da API direta + pequena taxa da Venice

## Comparacao: Venice vs API Direta

| Aspecto         | Venice (Anonymized)              | API Direta           |
| --------------- | -------------------------------- | -------------------- |
| **Privacidade** | Metadados removidos, anonimizado | Sua conta vinculada  |
| **Latencia**    | +10-50ms (proxy)                 | Direta               |
| **Recursos**    | Maioria dos recursos suportados  | Recursos completos   |
| **Cobranca**    | Creditos da Venice               | Cobranca do provedor |

## Exemplos de Uso

```bash
# Use default private model
openclaw chat --model venice/llama-3.3-70b

# Use Claude via Venice (anonymized)
openclaw chat --model venice/claude-opus-45

# Use uncensored model
openclaw chat --model venice/venice-uncensored

# Use vision model with image
openclaw chat --model venice/qwen3-vl-235b-a22b

# Use coding model
openclaw chat --model venice/qwen3-coder-480b-a35b-instruct
```

## Solucao de Problemas

### Chave de API nao reconhecida

```bash
echo $VENICE_API_KEY
openclaw models list | grep venice
```

Certifique-se de que a chave comeca com `vapi_`.

### Modelo nao disponivel

O catalogo de modelos da Venice é atualizado dinamicamente. Execute `openclaw models list` para ver os modelos atualmente disponiveis. Alguns modelos podem estar temporariamente offline.

### Problemas de conexao

A API da Venice esta em `https://api.venice.ai/api/v1`. Verifique se sua rede permite conexoes HTTPS.

## Exemplo de arquivo de configuracao

```json5
{
  env: { VENICE_API_KEY: "vapi_..." },
  agents: { defaults: { model: { primary: "venice/llama-3.3-70b" } } },
  models: {
    mode: "merge",
    providers: {
      venice: {
        baseUrl: "https://api.venice.ai/api/v1",
        apiKey: "${VENICE_API_KEY}",
        api: "openai-completions",
        models: [
          {
            id: "llama-3.3-70b",
            name: "Llama 3.3 70B",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 131072,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

## Links

- [Venice AI](https://venice.ai)
- [Documentacao da API](https://docs.venice.ai)
- [Precos](https://venice.ai/pricing)
- [Status](https://status.venice.ai)
