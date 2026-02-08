---
summary: "OpenClaw no Raspberry Pi (configuração auto-hospedada econômica)"
read_when:
  - Configurando o OpenClaw em um Raspberry Pi
  - Executando o OpenClaw em dispositivos ARM
  - Construindo uma IA pessoal barata e sempre ligada
title: "Raspberry Pi"
x-i18n:
  source_path: platforms/raspberry-pi.md
  source_hash: 90b143a2877a4cea
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:11Z
---

# OpenClaw no Raspberry Pi

## Objetivo

Executar um Gateway OpenClaw persistente, sempre ligado, em um Raspberry Pi por um custo único de **~US$35–80** (sem taxas mensais).

Perfeito para:

- Assistente de IA pessoal 24/7
- Hub de automação residencial
- Bot de Telegram/WhatsApp de baixo consumo, sempre disponível

## Requisitos de Hardware

| Modelo do Pi    | RAM     | Funciona?   | Observacoes                            |
| --------------- | ------- | ----------- | -------------------------------------- |
| **Pi 5**        | 4GB/8GB | ✅ Melhor   | Mais rapido, recomendado               |
| **Pi 4**        | 4GB     | ✅ Bom      | Ponto ideal para a maioria             |
| **Pi 4**        | 2GB     | ✅ OK       | Funciona, adicione swap                |
| **Pi 4**        | 1GB     | ⚠️ Apertado | Possivel com swap, configuracao minima |
| **Pi 3B+**      | 1GB     | ⚠️ Lento    | Funciona, mas arrastado                |
| **Pi Zero 2 W** | 512MB   | ❌          | Nao recomendado                        |

**Especificacoes minimas:** 1GB de RAM, 1 nucleo, 500MB de disco  
**Recomendado:** 2GB+ de RAM, SO 64-bit, cartao SD de 16GB+ (ou SSD USB)

## O Que Voce Vai Precisar

- Raspberry Pi 4 ou 5 (2GB+ recomendado)
- Cartao MicroSD (16GB+) ou SSD USB (melhor desempenho)
- Fonte de alimentacao (PSU oficial do Pi recomendado)
- Conexao de rede (Ethernet ou WiFi)
- ~30 minutos

## 1) Gravar o SO

Use **Raspberry Pi OS Lite (64-bit)** — nao e necessario desktop para um servidor headless.

