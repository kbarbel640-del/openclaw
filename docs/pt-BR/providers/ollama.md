---
summary: "Execute o OpenClaw com o Ollama (runtime local de LLM)"
read_when:
  - Voce quer executar o OpenClaw com modelos locais via Ollama
  - Voce precisa de orientacao de configuracao e setup do Ollama
title: "Ollama"
x-i18n:
  source_path: providers/ollama.md
  source_hash: 2992dd0a456d19c3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:15Z
---

# Ollama

Ollama é um runtime local de LLM que facilita executar modelos open-source na sua máquina. O OpenClaw se integra à API compatível com OpenAI do Ollama e pode **descobrir automaticamente modelos com suporte a ferramentas** quando voce opta por `OLLAMA_API_KEY` (ou um perfil de autenticação) e não define uma entrada explícita de `models.providers.ollama`.

## Inicio rapido

1. Instale o Ollama: https://ollama.ai

2. Baixe um modelo:

```bash
ollama pull gpt-oss:20b
# or
ollama pull llama3.3
# or
ollama pull qwen2.5-coder:32b
# or
ollama pull deepseek-r1:32b
```

3. Ative o Ollama para o OpenClaw (qualquer valor funciona; o Ollama não exige uma chave real):

```bash
# Set environment variable
export OLLAMA_API_KEY="ollama-local"

# Or configure in your config file
openclaw config set models.providers.ollama.apiKey "ollama-local"
```

4. Use modelos do Ollama:

```json5
{
  agents: {
    defaults: {
      model: { primary: "ollama/gpt-oss:20b" },
    },
  },
}
```

## Descoberta de modelos (provedor implícito)

Quando voce define `OLLAMA_API_KEY` (ou um perfil de autenticação) e **não** define `models.providers.ollama`, o OpenClaw descobre modelos a partir da instância local do Ollama em `http://127.0.0.1:11434`:

- Consulta `/api/tags` e `/api/show`
- Mantém apenas modelos que relatam capacidade `tools`
- Marca `reasoning` quando o modelo relata `thinking`
- Lê `contextWindow` de `model_info["<arch>.context_length"]` quando disponível
- Define `maxTokens` como 10× a janela de contexto
- Define todos os custos como `0`

Isso evita entradas manuais de modelos enquanto mantém o catálogo alinhado às capacidades do Ollama.

Para ver quais modelos estão disponíveis:

```bash
ollama list
openclaw models list
```

Para adicionar um novo modelo, basta baixá-lo com o Ollama:

```bash
ollama pull mistral
```

O novo modelo será automaticamente descoberto e ficará disponível para uso.

Se voce definir `models.providers.ollama` explicitamente, a descoberta automática é ignorada e voce deve definir os modelos manualmente (veja abaixo).

## Configuracao

### Configuracao basica (descoberta implícita)

A forma mais simples de habilitar o Ollama é via variavel de ambiente:

```bash
export OLLAMA_API_KEY="ollama-local"
```

### Configuracao explícita (modelos manuais)

Use configuracao explícita quando:

- O Ollama roda em outro host/porta.
- Voce quer forçar janelas de contexto específicas ou listas de modelos.
- Voce quer incluir modelos que não relatam suporte a ferramentas.

```json5
{
  models: {
    providers: {
      ollama: {
        // Use a host that includes /v1 for OpenAI-compatible APIs
        baseUrl: "http://ollama-host:11434/v1",
        apiKey: "ollama-local",
        api: "openai-completions",
        models: [
          {
            id: "gpt-oss:20b",
            name: "GPT-OSS 20B",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 8192,
            maxTokens: 8192 * 10
          }
        ]
      }
    }
  }
}
```

Se `OLLAMA_API_KEY` estiver definido, voce pode omitir `apiKey` na entrada do provedor e o OpenClaw irá preenchê-lo para verificações de disponibilidade.

### URL base personalizada (configuracao explícita)

Se o Ollama estiver rodando em um host ou porta diferentes (a configuracao explícita desativa a descoberta automática, portanto defina os modelos manualmente):

