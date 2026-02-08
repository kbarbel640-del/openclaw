---
summary: "Use o MiniMax M2.1 no OpenClaw"
read_when:
  - Voce quer modelos MiniMax no OpenClaw
  - Voce precisa de orientacao de configuracao do MiniMax
title: "MiniMax"
x-i18n:
  source_path: providers/minimax.md
  source_hash: 5bbd47fa3327e40c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:11Z
---

# MiniMax

A MiniMax é uma empresa de IA que desenvolve a família de modelos **M2/M2.1**. A versão atual focada em programação é o **MiniMax M2.1** (23 de dezembro de 2025), criada para tarefas complexas do mundo real.

Fonte: [Nota de lancamento do MiniMax M2.1](https://www.minimax.io/news/minimax-m21)

## Visao geral do modelo (M2.1)

A MiniMax destaca estas melhorias no M2.1:

- **Programacao multilíngue** mais forte (Rust, Java, Go, C++, Kotlin, Objective-C, TS/JS).
- Melhor **desenvolvimento web/app** e qualidade estetica de saida (incluindo mobile nativo).
- Tratamento aprimorado de **instrucoes compostas** para fluxos de trabalho no estilo escritorio, com base em pensamento intercalado e execucao integrada de restricoes.
- **Respostas mais concisas** com menor uso de tokens e ciclos de iteracao mais rapidos.
- Compatibilidade mais forte com **frameworks de ferramentas/agentes** e gerenciamento de contexto (Claude Code, Droid/Factory AI, Cline, Kilo Code, Roo Code, BlackBox).
- Saidas de **dialogo e escrita tecnica** de maior qualidade.

## MiniMax M2.1 vs MiniMax M2.1 Lightning

- **Velocidade:** Lightning é a variante “rapida” na documentacao de precos da MiniMax.
- **Custo:** Os precos mostram o mesmo custo de entrada, mas o Lightning tem custo de saida mais alto.
- **Roteamento do plano de programacao:** O back-end Lightning nao esta diretamente disponivel no plano de programacao da MiniMax. A MiniMax roteia automaticamente a maioria das solicitacoes para o Lightning, mas faz fallback para o back-end M2.1 regular durante picos de trafego.

## Escolha uma configuracao

### MiniMax OAuth (Plano de Programacao) — recomendado

**Ideal para:** configuracao rapida com o Plano de Programacao MiniMax via OAuth, sem necessidade de chave de API.

Ative o plugin OAuth integrado e autentique:

```bash
openclaw plugins enable minimax-portal-auth  # skip if already loaded.
openclaw gateway restart  # restart if gateway is already running
openclaw onboard --auth-choice minimax-portal
```

Voce sera solicitado a selecionar um endpoint:

- **Global** - Usuarios internacionais (`api.minimax.io`)
- **CN** - Usuarios na China (`api.minimaxi.com`)

Veja o [README do plugin MiniMax OAuth](https://github.com/openclaw/openclaw/tree/main/extensions/minimax-portal-auth) para mais detalhes.

### MiniMax M2.1 (chave de API)

**Ideal para:** MiniMax hospedado com API compativel com Anthropic.

Configure via CLI:

- Execute `openclaw configure`
- Selecione **Model/auth**
- Escolha **MiniMax M2.1**

```json5
{
  env: { MINIMAX_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "minimax/MiniMax-M2.1" } } },
  models: {
    mode: "merge",
    providers: {
      minimax: {
        baseUrl: "https://api.minimax.io/anthropic",
        apiKey: "${MINIMAX_API_KEY}",
        api: "anthropic-messages",
        models: [
          {
            id: "MiniMax-M2.1",
            name: "MiniMax M2.1",
            reasoning: false,
            input: ["text"],
            cost: { input: 15, output: 60, cacheRead: 2, cacheWrite: 10 },
            contextWindow: 200000,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

### MiniMax M2.1 como fallback (Opus primario)

**Ideal para:** manter o Opus 4.6 como primario, com failover para o MiniMax M2.1.

```json5
{
  env: { MINIMAX_API_KEY: "sk-..." },
  agents: {
    defaults: {
      models: {
        "anthropic/claude-opus-4-6": { alias: "opus" },
        "minimax/MiniMax-M2.1": { alias: "minimax" },
      },
      model: {
        primary: "anthropic/claude-opus-4-6",
        fallbacks: ["minimax/MiniMax-M2.1"],
      },
    },
  },
}
```

### Opcional: Local via LM Studio (manual)

**Ideal para:** inferencia local com o LM Studio.
Observamos resultados fortes com o MiniMax M2.1 em hardware potente (por exemplo, um
desktop/servidor) usando o servidor local do LM Studio.

Configure manualmente via `openclaw.json`:

```json5
{
  agents: {
    defaults: {
      model: { primary: "lmstudio/minimax-m2.1-gs32" },
      models: { "lmstudio/minimax-m2.1-gs32": { alias: "Minimax" } },
    },
  },
  models: {
    mode: "merge",
    providers: {
      lmstudio: {
        baseUrl: "http://127.0.0.1:1234/v1",
        apiKey: "lmstudio",
        api: "openai-responses",
        models: [
          {
            id: "minimax-m2.1-gs32",
            name: "MiniMax M2.1 GS32",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 196608,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

## Configure via `openclaw configure`

Use o assistente de configuracao interativo para definir o MiniMax sem editar JSON:

1. Execute `openclaw configure`.
2. Selecione **Model/auth**.
3. Escolha **MiniMax M2.1**.
4. Selecione seu modelo padrao quando solicitado.

## Opcoes de configuracao

- `models.providers.minimax.baseUrl`: prefira `https://api.minimax.io/anthropic` (compativel com Anthropic); `https://api.minimax.io/v1` é opcional para payloads compativeis com OpenAI.
- `models.providers.minimax.api`: prefira `anthropic-messages`; `openai-completions` é opcional para payloads compativeis com OpenAI.
- `models.providers.minimax.apiKey`: chave de API MiniMax (`MINIMAX_API_KEY`).
- `models.providers.minimax.models`: defina `id`, `name`, `reasoning`, `contextWindow`, `maxTokens`, `cost`.
- `agents.defaults.models`: crie aliases para os modelos que voce deseja na allowlist.
- `models.mode`: mantenha `merge` se voce quiser adicionar o MiniMax junto com os integrados.

## Notas

- As referencias de modelo sao `minimax/<model>`.
- API de uso do Plano de Programacao: `https://api.minimaxi.com/v1/api/openplatform/coding_plan/remains` (requer uma chave de plano de programacao).
- Atualize os valores de preco em `models.json` se voce precisar de rastreamento exato de custos.
- Link de indicacao para o Plano de Programacao MiniMax (10% de desconto): https://platform.minimax.io/subscribe/coding-plan?code=DbXJTRClnb&source=link
- Veja [/concepts/model-providers](/concepts/model-providers) para regras de provedores.
- Use `openclaw models list` e `openclaw models set minimax/MiniMax-M2.1` para alternar.

## Solucao de problemas

### “Unknown model: minimax/MiniMax-M2.1”

Isso geralmente significa que o **provedor MiniMax nao esta configurado** (nenhuma entrada de provedor
e nenhum perfil/chave de autenticacao MiniMax encontrado). Uma correcao para essa deteccao esta em
**2026.1.12** (nao lancada no momento da escrita). Corrija ao:

- Atualizar para **2026.1.12** (ou executar a partir do codigo-fonte `main`), depois reiniciar o Gateway.
- Executar `openclaw configure` e selecionar **MiniMax M2.1**, ou
- Adicionar o bloco `models.providers.minimax` manualmente, ou
- Definir `MINIMAX_API_KEY` (ou um perfil de autenticacao MiniMax) para que o provedor possa ser injetado.

Certifique-se de que o id do modelo seja **sensivel a maiusculas e minusculas**:

- `minimax/MiniMax-M2.1`
- `minimax/MiniMax-M2.1-lightning`

Em seguida, verifique novamente com:

```bash
openclaw models list
```
