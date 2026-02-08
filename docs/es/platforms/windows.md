---
summary: "Soporte de Windows (WSL2) + estado de la aplicacion complementaria"
read_when:
  - Instalando OpenClaw en Windows
  - Buscando el estado de la aplicacion complementaria para Windows
title: "Windows (WSL2)"
x-i18n:
  source_path: platforms/windows.md
  source_hash: c93d2263b4e5b60c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:35Z
---

# Windows (WSL2)

Se recomienda usar OpenClaw en Windows **a traves de WSL2** (se recomienda Ubuntu). La
CLI + Gateway se ejecutan dentro de Linux, lo que mantiene el entorno de ejecucion consistente y hace
que las herramientas sean mucho mas compatibles (Node/Bun/pnpm, binarios de Linux, Skills). Windows nativo
podria ser mas complicado. WSL2 le brinda la experiencia completa de Linux — un solo comando
para instalar: `wsl --install`.

Las aplicaciones complementarias nativas para Windows estan planificadas.

## Instalacion (WSL2)

- [Primeros Pasos](/start/getting-started) (use dentro de WSL)
- [Instalacion y actualizaciones](/install/updating)
- Guia oficial de WSL2 (Microsoft): https://learn.microsoft.com/windows/wsl/install

## Gateway

- [Runbook de Gateway](/gateway)
- [Configuracion](/gateway/configuration)

## Instalacion del servicio Gateway (CLI)

Dentro de WSL2:

```
openclaw onboard --install-daemon
```

O:

```
openclaw gateway install
```

O:

```
openclaw configure
```

Seleccione **Gateway service** cuando se le solicite.

Reparar/migrar:

```
openclaw doctor
```

## Avanzado: exponer servicios de WSL en la LAN (portproxy)

WSL tiene su propia red virtual. Si otra maquina necesita acceder a un servicio
que se ejecuta **dentro de WSL** (SSH, un servidor TTS local o el Gateway), debe
redirigir un puerto de Windows a la IP actual de WSL. La IP de WSL cambia despues de reinicios,
por lo que es posible que deba actualizar la regla de redireccionamiento.

Ejemplo (PowerShell **como Administrador**):

```powershell
$Distro = "Ubuntu-24.04"
$ListenPort = 2222
$TargetPort = 22

$WslIp = (wsl -d $Distro -- hostname -I).Trim().Split(" ")[0]
if (-not $WslIp) { throw "WSL IP not found." }

netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=$ListenPort `
  connectaddress=$WslIp connectport=$TargetPort
```

Permita el puerto a traves del Firewall de Windows (una sola vez):

```powershell
New-NetFirewallRule -DisplayName "WSL SSH $ListenPort" -Direction Inbound `
  -Protocol TCP -LocalPort $ListenPort -Action Allow
```

Actualice el portproxy despues de reinicios de WSL:

```powershell
netsh interface portproxy delete v4tov4 listenport=$ListenPort listenaddress=0.0.0.0 | Out-Null
netsh interface portproxy add v4tov4 listenport=$ListenPort listenaddress=0.0.0.0 `
  connectaddress=$WslIp connectport=$TargetPort | Out-Null
```

Notas:

- SSH desde otra maquina apunta a la **IP del host de Windows** (ejemplo: `ssh user@windows-host -p 2222`).
- Los nodos remotos deben apuntar a una URL de Gateway **accesible** (no `127.0.0.1`); use
  `openclaw status --all` para confirmar.
- Use `listenaddress=0.0.0.0` para acceso LAN; `127.0.0.1` lo mantiene solo local.
- Si desea que esto sea automatico, registre una Tarea Programada para ejecutar el paso
  de actualizacion al iniciar sesion.

## Instalacion paso a paso de WSL2

### 1) Instalar WSL2 + Ubuntu

Abra PowerShell (Admin):

```powershell
wsl --install
# Or pick a distro explicitly:
wsl --list --online
wsl --install -d Ubuntu-24.04
```

Reinicie si Windows lo solicita.

### 2) Habilitar systemd (requerido para la instalacion del Gateway)

En su terminal de WSL:

```bash
sudo tee /etc/wsl.conf >/dev/null <<'EOF'
[boot]
systemd=true
EOF
```

Luego, desde PowerShell:

```powershell
wsl --shutdown
```

Vuelva a abrir Ubuntu y luego verifique:

```bash
systemctl --user status
```

### 3) Instalar OpenClaw (dentro de WSL)

Siga el flujo de Primeros Pasos de Linux dentro de WSL:

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pnpm install
pnpm ui:build # auto-installs UI deps on first run
pnpm build
openclaw onboard
```

Guia completa: [Primeros Pasos](/start/getting-started)

## Aplicacion complementaria para Windows

Aun no tenemos una aplicacion complementaria para Windows. Las contribuciones son bienvenidas si desea
aportar para que esto suceda.
