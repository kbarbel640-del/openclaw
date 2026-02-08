---
summary: "Referencia da CLI para `openclaw doctor` (verificacoes de saude + reparos guiados)"
read_when:
  - Voce tem problemas de conectividade/autenticacao e quer correcoes guiadas
  - Voce atualizou e quer uma verificacao de sanidade
title: "doctor"
x-i18n:
  source_path: cli/doctor.md
  source_hash: 92310aa3f3d111e9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:34Z
---

# `openclaw doctor`

Verificacoes de saude + correcoes rapidas para o Gateway e os canais.

Relacionado:

- Solucao de problemas: [Troubleshooting](/gateway/troubleshooting)
- Auditoria de seguranca: [Security](/gateway/security)

## Exemplos

```bash
openclaw doctor
openclaw doctor --repair
openclaw doctor --deep
```

Notas:

- Prompts interativos (como correcoes de keychain/OAuth) so sao executados quando o stdin e um TTY e `--non-interactive` **nao** esta definido. Execucoes headless (cron, Telegram, sem terminal) ignoram os prompts.
- `--fix` (alias para `--repair`) grava um backup em `~/.openclaw/openclaw.json.bak` e remove chaves de configuracao desconhecidas, listando cada remocao.

## macOS: substituicoes de env `launchctl`

Se voce executou anteriormente `launchctl setenv OPENCLAW_GATEWAY_TOKEN ...` (ou `...PASSWORD`), esse valor substitui seu arquivo de configuracao e pode causar erros persistentes de “nao autorizado”.

```bash
launchctl getenv OPENCLAW_GATEWAY_TOKEN
launchctl getenv OPENCLAW_GATEWAY_PASSWORD

launchctl unsetenv OPENCLAW_GATEWAY_TOKEN
launchctl unsetenv OPENCLAW_GATEWAY_PASSWORD
```
