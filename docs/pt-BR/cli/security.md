---
summary: "Referencia da CLI para `openclaw security` (auditar e corrigir armadilhas comuns de seguranca)"
read_when:
  - Voce quer executar uma auditoria rapida de seguranca na configuracao/estado
  - Voce quer aplicar sugestoes seguras de “correcao” (chmod, restringir padroes)
title: "seguranca"
x-i18n:
  source_path: cli/security.md
  source_hash: 96542b4784e53933
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:47Z
---

# `openclaw security`

Ferramentas de seguranca (auditoria + correcoes opcionais).

Relacionado:

- Guia de seguranca: [Seguranca](/gateway/security)

## Auditoria

```bash
openclaw security audit
openclaw security audit --deep
openclaw security audit --fix
```

A auditoria avisa quando varios remetentes de Mensagem direta compartilham a sessao principal e recomenda **modo seguro de Mensagem direta**: `session.dmScope="per-channel-peer"` (ou `per-account-channel-peer` para canais de varias contas) para caixas de entrada compartilhadas.
Ela tambem avisa quando modelos pequenos (`<=300B`) sao usados sem sandboxing e com ferramentas web/navegador habilitadas.
