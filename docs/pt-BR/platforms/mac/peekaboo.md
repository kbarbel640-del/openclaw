---
summary: "Integracao do PeekabooBridge para automacao de UI no macOS"
read_when:
  - Hospedando o PeekabooBridge no OpenClaw.app
  - Integrando o Peekaboo via Swift Package Manager
  - Alterando o protocolo/caminhos do PeekabooBridge
title: "Peekaboo Bridge"
x-i18n:
  source_path: platforms/mac/peekaboo.md
  source_hash: b5b9ddb9a7c59e15
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:55Z
---

# Peekaboo Bridge (automacao de UI no macOS)

O OpenClaw pode hospedar o **PeekabooBridge** como um broker local de automacao de UI, com reconhecimento de permissoes. Isso permite que a CLI `peekaboo` conduza a automacao de UI reutilizando as permissoes TCC do app do macOS.

## O que isso e (e o que nao e)

- **Host**: o OpenClaw.app pode atuar como host do PeekabooBridge.
- **Cliente**: use a CLI `peekaboo` (sem uma superficie `openclaw ui ...` separada).
- **UI**: sobreposicoes visuais permanecem no Peekaboo.app; o OpenClaw e um host broker enxuto.

## Ativar a bridge

No app do macOS:

- Ajustes → **Ativar Peekaboo Bridge**

Quando ativado, o OpenClaw inicia um servidor de socket UNIX local. Se desativado, o host e interrompido e `peekaboo` voltara a hosts disponiveis.

## Ordem de descoberta do cliente

Clientes do Peekaboo normalmente tentam hosts nesta ordem:

1. Peekaboo.app (UX completa)
2. Claude.app (se instalado)
3. OpenClaw.app (broker enxuto)

Use `peekaboo bridge status --verbose` para ver qual host esta ativo e qual caminho de socket esta em uso. Voce pode sobrescrever com:

```bash
export PEEKABOO_BRIDGE_SOCKET=/path/to/bridge.sock
```

## Seguranca e permissoes

- A bridge valida **assinaturas de codigo do chamador**; uma allowlist de TeamIDs e aplicada (TeamID do host Peekaboo + TeamID do app OpenClaw).
- As requisicoes expiram apos ~10 segundos.
- Se as permissoes necessarias estiverem ausentes, a bridge retorna uma mensagem de erro clara em vez de abrir os Ajustes do Sistema.

## Comportamento de snapshots (automacao)

Os snapshots sao armazenados em memoria e expiram automaticamente apos um curto periodo. Se voce precisar de retencao mais longa, recapture a partir do cliente.

## Solucao de problemas

- Se `peekaboo` relatar “bridge client is not authorized”, garanta que o cliente esteja devidamente assinado ou execute o host com `PEEKABOO_ALLOW_UNSIGNED_SOCKET_CLIENTS=1` apenas em modo **debug**.
- Se nenhum host for encontrado, abra um dos apps host (Peekaboo.app ou OpenClaw.app) e confirme que as permissoes foram concedidas.
