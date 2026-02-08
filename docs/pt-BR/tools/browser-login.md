---
summary: "Logins manuais para automação de navegador + postagem no X/Twitter"
read_when:
  - Voce precisa fazer login em sites para automacao de navegador
  - Voce quer postar atualizacoes no X/Twitter
title: "Login do navegador"
x-i18n:
  source_path: tools/browser-login.md
  source_hash: 8ceea2d5258836e3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:32Z
---

# Login do navegador + postagem no X/Twitter

## Login manual (recomendado)

Quando um site exige login, **entre manualmente** no perfil do navegador **host** (o navegador do OpenClaw).

**Nao** forneca suas credenciais ao modelo. Logins automatizados geralmente acionam defesas anti‑bot e podem bloquear a conta.

Voltar para a documentacao principal do navegador: [Browser](/tools/browser).

## Qual perfil do Chrome e usado?

O OpenClaw controla um **perfil dedicado do Chrome** (chamado `openclaw`, interface com tom alaranjado). Ele e separado do seu perfil de uso diario.

Duas formas simples de acessa-lo:

1. **Peca ao agente para abrir o navegador** e depois faca o login voce mesmo.
2. **Abra via CLI**:

```bash
openclaw browser start
openclaw browser open https://x.com
```

Se voce tiver varios perfis, passe `--browser-profile <name>` (o padrao e `openclaw`).

## X/Twitter: fluxo recomendado

- **Leitura/pesquisa/threads:** use a Skill de CLI **bird** (sem navegador, estavel).
  - Repo: https://github.com/steipete/bird
- **Postar atualizacoes:** use o navegador **host** (login manual).

## Sandboxing + acesso ao navegador host

Sessoes de navegador em sandbox sao **mais propensas** a acionar deteccao de bots. Para X/Twitter (e outros sites rigorosos), prefira o navegador **host**.

Se o agente estiver em sandbox, a ferramenta de navegador usa o sandbox por padrao. Para permitir controle do host:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        browser: {
          allowHostControl: true,
        },
      },
    },
  },
}
```

Depois direcione para o navegador host:

```bash
openclaw browser open https://x.com --browser-profile openclaw --target host
```

Ou desative o sandboxing para o agente que publica atualizacoes.
