---
summary: "OpenClaw no Oracle Cloud (ARM Always Free)"
read_when:
  - Configurando o OpenClaw no Oracle Cloud
  - Procurando hospedagem VPS de baixo custo para o OpenClaw
  - Quer o OpenClaw 24/7 em um servidor pequeno
title: "Oracle Cloud"
x-i18n:
  source_path: platforms/oracle.md
  source_hash: 8ec927ab5055c915
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:11Z
---

# OpenClaw no Oracle Cloud (OCI)

## Objetivo

Executar um Gateway OpenClaw persistente no nível ARM **Always Free** do Oracle Cloud.

O nível gratuito da Oracle pode ser uma ótima opção para o OpenClaw (especialmente se voce já tiver uma conta OCI), mas vem com alguns compromissos:

- Arquitetura ARM (a maioria das coisas funciona, mas alguns binários podem ser apenas x86)
- Capacidade e cadastro podem ser instáveis

## Comparacao de Custos (2026)

| Provedor     | Plano           | Especificacoes       | Preco/mes | Observacoes                  |
| ------------ | --------------- | -------------------- | --------- | ---------------------------- |
| Oracle Cloud | Always Free ARM | ate 4 OCPU, 24GB RAM | $0        | ARM, capacidade limitada     |
| Hetzner      | CX22            | 2 vCPU, 4GB RAM      | ~ $4      | Opcao paga mais barata       |
| DigitalOcean | Basic           | 1 vCPU, 1GB RAM      | $6        | UI simples, boa documentacao |
| Vultr        | Cloud Compute   | 1 vCPU, 1GB RAM      | $6        | Muitas localizacoes          |
| Linode       | Nanode          | 1 vCPU, 1GB RAM      | $5        | Agora parte da Akamai        |

---

## Pre-requisitos

