---
summary: "OpenClaw en Raspberry Pi (configuracion autoalojada economica)"
read_when:
  - Configurando OpenClaw en una Raspberry Pi
  - Ejecutando OpenClaw en dispositivos ARM
  - Construyendo una IA personal economica siempre activa
title: "Raspberry Pi"
x-i18n:
  source_path: platforms/raspberry-pi.md
  source_hash: 90b143a2877a4cea
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:41Z
---

# OpenClaw en Raspberry Pi

## Objetivo

Ejecutar un Gateway de OpenClaw persistente y siempre activo en una Raspberry Pi por un costo unico de **~$35-80** (sin tarifas mensuales).

Perfecto para:

- Asistente de IA personal 24/7
- Centro de automatizacion del hogar
- Bot de Telegram/WhatsApp de bajo consumo y siempre disponible

## Requisitos de Hardware

| Modelo de Pi    | RAM     | ¿Funciona? | Notas                           |
| --------------- | ------- | ---------- | ------------------------------- |
| **Pi 5**        | 4GB/8GB | ✅ Mejor   | Mas rapido, recomendado         |
| **Pi 4**        | 4GB     | ✅ Bueno   | Punto ideal para la mayoria     |
| **Pi 4**        | 2GB     | ✅ OK      | Funciona, agregar swap          |
| **Pi 4**        | 1GB     | ⚠️ Justo   | Posible con swap, config minima |
| **Pi 3B+**      | 1GB     | ⚠️ Lento   | Funciona pero es pesado         |
| **Pi Zero 2 W** | 512MB   | ❌         | No recomendado                  |

**Especificaciones minimas:** 1GB RAM, 1 nucleo, 500MB de disco  
**Recomendado:** 2GB+ RAM, SO de 64 bits, tarjeta SD de 16GB+ (o SSD USB)

## Lo que Necesitara

- Raspberry Pi 4 o 5 (2GB+ recomendado)
- Tarjeta MicroSD (16GB+) o SSD USB (mejor rendimiento)
- Fuente de poder (PSU oficial de Pi recomendada)
- Conexion de red (Ethernet o WiFi)
- ~30 minutos

## 1) Grabar el SO

Use **Raspberry Pi OS Lite (64-bit)** — no se necesita escritorio para un servidor headless.

