---
summary: "Acesso e autenticacao do dashboard do Gateway (Control UI)"
read_when:
  - Alterando os modos de autenticacao ou exposicao do dashboard
title: "Dashboard"
x-i18n:
  source_path: web/dashboard.md
  source_hash: 852e359885574fa3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:44Z
---

# Dashboard (Control UI)

O dashboard do Gateway e a Control UI no navegador servida em `/` por padrao
(sobrescreva com `gateway.controlUi.basePath`).

Abertura rapida (Gateway local):

- http://127.0.0.1:18789/ (ou http://localhost:18789/)

Referencias principais:

- [Control UI](/web/control-ui) para uso e capacidades da UI.
- [Tailscale](/gateway/tailscale) para automacao de Serve/Funnel.
- [Superficies web](/web) para modos de bind e notas de seguranca.

A autenticacao e aplicada no handshake do WebSocket via `connect.params.auth`
(token ou senha). Veja `gateway.auth` em [Configuracao do Gateway](/gateway/configuration).

Nota de seguranca: a Control UI e uma **superficie administrativa** (chat, configuracao, aprovacoes de execucao).
Nao a exponha publicamente. A UI armazena o token em `localStorage` apos o primeiro carregamento.
Prefira localhost, Tailscale Serve ou um tunel SSH.

## Caminho rapido (recomendado)

- Apos a integracao inicial, a CLI abre automaticamente o dashboard e imprime um link limpo (sem token).
- Reabra a qualquer momento: `openclaw dashboard` (copia o link, abre o navegador se possivel e mostra dica de SSH se estiver headless).
- Se a UI solicitar autenticacao, cole o token de `gateway.auth.token` (ou `OPENCLAW_GATEWAY_TOKEN`) nas configuracoes da Control UI.

## Basico de token (local vs remoto)

- **Localhost**: abra `http://127.0.0.1:18789/`.
- **Fonte do token**: `gateway.auth.token` (ou `OPENCLAW_GATEWAY_TOKEN`); a UI armazena uma copia no localStorage depois que voce se conecta.
- **Nao localhost**: use Tailscale Serve (sem token se `gateway.auth.allowTailscale: true`), bind no tailnet com um token ou um tunel SSH. Veja [Superficies web](/web).

## Se voce ver “unauthorized” / 1008

- Garanta que o gateway esteja acessivel (local: `openclaw status`; remoto: tunel SSH `ssh -N -L 18789:127.0.0.1:18789 user@host` e depois abra `http://127.0.0.1:18789/`).
- Recupere o token no host do gateway: `openclaw config get gateway.auth.token` (ou gere um: `openclaw doctor --generate-gateway-token`).
- Nas configuracoes do dashboard, cole o token no campo de autenticacao e conecte.
