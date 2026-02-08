---
summary: "Serve/Funnel do Tailscale integrados ao painel do Gateway"
read_when:
  - Expondo a UI de Controle do Gateway fora do localhost
  - Automatizando o acesso ao painel do tailnet ou público
title: "Tailscale"
x-i18n:
  source_path: gateway/tailscale.md
  source_hash: c900c70a9301f290
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:28Z
---

# Tailscale (painel do Gateway)

O OpenClaw pode configurar automaticamente o Tailscale **Serve** (tailnet) ou **Funnel** (público) para o
painel do Gateway e a porta WebSocket. Isso mantém o Gateway vinculado ao loopback enquanto
o Tailscale fornece HTTPS, roteamento e (no caso do Serve) cabeçalhos de identidade.

## Modos

- `serve`: Serve apenas para o tailnet via `tailscale serve`. O gateway permanece em `127.0.0.1`.
- `funnel`: HTTPS público via `tailscale funnel`. O OpenClaw requer uma senha compartilhada.
- `off`: Padrão (sem automação do Tailscale).

## Autenticação

Defina `gateway.auth.mode` para controlar o handshake:

- `token` (padrão quando `OPENCLAW_GATEWAY_TOKEN` está definido)
- `password` (segredo compartilhado via `OPENCLAW_GATEWAY_PASSWORD` ou configuração)

Quando `tailscale.mode = "serve"` e `gateway.auth.allowTailscale` é `true`,
requisições de proxy Serve válidas podem se autenticar via cabeçalhos de identidade do Tailscale
(`tailscale-user-login`) sem fornecer um token/senha. O OpenClaw verifica
a identidade resolvendo o endereço `x-forwarded-for` por meio do daemon local do Tailscale
(`tailscale whois`) e comparando-o com o cabeçalho antes de aceitá-lo.
O OpenClaw só trata uma requisição como Serve quando ela chega do loopback com
os cabeçalhos do Tailscale `x-forwarded-for`, `x-forwarded-proto` e `x-forwarded-host`.
Para exigir credenciais explícitas, defina `gateway.auth.allowTailscale: false` ou
force `gateway.auth.mode: "password"`.

## Exemplos de configuração

### Apenas tailnet (Serve)

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "serve" },
  },
}
```

Abrir: `https://<magicdns>/` (ou o `gateway.controlUi.basePath` configurado)

### Apenas tailnet (vincular ao IP do Tailnet)

Use isso quando você quiser que o Gateway escute diretamente no IP do Tailnet (sem Serve/Funnel).

```json5
{
  gateway: {
    bind: "tailnet",
    auth: { mode: "token", token: "your-token" },
  },
}
```

Conecte a partir de outro dispositivo do Tailnet:

- UI de Controle: `http://<tailscale-ip>:18789/`
- WebSocket: `ws://<tailscale-ip>:18789`

Observação: o loopback (`http://127.0.0.1:18789`) **não** funcionará neste modo.

### Internet pública (Funnel + senha compartilhada)

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "funnel" },
    auth: { mode: "password", password: "replace-me" },
  },
}
```

Prefira `OPENCLAW_GATEWAY_PASSWORD` em vez de gravar uma senha em disco.

## Exemplos de CLI

```bash
openclaw gateway --tailscale serve
openclaw gateway --tailscale funnel --auth password
```

## Notas

- O Tailscale Serve/Funnel requer que a CLI `tailscale` esteja instalada e com login efetuado.
- `tailscale.mode: "funnel"` se recusa a iniciar a menos que o modo de autenticação seja `password` para evitar exposição pública.
- Defina `gateway.tailscale.resetOnExit` se você quiser que o OpenClaw desfaça a configuração de `tailscale serve`
  ou `tailscale funnel` ao encerrar.
- `gateway.bind: "tailnet"` é um vínculo direto ao Tailnet (sem HTTPS, sem Serve/Funnel).
- `gateway.bind: "auto"` prefere loopback; use `tailnet` se você quiser apenas Tailnet.
- Serve/Funnel expõem apenas a **UI de controle do Gateway + WS**. Os nós se conectam pelo
  mesmo endpoint WS do Gateway, portanto o Serve pode funcionar para acesso aos nós.

## Controle pelo navegador (Gateway remoto + navegador local)

Se você executar o Gateway em uma máquina, mas quiser operar um navegador em outra,
execute um **host de nó** na máquina do navegador e mantenha ambos no mesmo tailnet.
O Gateway irá fazer proxy das ações do navegador para o nó; não é necessário um servidor de controle separado nem uma URL do Serve.

Evite o Funnel para controle por navegador; trate o pareamento de nós como acesso de operador.

## Pré-requisitos + limites do Tailscale

- O Serve requer HTTPS habilitado para o seu tailnet; a CLI solicita caso esteja ausente.
- O Serve injeta cabeçalhos de identidade do Tailscale; o Funnel não.
- O Funnel requer Tailscale v1.38.3+, MagicDNS, HTTPS habilitado e um atributo de nó de funnel.
- O Funnel suporta apenas as portas `443`, `8443` e `10000` sobre TLS.
- O Funnel no macOS requer a variante de aplicativo Tailscale de código aberto.

## Saiba mais

- Visão geral do Tailscale Serve: https://tailscale.com/kb/1312/serve
- Comando `tailscale serve`: https://tailscale.com/kb/1242/tailscale-serve
- Visão geral do Tailscale Funnel: https://tailscale.com/kb/1223/tailscale-funnel
- Comando `tailscale funnel`: https://tailscale.com/kb/1311/tailscale-funnel