1. Descargue [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Elija SO: **Raspberry Pi OS Lite (64-bit)**
3. Haga clic en el icono de engranaje (⚙️) para preconfigurar:
   - Establecer hostname: `gateway-host`
   - Habilitar SSH
   - Establecer usuario/contraseña
   - Configurar WiFi (si no usa Ethernet)
4. Grabe en su tarjeta SD / unidad USB
5. Inserte y arranque la Pi

## 2) Conectarse via SSH

```bash
ssh user@gateway-host
# or use the IP address
ssh user@192.168.x.x
```

## 3) Configuracion del Sistema

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y git curl build-essential

# Set timezone (important for cron/reminders)
sudo timedatectl set-timezone America/Chicago  # Change to your timezone
```

## 4) Instalar Node.js 22 (ARM64)

```bash
# Install Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # Should show v22.x.x
npm --version
```

## 5) Agregar Swap (Importante para 2GB o menos)

El swap previene bloqueos por falta de memoria:

```bash
# Create 2GB swap file
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Optimize for low RAM (reduce swappiness)
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## 6) Instalar OpenClaw

### Opcion A: Instalacion Estandar (Recomendada)

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

### Opcion B: Instalacion Hackeable (Para experimentar)

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
npm install
npm run build
npm link
```

La instalacion hackeable le da acceso directo a logs y codigo — util para depurar problemas especificos de ARM.

## 7) Ejecutar Incorporacion

```bash
openclaw onboard --install-daemon
```

Siga el asistente:

1. **Modo Gateway:** Local
2. **Autenticacion:** Claves API recomendadas (OAuth puede ser inestable en Pi headless)
3. **Canales:** Telegram es el mas facil para comenzar
4. **Daemon:** Si (systemd)

## 8) Verificar Instalacion

```bash
# Check status
openclaw status

# Check service
sudo systemctl status openclaw

# View logs
journalctl -u openclaw -f
```

## 9) Acceder al Panel

Como la Pi es headless, use un tunel SSH:

```bash
# From your laptop/desktop
ssh -L 18789:localhost:18789 user@gateway-host

# Then open in browser
open http://localhost:18789
```

O use Tailscale para acceso siempre activo:

```bash
# On the Pi
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Update config
openclaw config set gateway.bind tailnet
sudo systemctl restart openclaw
```

---

## Optimizaciones de Rendimiento

### Use un SSD USB (Mejora Enorme)

Las tarjetas SD son lentas y se desgastan. Un SSD USB mejora drasticamente el rendimiento:

```bash
# Check if booting from USB
lsblk
```

Vea la [guia de arranque USB de Pi](https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#usb-mass-storage-boot) para la configuracion.

### Reducir Uso de Memoria

```bash
# Disable GPU memory allocation (headless)
echo 'gpu_mem=16' | sudo tee -a /boot/config.txt

# Disable Bluetooth if not needed
sudo systemctl disable bluetooth
```

### Monitorear Recursos

```bash
# Check memory
free -h

# Check CPU temperature
vcgencmd measure_temp

# Live monitoring
htop
```

---

## Notas Especificas de ARM

### Compatibilidad de Binarios

La mayoria de las funciones de OpenClaw funcionan en ARM64, pero algunos binarios externos pueden necesitar versiones ARM:

| Herramienta        | Estado ARM64 | Notas                               |
| ------------------ | ------------ | ----------------------------------- |
| Node.js            | ✅           | Funciona muy bien                   |
| WhatsApp (Baileys) | ✅           | JS puro, sin problemas              |
| Telegram           | ✅           | JS puro, sin problemas              |
| gog (Gmail CLI)    | ⚠️           | Verifique si hay version ARM        |
| Chromium (browser) | ✅           | `sudo apt install chromium-browser` |

Si una skill falla, verifique si su binario tiene una version ARM. Muchas herramientas en Go/Rust la tienen; algunas no.

### 32-bit vs 64-bit

**Siempre use un SO de 64 bits.** Node.js y muchas herramientas modernas lo requieren. Verifique con:

```bash
uname -m
# Should show: aarch64 (64-bit) not armv7l (32-bit)
```

---

## Configuracion de Modelo Recomendada

Como la Pi es solo el Gateway (los modelos se ejecutan en la nube), use modelos basados en API:

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-sonnet-4-20250514",
        "fallbacks": ["openai/gpt-4o-mini"]
      }
    }
  }
}
```

**No intente ejecutar LLMs locales en una Pi** — incluso modelos pequeños son demasiado lentos. Deje que Claude/GPT hagan el trabajo pesado.

---

## Inicio Automatico al Arrancar

El asistente de incorporacion configura esto, pero para verificar:

```bash
# Check service is enabled
sudo systemctl is-enabled openclaw

# Enable if not
sudo systemctl enable openclaw

# Start on boot
sudo systemctl start openclaw
```

---

## Solucion de Problemas

### Sin Memoria (OOM)

```bash
# Check memory
free -h

# Add more swap (see Step 5)
# Or reduce services running on the Pi
```

### Rendimiento Lento

- Use SSD USB en lugar de tarjeta SD
- Deshabilite servicios no usados: `sudo systemctl disable cups bluetooth avahi-daemon`
- Verifique la limitacion termica de CPU: `vcgencmd get_throttled` (debe devolver `0x0`)

### El Servicio No Inicia

```bash
# Check logs
journalctl -u openclaw --no-pager -n 100

# Common fix: rebuild
cd ~/openclaw  # if using hackable install
npm run build
sudo systemctl restart openclaw
```

### Problemas con Binarios ARM

Si una skill falla con "exec format error":

1. Verifique si el binario tiene una version ARM64
2. Intente compilar desde el codigo fuente
3. O use un contenedor Docker con soporte ARM

### Caidas de WiFi

Para Pis headless en WiFi:

```bash
# Disable WiFi power management
sudo iwconfig wlan0 power off

# Make permanent
echo 'wireless-power off' | sudo tee -a /etc/network/interfaces
```

---

## Comparacion de Costos

| Configuracion  | Costo Unico | Costo Mensual | Notas                  |
| -------------- | ----------- | ------------- | ---------------------- |
| **Pi 4 (2GB)** | ~$45        | $0            | + energia (~$5/año)    |
| **Pi 4 (4GB)** | ~$55        | $0            | Recomendado            |
| **Pi 5 (4GB)** | ~$60        | $0            | Mejor rendimiento      |
| **Pi 5 (8GB)** | ~$80        | $0            | Excesivo pero a futuro |
| DigitalOcean   | $0          | $6/mes        | $72/año                |
| Hetzner        | $0          | €3.79/mes     | ~$50/año               |

**Punto de equilibrio:** Una Pi se paga sola en ~6-12 meses frente a un VPS en la nube.

---

## Ver Tambien

- [Guia de Linux](/platforms/linux) — configuracion general de Linux
- [Guia de DigitalOcean](/platforms/digitalocean) — alternativa en la nube
- [Guia de Hetzner](/install/hetzner) — configuracion con Docker
- [Tailscale](/gateway/tailscale) — acceso remoto
- [Nodes](/nodes) — empareje su laptop/telefono con el Gateway de la Pi
