---
summary: "Hub de solucao de problemas: sintomas → verificacoes → correcoes"
read_when:
  - Voce ve um erro e quer o caminho de correcao
  - O instalador diz “success”, mas a CLI nao funciona
title: "Solucao de problemas"
x-i18n:
  source_path: help/troubleshooting.md
  source_hash: 00ba2a20732fa22c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:31Z
---

# Solucao de problemas

## Primeiros 60 segundos

Execute estes em ordem:

```bash
openclaw status
openclaw status --all
openclaw gateway probe
openclaw logs --follow
openclaw doctor
```

Se o Gateway estiver acessivel, probes profundos:

```bash
openclaw status --deep
```

## Casos comuns de “deu errado”

### `openclaw: command not found`

Quase sempre e um problema de PATH do Node/npm. Comece por aqui:

- [Instalacao (sanidade do PATH do Node/npm)](/install#nodejs--npm-path-sanity)

### O instalador falha (ou voce precisa dos logs completos)

Execute novamente o instalador em modo verboso para ver o rastreamento completo e a saida do npm:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --verbose
```

Para instalacoes beta:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --beta --verbose
```

Voce tambem pode definir `OPENCLAW_VERBOSE=1` em vez da flag.

### Gateway “unauthorized”, nao conecta ou fica reconectando

- [Solucao de problemas do Gateway](/gateway/troubleshooting)
- [Autenticacao do Gateway](/gateway/authentication)

### A UI de Controle falha em HTTP (identidade do dispositivo necessaria)

- [Solucao de problemas do Gateway](/gateway/troubleshooting)
- [UI de Controle](/web/control-ui#insecure-http)

### `docs.openclaw.ai` mostra um erro de SSL (Comcast/Xfinity)

Algumas conexoes Comcast/Xfinity bloqueiam `docs.openclaw.ai` via Xfinity Advanced Security.
Desative o Advanced Security ou adicione `docs.openclaw.ai` a allowlist e tente novamente.

- Ajuda do Xfinity Advanced Security: https://www.xfinity.com/support/articles/using-xfinity-xfi-advanced-security
- Verificacoes rapidas: tente um hotspot movel ou VPN para confirmar que e filtragem no nivel do ISP

### O servico diz que esta em execucao, mas a probe RPC falha

- [Solucao de problemas do Gateway](/gateway/troubleshooting)
- [Processo/servico em segundo plano](/gateway/background-process)

### Falhas de modelo/auth (limite de taxa, cobranca, “all models failed”)

- [Modelos](/cli/models)
- [Conceitos de OAuth / auth](/concepts/oauth)

### `/model` diz `model not allowed`

Isso geralmente significa que `agents.defaults.models` esta configurado como uma allowlist. Quando nao esta vazio,
apenas essas chaves de provedor/modelo podem ser selecionadas.

- Verifique a allowlist: `openclaw config get agents.defaults.models`
- Adicione o modelo que voce quer (ou limpe a allowlist) e tente novamente `/model`
- Use `/models` para navegar pelos provedores/modelos permitidos

### Ao abrir um issue

Cole um relatorio seguro:

```bash
openclaw status --all
```

Se puder, inclua o trecho relevante do log de `openclaw logs --follow`.