1. Baixe o [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Escolha o SO: **Raspberry Pi OS Lite (64-bit)**
3. Clique no icone de engrenagem (⚙️) para preconfigurar:
   - Defina o hostname: `gateway-host`
   - Ative o SSH
   - Defina usuario/senha
   - Configure o WiFi (se nao usar Ethernet)
4. Grave no seu cartao SD / drive USB
5. Insira e inicialize o Pi

## 2) Conectar via SSH

```bash
ssh user@gateway-host
# or use the IP address
ssh user@192.168.x.x
```

## 3) Configuracao do Sistema

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

## 5) Adicionar Swap (Importante para 2GB ou menos)

O swap evita travamentos por falta de memoria:

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

## 6) Instalar o OpenClaw

### Opcao A: Instalacao Padrao (Recomendada)

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

### Opcao B: Instalacao Hackeavel (Para experimentar)

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
npm install
npm run build
npm link
```

A instalacao hackeavel oferece acesso direto a logs e codigo — util para depurar problemas especificos de ARM.

## 7) Executar a Integracao Inicial

```bash
openclaw onboard --install-daemon
```

Siga o assistente:

1. **Modo do Gateway:** Local
2. **Autenticacao:** Chaves de API recomendadas (OAuth pode ser instavel em Pi headless)
3. **Canais:** Telegram e o mais facil para comecar
4. **Daemon:** Sim (systemd)

## 8) Verificar a Instalacao

```bash
# Check status
openclaw status

# Check service
sudo systemctl status openclaw

# View logs
journalctl -u openclaw -f
```

## 9) Acessar o Dashboard

Como o Pi e headless, use um tunel SSH:

```bash
# From your laptop/desktop
ssh -L 18789:localhost:18789 user@gateway-host

# Then open in browser
open http://localhost:18789
```

Ou use o Tailscale para acesso sempre ligado:

```bash
# On the Pi
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Update config
openclaw config set gateway.bind tailnet
sudo systemctl restart openclaw
```

---

## Otimizacoes de Desempenho

### Use um SSD USB (Grande Melhoria)

Cartoes SD sao lentos e se desgastam. Um SSD USB melhora drasticamente o desempenho:

```bash
# Check if booting from USB
lsblk
```

Veja o [guia de boot USB do Pi](https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#usb-mass-storage-boot) para configuracao.

### Reduzir Uso de Memoria

```bash
# Disable GPU memory allocation (headless)
echo 'gpu_mem=16' | sudo tee -a /boot/config.txt

# Disable Bluetooth if not needed
sudo systemctl disable bluetooth
```

### Monitorar Recursos

```bash
# Check memory
free -h

# Check CPU temperature
vcgencmd measure_temp

# Live monitoring
htop
```

---

## Observacoes Especificas de ARM

### Compatibilidade de Binarios

A maioria dos recursos do OpenClaw funciona em ARM64, mas alguns binarios externos podem precisar de builds ARM:

| Ferramenta         | Status ARM64 | Observacoes                         |
| ------------------ | ------------ | ----------------------------------- |
| Node.js            | ✅           | Funciona muito bem                  |
| WhatsApp (Baileys) | ✅           | JS puro, sem problemas              |
| Telegram           | ✅           | JS puro, sem problemas              |
| gog (Gmail CLI)    | ⚠️           | Verifique se ha release ARM         |
| Chromium (browser) | ✅           | `sudo apt install chromium-browser` |

Se uma skill falhar, verifique se o binario tem build ARM. Muitas ferramentas em Go/Rust tem; algumas nao.

### 32-bit vs 64-bit

**Sempre use SO 64-bit.** Node.js e muitas ferramentas modernas exigem isso. Verifique com:

```bash
uname -m
# Should show: aarch64 (64-bit) not armv7l (32-bit)
```

---

## Configuracao de Modelo Recomendada

Como o Pi e apenas o Gateway (os modelos rodam na nuvem), use modelos baseados em API:

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

**Nao tente rodar LLMs locais em um Pi** — mesmo modelos pequenos sao lentos demais. Deixe Claude/GPT fazerem o trabalho pesado.

---

## Inicializacao Automatica no Boot

O assistente de integracao inicial configura isso, mas para verificar:

```bash
# Check service is enabled
sudo systemctl is-enabled openclaw

# Enable if not
sudo systemctl enable openclaw

# Start on boot
sudo systemctl start openclaw
```

---

## Solucao de Problemas

### Falta de Memoria (OOM)

```bash
# Check memory
free -h

# Add more swap (see Step 5)
# Or reduce services running on the Pi
```

### Desempenho Lento

- Use SSD USB em vez de cartao SD
- Desative servicos nao utilizados: `sudo systemctl disable cups bluetooth avahi-daemon`
- Verifique limitacao de CPU: `vcgencmd get_throttled` (deve retornar `0x0`)

### Servico Nao Inicia

```bash
# Check logs
journalctl -u openclaw --no-pager -n 100

# Common fix: rebuild
cd ~/openclaw  # if using hackable install
npm run build
sudo systemctl restart openclaw
```

### Problemas com Binarios ARM

Se uma skill falhar com "exec format error":

1. Verifique se o binario tem build ARM64
2. Tente compilar a partir do codigo-fonte
3. Ou use um container Docker com suporte a ARM

### Quedas de WiFi

Para Pis headless usando WiFi:

```bash
# Disable WiFi power management
sudo iwconfig wlan0 power off

# Make permanent
echo 'wireless-power off' | sudo tee -a /etc/network/interfaces
```

---

## Comparacao de Custos

| Configuracao   | Custo Unico | Custo Mensal | Observacoes                    |
| -------------- | ----------- | ------------ | ------------------------------ |
| **Pi 4 (2GB)** | ~$45        | $0           | + energia (~$5/ano)            |
| **Pi 4 (4GB)** | ~$55        | $0           | Recomendado                    |
| **Pi 5 (4GB)** | ~$60        | $0           | Melhor desempenho              |
| **Pi 5 (8GB)** | ~$80        | $0           | Exagero, mas a prova do futuro |
| DigitalOcean   | $0          | $6/mes       | $72/ano                        |
| Hetzner        | $0          | €3,79/mes    | ~$50/ano                       |

**Ponto de equilibrio:** Um Pi se paga em ~6–12 meses em comparacao com VPS na nuvem.

---

## Veja Tambem

- [Guia Linux](/platforms/linux) — configuracao geral no Linux
- [Guia DigitalOcean](/platforms/digitalocean) — alternativa na nuvem
- [Guia Hetzner](/install/hetzner) — configuracao com Docker
- [Tailscale](/gateway/tailscale) — acesso remoto
- [Nodes](/nodes) — conecte seu laptop/telefone ao gateway do Pi
