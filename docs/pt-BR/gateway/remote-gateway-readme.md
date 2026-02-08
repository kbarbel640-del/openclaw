---
summary: "Configuracao de tunel SSH para o OpenClaw.app conectando a um gateway remoto"
read_when: "Conectando o app macOS a um gateway remoto via SSH"
title: "Configuracao de Gateway Remoto"
x-i18n:
  source_path: gateway/remote-gateway-readme.md
  source_hash: b1ae266a7cb4911b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:21Z
---

# Executando o OpenClaw.app com um Gateway Remoto

O OpenClaw.app usa tunelamento SSH para se conectar a um gateway remoto. Este guia mostra como configurar.

## Visao geral

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Machine                          │
│                                                              │
│  OpenClaw.app ──► ws://127.0.0.1:18789 (local port)           │
│                     │                                        │
│                     ▼                                        │
│  SSH Tunnel ────────────────────────────────────────────────│
│                     │                                        │
└─────────────────────┼──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                         Remote Machine                        │
│                                                              │
│  Gateway WebSocket ──► ws://127.0.0.1:18789 ──►              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Configuracao rapida

### Passo 1: Adicionar configuracao SSH

Edite `~/.ssh/config` e adicione:

```ssh
Host remote-gateway
    HostName <REMOTE_IP>          # e.g., 172.27.187.184
    User <REMOTE_USER>            # e.g., jefferson
    LocalForward 18789 127.0.0.1:18789
    IdentityFile ~/.ssh/id_rsa
```

Substitua `<REMOTE_IP>` e `<REMOTE_USER>` pelos seus valores.

### Passo 2: Copiar chave SSH

Copie sua chave publica para a maquina remota (digite a senha uma vez):

```bash
ssh-copy-id -i ~/.ssh/id_rsa <REMOTE_USER>@<REMOTE_IP>
```

### Passo 3: Definir token do Gateway

```bash
launchctl setenv OPENCLAW_GATEWAY_TOKEN "<your-token>"
```

### Passo 4: Iniciar o tunel SSH

```bash
ssh -N remote-gateway &
```

### Passo 5: Reiniciar o OpenClaw.app

```bash
# Quit OpenClaw.app (⌘Q), then reopen:
open /path/to/OpenClaw.app
```

O app agora se conectara ao gateway remoto por meio do tunel SSH.

---

## Inicializar automaticamente o tunel ao fazer login

Para que o tunel SSH inicie automaticamente quando voce fizer login, crie um Launch Agent.

### Criar o arquivo PLIST

Salve isto como `~/Library/LaunchAgents/bot.molt.ssh-tunnel.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>bot.molt.ssh-tunnel</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/ssh</string>
        <string>-N</string>
        <string>remote-gateway</string>
    </array>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

### Carregar o Launch Agent

```bash
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/bot.molt.ssh-tunnel.plist
```

O tunel agora ira:

- Iniciar automaticamente quando voce fizer login
- Reiniciar se falhar
- Continuar em execucao em segundo plano

Nota de legado: remova qualquer LaunchAgent `com.openclaw.ssh-tunnel` remanescente, se existir.

---

## Solucao de problemas

**Verificar se o tunel esta em execucao:**

```bash
ps aux | grep "ssh -N remote-gateway" | grep -v grep
lsof -i :18789
```

**Reiniciar o tunel:**

```bash
launchctl kickstart -k gui/$UID/bot.molt.ssh-tunnel
```

**Parar o tunel:**

```bash
launchctl bootout gui/$UID/bot.molt.ssh-tunnel
```

---

## Como funciona

| Componente                           | O que faz                                                           |
| ------------------------------------ | ------------------------------------------------------------------- |
| `LocalForward 18789 127.0.0.1:18789` | Encaminha a porta local 18789 para a porta remota 18789             |
| `ssh -N`                             | SSH sem executar comandos remotos (apenas encaminhamento de portas) |
| `KeepAlive`                          | Reinicia automaticamente o tunel se ele falhar                      |
| `RunAtLoad`                          | Inicia o tunel quando o agente e carregado                          |

O OpenClaw.app se conecta a `ws://127.0.0.1:18789` na sua maquina cliente. O tunel SSH encaminha essa conexao para a porta 18789 na maquina remota onde o Gateway esta em execucao.
