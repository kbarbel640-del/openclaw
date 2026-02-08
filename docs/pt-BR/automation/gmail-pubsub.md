---
summary: "Push do Gmail Pub/Sub integrado aos webhooks do OpenClaw via gogcli"
read_when:
  - Conectando gatilhos da caixa de entrada do Gmail ao OpenClaw
  - Configurando push do Pub/Sub para despertar o agente
title: "Gmail PubSub"
x-i18n:
  source_path: automation/gmail-pubsub.md
  source_hash: dfb92133b69177e4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:16Z
---

# Gmail Pub/Sub -> OpenClaw

Objetivo: monitoramento do Gmail -> push do Pub/Sub -> `gog gmail watch serve` -> webhook do OpenClaw.

## Prereqs

- `gcloud` instalado e com login efetuado ([guia de instalação](https://docs.cloud.google.com/sdk/docs/install-sdk)).
- `gog` (gogcli) instalado e autorizado para a conta do Gmail ([gogcli.sh](https://gogcli.sh/)).
- Hooks do OpenClaw habilitados (veja [Webhooks](/automation/webhook)).
- `tailscale` com login efetuado ([tailscale.com](https://tailscale.com/)). A configuração suportada usa o Tailscale Funnel para o endpoint HTTPS público.
  Outros serviços de túnel podem funcionar, mas são DIY/não suportados e exigem configuração manual.
  No momento, o Tailscale é o que oferecemos suporte.

Exemplo de configuração de hook (habilite o mapeamento predefinido do Gmail):

```json5
{
  hooks: {
    enabled: true,
    token: "OPENCLAW_HOOK_TOKEN",
    path: "/hooks",
    presets: ["gmail"],
  },
}
```

Para entregar o resumo do Gmail a uma superfície de chat, substitua o preset por um mapeamento
que defina `deliver` + opcional `channel`/`to`:

```json5
{
  hooks: {
    enabled: true,
    token: "OPENCLAW_HOOK_TOKEN",
    presets: ["gmail"],
    mappings: [
      {
        match: { path: "gmail" },
        action: "agent",
        wakeMode: "now",
        name: "Gmail",
        sessionKey: "hook:gmail:{{messages[0].id}}",
        messageTemplate: "New email from {{messages[0].from}}\nSubject: {{messages[0].subject}}\n{{messages[0].snippet}}\n{{messages[0].body}}",
        model: "openai/gpt-5.2-mini",
        deliver: true,
        channel: "last",
        // to: "+15551234567"
      },
    ],
  },
}
```

Se voce quiser um canal fixo, defina `channel` + `to`. Caso contrario, `channel: "last"`
usa a ultima rota de entrega (retorna para WhatsApp).

Para forcar um modelo mais barato para execucoes do Gmail, defina `model` no mapeamento
(`provider/model` ou alias). Se voce aplicar `agents.defaults.models`, inclua isso la.

Para definir um modelo padrao e nivel de raciocinio especificamente para hooks do Gmail, adicione
`hooks.gmail.model` / `hooks.gmail.thinking` na sua configuracao:

```json5
{
  hooks: {
    gmail: {
      model: "openrouter/meta-llama/llama-3.3-70b-instruct:free",
      thinking: "off",
    },
  },
}
```

Notas:

- `model`/`thinking` por hook no mapeamento ainda substitui esses padroes.
- Ordem de fallback: `hooks.gmail.model` → `agents.defaults.model.fallbacks` → primario (auth/limite de taxa/timeouts).
- Se `agents.defaults.models` estiver definido, o modelo do Gmail deve estar na allowlist.
- O conteudo do hook do Gmail e envolvido por limites de seguranca de conteudo externo por padrao.
  Para desativar (perigoso), defina `hooks.gmail.allowUnsafeExternalContent: true`.

Para personalizar ainda mais o tratamento do payload, adicione `hooks.mappings` ou um modulo de transformacao JS/TS
em `hooks.transformsDir` (veja [Webhooks](/automation/webhook)).

## Assistente (recomendado)

Use o helper do OpenClaw para conectar tudo (instala dependencias no macOS via brew):

```bash
openclaw webhooks gmail setup \
  --account openclaw@gmail.com
```

Padroes:

- Usa o Tailscale Funnel para o endpoint publico de push.
- Grava a configuracao `hooks.gmail` para `openclaw webhooks gmail run`.
- Habilita o preset de hook do Gmail (`hooks.presets: ["gmail"]`).

Nota de caminho: quando `tailscale.mode` esta habilitado, o OpenClaw define automaticamente
`hooks.gmail.serve.path` como `/` e mantem o caminho publico em
`hooks.gmail.tailscale.path` (padrao `/gmail-pubsub`) porque o Tailscale
remove o prefixo set-path antes de fazer o proxy.
Se voce precisar que o backend receba o caminho com prefixo, defina
`hooks.gmail.tailscale.target` (ou `--tailscale-target`) para uma URL completa como
`http://127.0.0.1:8788/gmail-pubsub` e combine com `hooks.gmail.serve.path`.

Quer um endpoint personalizado? Use `--push-endpoint <url>` ou `--tailscale off`.

Nota de plataforma: no macOS o assistente instala `gcloud`, `gogcli` e `tailscale`
via Homebrew; no Linux instale-os manualmente antes.

Inicializacao automatica do Gateway (recomendado):

- Quando `hooks.enabled=true` e `hooks.gmail.account` estao definidos, o Gateway inicia
  `gog gmail watch serve` na inicializacao e renova automaticamente o watch.
- Defina `OPENCLAW_SKIP_GMAIL_WATCHER=1` para optar por nao usar (util se voce executa o daemon manualmente).
- Nao execute o daemon manual ao mesmo tempo, ou voce tera
  `listen tcp 127.0.0.1:8788: bind: address already in use`.

Daemon manual (inicia `gog gmail watch serve` + renovacao automatica):

```bash
openclaw webhooks gmail run
```

## Configuracao unica

1. Selecione o projeto do GCP **que possui o cliente OAuth** usado por `gog`.

```bash
gcloud auth login
gcloud config set project <project-id>
```

Nota: o watch do Gmail exige que o topico do Pub/Sub esteja no mesmo projeto que o cliente OAuth.

2. Habilite as APIs:

```bash
gcloud services enable gmail.googleapis.com pubsub.googleapis.com
```

3. Crie um topico:

```bash
gcloud pubsub topics create gog-gmail-watch
```

4. Permita que o push do Gmail publique:

```bash
gcloud pubsub topics add-iam-policy-binding gog-gmail-watch \
  --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
  --role=roles/pubsub.publisher
```

## Iniciar o watch

```bash
gog gmail watch start \
  --account openclaw@gmail.com \
  --label INBOX \
  --topic projects/<project-id>/topics/gog-gmail-watch
```

Salve o `history_id` da saida (para depuracao).

## Executar o handler de push

Exemplo local (autenticacao por token compartilhado):

```bash
gog gmail watch serve \
  --account openclaw@gmail.com \
  --bind 127.0.0.1 \
  --port 8788 \
  --path /gmail-pubsub \
  --token <shared> \
  --hook-url http://127.0.0.1:18789/hooks/gmail \
  --hook-token OPENCLAW_HOOK_TOKEN \
  --include-body \
  --max-bytes 20000
```

Notas:

- `--token` protege o endpoint de push (`x-gog-token` ou `?token=`).
- `--hook-url` aponta para o OpenClaw `/hooks/gmail` (mapeado; execucao isolada + resumo para o principal).
- `--include-body` e `--max-bytes` controlam o trecho do corpo enviado ao OpenClaw.

Recomendado: `openclaw webhooks gmail run` envolve o mesmo fluxo e renova automaticamente o watch.

## Expor o handler (avancado, nao suportado)

Se voce precisar de um tunel que nao seja Tailscale, conecte manualmente e use a URL publica na
inscricao de push (nao suportado, sem protecoes):

```bash
cloudflared tunnel --url http://127.0.0.1:8788 --no-autoupdate
```

Use a URL gerada como o endpoint de push:

```bash
gcloud pubsub subscriptions create gog-gmail-watch-push \
  --topic gog-gmail-watch \
  --push-endpoint "https://<public-url>/gmail-pubsub?token=<shared>"
```

Producao: use um endpoint HTTPS estavel e configure OIDC JWT do Pub/Sub, depois execute:

```bash
gog gmail watch serve --verify-oidc --oidc-email <svc@...>
```

## Teste

Envie uma mensagem para a caixa de entrada monitorada:

```bash
gog gmail send \
  --account openclaw@gmail.com \
  --to openclaw@gmail.com \
  --subject "watch test" \
  --body "ping"
```

Verifique o estado do watch e o historico:

```bash
gog gmail watch status --account openclaw@gmail.com
gog gmail history --account openclaw@gmail.com --since <historyId>
```

## Solucao de problemas

- `Invalid topicName`: incompatibilidade de projeto (topico nao esta no projeto do cliente OAuth).
- `User not authorized`: falta `roles/pubsub.publisher` no topico.
- Mensagens vazias: o push do Gmail fornece apenas `historyId`; busque via `gog gmail history`.

## Limpeza

```bash
gog gmail watch stop --account openclaw@gmail.com
gcloud pubsub subscriptions delete gog-gmail-watch-push
gcloud pubsub topics delete gog-gmail-watch
```
