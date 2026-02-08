---
summary: "Referência da CLI para `openclaw node` (host de nó headless)"
read_when:
  - Executando o host de nó headless
  - Pareando um nó não macOS para system.run
title: "node"
x-i18n:
  source_path: cli/node.md
  source_hash: a8b1a57712663e22
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:41Z
---

# `openclaw node`

Execute um **host de nó headless** que se conecta ao WebSocket do Gateway e expõe
`system.run` / `system.which` nesta máquina.

## Por que usar um host de nó?

Use um host de nó quando você quiser que agentes **executem comandos em outras máquinas** da sua
rede sem instalar um aplicativo complementar completo do macOS nelas.

Casos de uso comuns:

- Executar comandos em máquinas Linux/Windows remotas (servidores de build, máquinas de laboratório, NAS).
- Manter o exec **em sandbox** no gateway, mas delegar execuções aprovadas para outros hosts.
- Fornecer um destino de execução leve e headless para automação ou nós de CI.

A execução continua protegida por **aprovações de exec** e allowlists por agente no
host de nó, para que você possa manter o acesso a comandos com escopo e explícito.

## Proxy de navegador (zero-config)

Hosts de nó anunciam automaticamente um proxy de navegador se `browser.enabled` não estiver
desativado no nó. Isso permite que o agente use automação de navegador nesse nó
sem configuração extra.

Desative no nó, se necessário:

```json5
{
  nodeHost: {
    browserProxy: {
      enabled: false,
    },
  },
}
```

## Executar (foreground)

```bash
openclaw node run --host <gateway-host> --port 18789
```

Opções:

- `--host <host>`: Host do WebSocket do Gateway (padrão: `127.0.0.1`)
- `--port <port>`: Porta do WebSocket do Gateway (padrão: `18789`)
- `--tls`: Usar TLS para a conexão com o gateway
- `--tls-fingerprint <sha256>`: Impressão digital esperada do certificado TLS (sha256)
- `--node-id <id>`: Substituir o id do nó (limpa o token de pareamento)
- `--display-name <name>`: Substituir o nome de exibição do nó

## Serviço (background)

Instale um host de nó headless como um serviço de usuário.

```bash
openclaw node install --host <gateway-host> --port 18789
```

Opções:

- `--host <host>`: Host do WebSocket do Gateway (padrão: `127.0.0.1`)
- `--port <port>`: Porta do WebSocket do Gateway (padrão: `18789`)
- `--tls`: Usar TLS para a conexão com o gateway
- `--tls-fingerprint <sha256>`: Impressão digital esperada do certificado TLS (sha256)
- `--node-id <id>`: Substituir o id do nó (limpa o token de pareamento)
- `--display-name <name>`: Substituir o nome de exibição do nó
- `--runtime <runtime>`: Runtime do serviço (`node` ou `bun`)
- `--force`: Reinstalar/sobrescrever se já estiver instalado

Gerencie o serviço:

```bash
openclaw node status
openclaw node stop
openclaw node restart
openclaw node uninstall
```

Use `openclaw node run` para um host de nó em foreground (sem serviço).

Os comandos do serviço aceitam `--json` para saída legível por máquina.

## Pareamento

A primeira conexão cria uma solicitação de pareamento de nó pendente no Gateway.
Aprove-a via:

```bash
openclaw nodes pending
openclaw nodes approve <requestId>
```

O host de nó armazena seu id de nó, token, nome de exibição e informações de conexão com o gateway em
`~/.openclaw/node.json`.

## Aprovações de exec

`system.run` é controlado por aprovações locais de exec:

- `~/.openclaw/exec-approvals.json`
- [Aprovações de exec](/tools/exec-approvals)
- `openclaw approvals --node <id|name|ip>` (editar a partir do Gateway)