- Conta no Oracle Cloud ([cadastro](https://www.oracle.com/cloud/free/)) — veja o [guia de cadastro da comunidade](https://gist.github.com/rssnyder/51e3cfedd730e7dd5f4a816143b25dbd) se tiver problemas
- Conta no Tailscale (gratuita em [tailscale.com](https://tailscale.com))
- ~30 minutos

## 1) Criar uma Instancia OCI

1. Faça login no [Oracle Cloud Console](https://cloud.oracle.com/)
2. Navegue ate **Compute → Instances → Create Instance**
3. Configure:
   - **Name:** `openclaw`
   - **Image:** Ubuntu 24.04 (aarch64)
   - **Shape:** `VM.Standard.A1.Flex` (Ampere ARM)
   - **OCPUs:** 2 (ou ate 4)
   - **Memory:** 12 GB (ou ate 24 GB)
   - **Boot volume:** 50 GB (ate 200 GB gratis)
   - **SSH key:** Adicione sua chave publica
4. Clique em **Create**
5. Anote o endereco IP publico

**Dica:** Se a criacao da instancia falhar com "Out of capacity", tente um dominio de disponibilidade diferente ou tente novamente mais tarde. A capacidade do nivel gratuito e limitada.

## 2) Conectar e Atualizar

```bash
# Connect via public IP
ssh ubuntu@YOUR_PUBLIC_IP

# Update system
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential
```

**Nota:** `build-essential` e necessario para compilacao ARM de algumas dependencias.

## 3) Configurar Usuario e Hostname

```bash
# Set hostname
sudo hostnamectl set-hostname openclaw

# Set password for ubuntu user
sudo passwd ubuntu

# Enable lingering (keeps user services running after logout)
sudo loginctl enable-linger ubuntu
```

## 4) Instalar o Tailscale

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh --hostname=openclaw
```

Isso habilita o SSH do Tailscale, para que voce possa se conectar via `ssh openclaw` a partir de qualquer dispositivo no seu tailnet — sem precisar de IP publico.

Verifique:

```bash
tailscale status
```

**A partir de agora, conecte-se via Tailscale:** `ssh ubuntu@openclaw` (ou use o IP do Tailscale).

## 5) Instalar o OpenClaw

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
source ~/.bashrc
```

Quando for perguntado "How do you want to hatch your bot?", selecione **"Do this later"**.

> Nota: Se voce encontrar problemas de build nativo ARM, comece com pacotes do sistema (por exemplo, `sudo apt install -y build-essential`) antes de recorrer ao Homebrew.

## 6) Configurar o Gateway (loopback + autenticacao por token) e habilitar o Tailscale Serve

Use autenticacao por token como padrao. E previsivel e evita a necessidade de quaisquer flags de Control UI de “autenticacao insegura”.

```bash
# Keep the Gateway private on the VM
openclaw config set gateway.bind loopback

# Require auth for the Gateway + Control UI
openclaw config set gateway.auth.mode token
openclaw doctor --generate-gateway-token

# Expose over Tailscale Serve (HTTPS + tailnet access)
openclaw config set gateway.tailscale.mode serve
openclaw config set gateway.trustedProxies '["127.0.0.1"]'

systemctl --user restart openclaw-gateway
```

## 7) Verificar

```bash
# Check version
openclaw --version

# Check daemon status
systemctl --user status openclaw-gateway

# Check Tailscale Serve
tailscale serve status

# Test local response
curl http://localhost:18789
```

## 8) Restringir a Seguranca da VCN

Agora que tudo esta funcionando, restrinja a VCN para bloquear todo o trafego exceto o do Tailscale. A Virtual Cloud Network da OCI atua como um firewall na borda da rede — o trafego e bloqueado antes de chegar a sua instancia.

1. Va para **Networking → Virtual Cloud Networks** no OCI Console
2. Clique na sua VCN → **Security Lists** → Default Security List
3. **Remova** todas as regras de entrada, exceto:
   - `0.0.0.0/0 UDP 41641` (Tailscale)
4. Mantenha as regras padrao de saida (permitir todo o trafego de saida)

Isso bloqueia SSH na porta 22, HTTP, HTTPS e todo o resto na borda da rede. A partir de agora, voce so podera se conectar via Tailscale.

---

## Acessar a Control UI

De qualquer dispositivo na sua rede Tailscale:

```
https://openclaw.<tailnet-name>.ts.net/
```

Substitua `<tailnet-name>` pelo nome do seu tailnet (visivel em `tailscale status`).

Nenhum tunel SSH e necessario. O Tailscale fornece:

- Criptografia HTTPS (certificados automaticos)
- Autenticacao via identidade do Tailscale
- Acesso a partir de qualquer dispositivo no seu tailnet (laptop, telefone, etc.)

---

## Seguranca: VCN + Tailscale (linha de base recomendada)

Com a VCN restrita (apenas UDP 41641 aberto) e o Gateway vinculado ao loopback, voce obtem uma forte defesa em profundidade: o trafego publico e bloqueado na borda da rede, e o acesso administrativo acontece pelo seu tailnet.

Essa configuracao geralmente elimina a _necessidade_ de regras extras de firewall no host apenas para impedir forca bruta de SSH em toda a Internet — mas voce ainda deve manter o SO atualizado, executar `openclaw security audit` e verificar se nao esta ouvindo acidentalmente em interfaces publicas.

### O Que Ja Esta Protegido

| Etapa Tradicional             | Necessaria?    | Por que                                                                               |
| ----------------------------- | -------------- | ------------------------------------------------------------------------------------- |
| Firewall UFW                  | Nao            | A VCN bloqueia antes que o trafego chegue a instancia                                 |
| fail2ban                      | Nao            | Nao ha forca bruta se a porta 22 estiver bloqueada na VCN                             |
| Endurecimento do sshd         | Nao            | O SSH do Tailscale nao usa o sshd                                                     |
| Desabilitar login root        | Nao            | O Tailscale usa identidade do Tailscale, nao usuarios do sistema                      |
| Autenticacao so por chave SSH | Nao            | O Tailscale autentica via seu tailnet                                                 |
| Endurecimento de IPv6         | Geralmente nao | Depende das configuracoes da sua VCN/sub-rede; verifique o que esta atribuido/exposto |

### Ainda Recomendado

- **Permissoes de credenciais:** `chmod 700 ~/.openclaw`
- **Auditoria de seguranca:** `openclaw security audit`
- **Atualizacoes do sistema:** executar `sudo apt update && sudo apt upgrade` regularmente
- **Monitorar o Tailscale:** Revisar dispositivos no [console de administracao do Tailscale](https://login.tailscale.com/admin)

### Verificar Postura de Seguranca

```bash
# Confirm no public ports listening
sudo ss -tlnp | grep -v '127.0.0.1\|::1'

# Verify Tailscale SSH is active
tailscale status | grep -q 'offers: ssh' && echo "Tailscale SSH active"

# Optional: disable sshd entirely
sudo systemctl disable --now ssh
```

---

## Alternativa: Tunel SSH

Se o Tailscale Serve nao estiver funcionando, use um tunel SSH:

```bash
# From your local machine (via Tailscale)
ssh -L 18789:127.0.0.1:18789 ubuntu@openclaw
```

Em seguida, abra `http://localhost:18789`.

---

## Solucao de Problemas

### Falha na criacao da instancia ("Out of capacity")

Instancias ARM do nivel gratuito sao populares. Tente:

- Um dominio de disponibilidade diferente
- Tentar novamente fora do horario de pico (madrugada)
- Usar o filtro "Always Free" ao selecionar o shape

### O Tailscale nao conecta

```bash
# Check status
sudo tailscale status

# Re-authenticate
sudo tailscale up --ssh --hostname=openclaw --reset
```

### O Gateway nao inicia

```bash
openclaw gateway status
openclaw doctor --non-interactive
journalctl --user -u openclaw-gateway -n 50
```

### Nao consigo acessar a Control UI

```bash
# Verify Tailscale Serve is running
tailscale serve status

# Check gateway is listening
curl http://localhost:18789

# Restart if needed
systemctl --user restart openclaw-gateway
```

### Problemas com binarios ARM

Algumas ferramentas podem nao ter builds ARM. Verifique:

```bash
uname -m  # Should show aarch64
```

A maioria dos pacotes npm funciona bem. Para binarios, procure por releases `linux-arm64` ou `aarch64`.

---

## Persistencia

Todo o estado fica em:

- `~/.openclaw/` — configuracao, credenciais, dados de sessao
- `~/.openclaw/workspace/` — workspace (SOUL.md, memoria, artefatos)

Faca backup periodicamente:

```bash
tar -czvf openclaw-backup.tar.gz ~/.openclaw ~/.openclaw/workspace
```

---

## Veja Tambem

- [Acesso remoto do Gateway](/gateway/remote) — outros padroes de acesso remoto
- [Integracao com Tailscale](/gateway/tailscale) — documentacao completa do Tailscale
- [Configuracao do Gateway](/gateway/configuration) — todas as opcoes de configuracao
- [Guia do DigitalOcean](/platforms/digitalocean) — se voce quiser pago + cadastro mais facil
- [Guia do Hetzner](/install/hetzner) — alternativa baseada em Docker
