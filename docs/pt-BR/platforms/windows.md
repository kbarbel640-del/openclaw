---
summary: "Suporte ao Windows (WSL2) + status do aplicativo complementar"
read_when:
  - Instalando o OpenClaw no Windows
  - Procurando o status do aplicativo complementar para Windows
title: "Windows (WSL2)"
x-i18n:
  source_path: platforms/windows.md
  source_hash: c93d2263b4e5b60c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:00Z
---

# Windows (WSL2)

O OpenClaw no Windows é recomendado **via WSL2** (Ubuntu recomendado). A
CLI + Gateway rodam dentro do Linux, o que mantém o ambiente de execucao consistente e torna
as ferramentas muito mais compativeis (Node/Bun/pnpm, binarios Linux, Skills). O Windows nativo
pode ser mais complicado. O WSL2 oferece a experiencia Linux completa — um comando
para instalar: `wsl --install`.

Aplicativos complementares nativos para Windows estao planejados.

## Install (WSL2)

- [Primeiros Passos](/start/getting-started) (usar dentro do WSL)
- [Instalacao e atualizacoes](/install/updating)
- Guia oficial do WSL2 (Microsoft): https://learn.microsoft.com/windows/wsl/install

## Gateway

- [Runbook do Gateway](/gateway)
- [Configuracao](/gateway/configuration)

## Instalacao do servico Gateway (CLI)

Dentro do WSL2:

```
openclaw onboard --install-daemon
```

Ou:

```
openclaw gateway install
```

Ou:

```
openclaw configure
```

Selecione **Gateway service** quando solicitado.

Reparar/migrar:

```
openclaw doctor
```

## Avancado: expor servicos do WSL na LAN (portproxy)

O WSL tem sua propria rede virtual. Se outra maquina precisar acessar um servico
rodando **dentro do WSL** (SSH, um servidor TTS local ou o Gateway), voce deve
encaminhar uma porta do Windows para o IP atual do WSL. O IP do WSL muda apos reinicios,
entao pode ser necessario atualizar a regra de encaminhamento.

Exemplo (PowerShell **como Administrador**):

```powershell
$Distro = "Ubuntu-24.04"
$ListenPort = 2222
$TargetPort = 22

$WslIp = (wsl -d $Distro -- hostname -I).Trim().Split(" ")[0]
if (-not $WslIp) { throw "WSL IP not found." }

netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=$ListenPort `
  connectaddress=$WslIp connectport=$TargetPort
```

Permita a porta no Firewall do Windows (uma vez):

```powershell
New-NetFirewallRule -DisplayName "WSL SSH $ListenPort" -Direction Inbound `
  -Protocol TCP -LocalPort $ListenPort -Action Allow
```

Atualize o portproxy apos reinicios do WSL:

```powershell
netsh interface portproxy delete v4tov4 listenport=$ListenPort listenaddress=0.0.0.0 | Out-Null
netsh interface portproxy add v4tov4 listenport=$ListenPort listenaddress=0.0.0.0 `
  connectaddress=$WslIp connectport=$TargetPort | Out-Null
```

Notas:

- SSH a partir de outra maquina aponta para o **IP do host Windows** (exemplo: `ssh user@windows-host -p 2222`).
- Nos remotos devem apontar para uma URL do Gateway **acessivel** (nao `127.0.0.1`); use
  `openclaw status --all` para confirmar.
- Use `listenaddress=0.0.0.0` para acesso via LAN; `127.0.0.1` mantem apenas local.
- Se quiser automatizar, registre uma Tarefa Agendada para executar a etapa de
  atualizacao no login.

## Instalacao passo a passo do WSL2

### 1) Instalar WSL2 + Ubuntu

Abra o PowerShell (Admin):

```powershell
wsl --install
# Or pick a distro explicitly:
wsl --list --online
wsl --install -d Ubuntu-24.04
```

Reinicie se o Windows solicitar.

### 2) Habilitar systemd (necessario para a instalacao do Gateway)

No seu terminal do WSL:

```bash
sudo tee /etc/wsl.conf >/dev/null <<'EOF'
[boot]
systemd=true
EOF
```

Depois, no PowerShell:

```powershell
wsl --shutdown
```

Reabra o Ubuntu e verifique:

```bash
systemctl --user status
```

### 3) Instalar o OpenClaw (dentro do WSL)

Siga o fluxo de Primeiros Passos do Linux dentro do WSL:

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pnpm install
pnpm ui:build # auto-installs UI deps on first run
pnpm build
openclaw onboard
```

Guia completo: [Primeiros Passos](/start/getting-started)

## Aplicativo complementar para Windows

Ainda nao temos um aplicativo complementar para Windows. Contribuicoes sao bem-vindas
se voce quiser ajudar a tornar isso realidade.
