---
summary: "Solucione problemas de pareamento de nodes, requisitos de primeiro plano, permissoes e falhas de ferramentas"
read_when:
  - O Node esta conectado, mas as ferramentas de camera/canvas/tela/exec falham
  - Voce precisa do modelo mental de pareamento do node versus aprovacoes
title: "Solucao de problemas do Node"
x-i18n:
  source_path: nodes/troubleshooting.md
  source_hash: 5c40d298c9feaf8e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:19Z
---

# Solucao de problemas do Node

Use esta pagina quando um node aparece como visivel no status, mas as ferramentas do node falham.

## Escada de comandos

```bash
openclaw status
openclaw gateway status
openclaw logs --follow
openclaw doctor
openclaw channels status --probe
```

Em seguida, execute verificacoes especificas do node:

```bash
openclaw nodes status
openclaw nodes describe --node <idOrNameOrIp>
openclaw approvals get --node <idOrNameOrIp>
```

Sinais de saude:

- O node esta conectado e pareado para a funcao `node`.
- `nodes describe` inclui a capacidade que voce esta chamando.
- As aprovacoes de exec mostram o modo/lista de permissao esperados.

## Requisitos de primeiro plano

`canvas.*`, `camera.*` e `screen.*` funcionam apenas em primeiro plano em nodes iOS/Android.

Verificacao e correcao rapidas:

```bash
openclaw nodes describe --node <idOrNameOrIp>
openclaw nodes canvas snapshot --node <idOrNameOrIp>
openclaw logs --follow
```

Se voce vir `NODE_BACKGROUND_UNAVAILABLE`, traga o app do node para o primeiro plano e tente novamente.

## Matriz de permissoes

| Capacidade                   | iOS                                         | Android                                                      | app do node no macOS                     | Codigo de falha tipico         |
| ---------------------------- | ------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------- | ------------------------------ |
| `camera.snap`, `camera.clip` | Camera (+ microfone para audio do clipe)    | Camera (+ microfone para audio do clipe)                     | Camera (+ microfone para audio do clipe) | `*_PERMISSION_REQUIRED`        |
| `screen.record`              | Gravacao de Tela (+ microfone opcional)     | Prompt de captura de tela (+ microfone opcional)             | Gravacao de Tela                         | `*_PERMISSION_REQUIRED`        |
| `location.get`               | Enquanto em uso ou Sempre (depende do modo) | Localizacao em primeiro plano/segundo plano com base no modo | Permissao de localizacao                 | `LOCATION_PERMISSION_REQUIRED` |
| `system.run`                 | n/a (caminho do host do node)               | n/a (caminho do host do node)                                | Aprovacoes de exec necessarias           | `SYSTEM_RUN_DENIED`            |

## Pareamento versus aprovacoes

Estes sao portoes diferentes:

1. **Pareamento do dispositivo**: este node pode se conectar ao Gateway?
2. **Aprovacoes de exec**: este node pode executar um comando de shell especifico?

Verificacoes rapidas:

```bash
openclaw devices list
openclaw nodes status
openclaw approvals get --node <idOrNameOrIp>
openclaw approvals allowlist add --node <idOrNameOrIp> "/usr/bin/uname"
```

Se o pareamento estiver ausente, aprove primeiro o dispositivo do node.
Se o pareamento estiver ok, mas `system.run` falhar, corrija as aprovacoes/lista de permissao de exec.

## Codigos comuns de erro do node

- `NODE_BACKGROUND_UNAVAILABLE` → o app esta em segundo plano; traga-o para o primeiro plano.
- `CAMERA_DISABLED` → alternancia da camera desativada nas configuracoes do node.
- `*_PERMISSION_REQUIRED` → permissao do SO ausente/negada.
- `LOCATION_DISABLED` → modo de localizacao desligado.
- `LOCATION_PERMISSION_REQUIRED` → modo de localizacao solicitado nao concedido.
- `LOCATION_BACKGROUND_UNAVAILABLE` → o app esta em segundo plano, mas existe apenas a permissao Enquanto em uso.
- `SYSTEM_RUN_DENIED: approval required` → a solicitacao de exec precisa de aprovacao explicita.
- `SYSTEM_RUN_DENIED: allowlist miss` → comando bloqueado pelo modo de lista de permissao.

## Loop de recuperacao rapida

```bash
openclaw nodes status
openclaw nodes describe --node <idOrNameOrIp>
openclaw approvals get --node <idOrNameOrIp>
openclaw logs --follow
```

Se ainda estiver travado:

- Reaprovar o pareamento do dispositivo.
- Reabrir o app do node (primeiro plano).
- Conceder novamente as permissoes do SO.
- Recriar/ajustar a politica de aprovacao de exec.

Relacionado:

- [/nodes/index](/nodes/index)
- [/nodes/camera](/nodes/camera)
- [/nodes/location-command](/nodes/location-command)
- [/tools/exec-approvals](/tools/exec-approvals)
- [/gateway/pairing](/gateway/pairing)
