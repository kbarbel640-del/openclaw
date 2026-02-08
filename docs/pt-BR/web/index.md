---
summary: "Superfícies web do Gateway: UI de Controle, modos de bind e segurança"
read_when:
  - Voce quer acessar o Gateway pelo Tailscale
  - Voce quer a UI de Controle no navegador e a edicao de configuracao
title: "Web"
x-i18n:
  source_path: web/index.md
  source_hash: 1315450b71a799c8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:45Z
---

# Web (Gateway)

O Gateway serve uma pequena **UI de Controle no navegador** (Vite + Lit) a partir da mesma porta do WebSocket do Gateway:

- padrao: `http://<host>:18789/`
- prefixo opcional: defina `gateway.controlUi.basePath` (ex.: `/openclaw`)

As capacidades ficam em [UI de Controle](/web/control-ui).
Esta pagina foca em modos de bind, seguranca e superficies voltadas para a web.

## Webhooks

Quando `hooks.enabled=true`, o Gateway tambem expõe um pequeno endpoint de webhook no mesmo servidor HTTP.
Veja [Configuracao do Gateway](/gateway/configuration) → `hooks` para autenticacao + payloads.

## Config (ativado por padrao)

A UI de Controle fica **ativada por padrao** quando os assets estao presentes (`dist/control-ui`).
Voce pode controla-la via configuracao:

```json5
{
  gateway: {
    controlUi: { enabled: true, basePath: "/openclaw" }, // basePath optional
  },
}
```

## Acesso via Tailscale

### Serve integrado (recomendado)

Mantenha o Gateway em local loopback e deixe o Tailscale Serve fazer o proxy:

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "serve" },
  },
}
```

Depois, inicie o gateway:

```bash
openclaw gateway
```

Abra:

- `https://<magicdns>/` (ou o seu `gateway.controlUi.basePath` configurado)

### Bind no tailnet + token

```json5
{
  gateway: {
    bind: "tailnet",
    controlUi: { enabled: true },
    auth: { mode: "token", token: "your-token" },
  },
}
```

Depois, inicie o gateway (token obrigatorio para binds fora de loopback):

```bash
openclaw gateway
```

Abra:

- `http://<tailscale-ip>:18789/` (ou o seu `gateway.controlUi.basePath` configurado)

### Internet publica (Funnel)

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "funnel" },
    auth: { mode: "password" }, // or OPENCLAW_GATEWAY_PASSWORD
  },
}
```

## Notas de seguranca

- A autenticacao do Gateway e obrigatoria por padrao (token/senha ou cabecalhos de identidade do Tailscale).
- Binds fora de loopback ainda **exigem** um token/senha compartilhado (`gateway.auth` ou env).
- O assistente gera um token do gateway por padrao (mesmo em loopback).
- A UI envia `connect.params.auth.token` ou `connect.params.auth.password`.
- A UI de Controle envia cabecalhos anti-clickjacking e aceita apenas conexoes websocket de navegador de mesma origem,
  a menos que `gateway.controlUi.allowedOrigins` esteja definido.
- Com Serve, os cabecalhos de identidade do Tailscale podem satisfazer a autenticacao quando
  `gateway.auth.allowTailscale` e `true` (nenhum token/senha obrigatorio). Defina
  `gateway.auth.allowTailscale: false` para exigir credenciais explicitas. Veja
  [Tailscale](/gateway/tailscale) e [Seguranca](/gateway/security).
- `gateway.tailscale.mode: "funnel"` exige `gateway.auth.mode: "password"` (senha compartilhada).

## Construindo a UI

O Gateway serve arquivos estaticos a partir de `dist/control-ui`. Construa-os com:

```bash
pnpm ui:build # auto-installs UI deps on first run
```
