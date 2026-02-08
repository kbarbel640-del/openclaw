---
summary: "Monitore a expiracao do OAuth para provedores de modelos"
read_when:
  - Configurar monitoramento ou alertas de expiracao de autenticacao
  - Automatizar verificacoes de atualizacao de OAuth do Claude Code / Codex
title: "Monitoramento de Autenticacao"
x-i18n:
  source_path: automation/auth-monitoring.md
  source_hash: eef179af9545ed7a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:06Z
---

# Monitoramento de autenticacao

O OpenClaw expõe a saude de expiracao do OAuth via `openclaw models status`. Use isso para
automacao e alertas; scripts sao extras opcionais para fluxos de trabalho no telefone.

## Preferido: verificacao via CLI (portatil)

```bash
openclaw models status --check
```

Codigos de saida:

- `0`: OK
- `1`: credenciais expiradas ou ausentes
- `2`: expirando em breve (em ate 24h)

Isso funciona em cron/systemd e nao requer scripts extras.

## Scripts opcionais (ops / fluxos de trabalho no telefone)

Eles ficam em `scripts/` e sao **opcionais**. Eles assumem acesso SSH ao
host do Gateway e sao ajustados para systemd + Termux.

- `scripts/claude-auth-status.sh` agora usa `openclaw models status --json` como a
  fonte de verdade (recorrendo a leituras diretas de arquivo se a CLI nao estiver disponivel),
  entao mantenha `openclaw` em `PATH` para timers.
- `scripts/auth-monitor.sh`: alvo de timer cron/systemd; envia alertas (ntfy ou telefone).
- `scripts/systemd/openclaw-auth-monitor.{service,timer}`: timer de usuario do systemd.
- `scripts/claude-auth-status.sh`: verificador de autenticacao do Claude Code + OpenClaw (completo/json/simples).
- `scripts/mobile-reauth.sh`: fluxo guiado de reautenticacao via SSH.
- `scripts/termux-quick-auth.sh`: status em widget de um toque + abrir URL de autenticacao.
- `scripts/termux-auth-widget.sh`: fluxo completo guiado por widget.
- `scripts/termux-sync-widget.sh`: sincronizar credenciais do Claude Code → OpenClaw.

Se voce nao precisa de automacao no telefone ou timers do systemd, ignore esses scripts.