```json5
{
  models: {
    providers: {
      ollama: {
        apiKey: "ollama-local",
        baseUrl: "http://ollama-host:11434/v1",
      },
    },
  },
}
```

### Seleção de modelos

Depois de configurado, todos os seus modelos do Ollama ficam disponíveis:

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "ollama/gpt-oss:20b",
        fallbacks: ["ollama/llama3.3", "ollama/qwen2.5-coder:32b"],
      },
    },
  },
}
```

## Avancado

### Modelos de raciocínio

O OpenClaw marca modelos como capazes de raciocínio quando o Ollama relata `thinking` em `/api/show`:

```bash
ollama pull deepseek-r1:32b
```

### Custos dos modelos

O Ollama é gratuito e roda localmente, então todos os custos dos modelos são definidos como $0.

### Configuracao de streaming

Devido a um [problema conhecido](https://github.com/badlogic/pi-mono/issues/1205) no SDK subjacente com o formato de resposta do Ollama, **o streaming é desativado por padrão** para modelos do Ollama. Isso evita respostas corrompidas ao usar modelos com suporte a ferramentas.

Quando o streaming está desativado, as respostas são entregues de uma só vez (modo não streaming), o que evita o problema em que deltas intercalados de conteúdo/raciocínio causam saída embaralhada.

#### Reativar streaming (avancado)

Se voce quiser reativar o streaming para o Ollama (pode causar problemas com modelos com suporte a ferramentas):

```json5
{
  agents: {
    defaults: {
      models: {
        "ollama/gpt-oss:20b": {
          streaming: true,
        },
      },
    },
  },
}
```

#### Desativar streaming para outros provedores

Voce também pode desativar o streaming para qualquer provedor, se necessário:

```json5
{
  agents: {
    defaults: {
      models: {
        "openai/gpt-4": {
          streaming: false,
        },
      },
    },
  },
}
```

### Janelas de contexto

Para modelos descobertos automaticamente, o OpenClaw usa a janela de contexto relatada pelo Ollama quando disponível; caso contrário, o padrão é `8192`. Voce pode sobrescrever `contextWindow` e `maxTokens` na configuracao explícita do provedor.

## Solucao de problemas

### Ollama não detectado

Certifique-se de que o Ollama esteja em execução e que voce tenha definido `OLLAMA_API_KEY` (ou um perfil de autenticação), e que voce **não** tenha definido uma entrada explícita de `models.providers.ollama`:

```bash
ollama serve
```

E que a API esteja acessível:

```bash
curl http://localhost:11434/api/tags
```

### Nenhum modelo disponível

O OpenClaw só descobre automaticamente modelos que relatam suporte a ferramentas. Se o seu modelo não estiver listado, faça uma das opções:

- Baixe um modelo com suporte a ferramentas, ou
- Defina o modelo explicitamente em `models.providers.ollama`.

Para adicionar modelos:

```bash
ollama list  # See what's installed
ollama pull gpt-oss:20b  # Pull a tool-capable model
ollama pull llama3.3     # Or another model
```

### Conexao recusada

Verifique se o Ollama está rodando na porta correta:

```bash
# Check if Ollama is running
ps aux | grep ollama

# Or restart Ollama
ollama serve
```

### Respostas corrompidas ou nomes de ferramentas na saída

Se voce vir respostas embaralhadas contendo nomes de ferramentas (como `sessions_send`, `memory_get`) ou texto fragmentado ao usar modelos do Ollama, isso ocorre devido a um problema no SDK upstream com respostas em streaming. **Isso é corrigido por padrão** na versão mais recente do OpenClaw ao desativar o streaming para modelos do Ollama.

Se voce ativou manualmente o streaming e enfrenta esse problema:

1. Remova a configuracao `streaming: true` das entradas de modelo do Ollama, ou
2. Defina explicitamente `streaming: false` para modelos do Ollama (veja [Configuracao de streaming](#streaming-configuration))

## Veja também

- [Provedores de modelo](/concepts/model-providers) - Visao geral de todos os provedores
- [Seleção de modelos](/concepts/models) - Como escolher modelos
- [Configuracao](/gateway/configuration) - Referência completa de configuracao
