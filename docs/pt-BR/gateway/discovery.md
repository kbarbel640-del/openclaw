---
summary: "Descoberta de nós e transportes (Bonjour, Tailscale, SSH) para encontrar o gateway"
read_when:
  - Implementar ou alterar descoberta/anúncio via Bonjour
  - Ajustar modos de conexão remota (direto vs SSH)
  - Projetar descoberta de nós + pareamento para nós remotos
title: "Descoberta e Transportes"
x-i18n:
  source_path: gateway/discovery.md
  source_hash: e12172c181515bfa
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:18Z
---

# Descoberta e transportes

O OpenClaw tem dois problemas distintos que parecem semelhantes à primeira vista:

1. **Controle remoto do operador**: o app da barra de menus do macOS controlando um gateway executando em outro lugar.
2. **Pareamento de nós**: iOS/Android (e nós futuros) encontrando um gateway e pareando de forma segura.

O objetivo de design é manter toda a descoberta/anúncio de rede no **Node Gateway** (`openclaw gateway`) e manter os clientes (app para Mac, iOS) como consumidores.

## Termos

- **Gateway**: um único processo de gateway de longa duração que possui estado (sessões, pareamento, registro de nós) e executa canais. A maioria das configurações usa um por host; configurações isoladas com múltiplos gateways são possíveis.
- **Gateway WS (plano de controle)**: o endpoint WebSocket em `127.0.0.1:18789` por padrão; pode ser vinculado à LAN/tailnet via `gateway.bind`.
- **Transporte WS direto**: um endpoint Gateway WS voltado para LAN/tailnet (sem SSH).
- **Transporte SSH (fallback)**: controle remoto encaminhando `127.0.0.1:18789` via SSH.
- **Bridge TCP legado (obsoleto/removido)**: transporte antigo de nós (veja [Bridge protocol](/gateway/bridge-protocol)); não é mais anunciado para descoberta.

Detalhes de protocolo:

- [Gateway protocol](/gateway/protocol)
- [Bridge protocol (legacy)](/gateway/bridge-protocol)

## Por que mantemos tanto “direto” quanto SSH

- **WS direto** oferece a melhor UX na mesma rede e dentro de uma tailnet:
  - descoberta automática na LAN via Bonjour
  - tokens de pareamento + ACLs gerenciados pelo gateway
  - nenhum acesso a shell é necessário; a superfície do protocolo pode permanecer restrita e auditável
- **SSH** permanece como fallback universal:
  - funciona em qualquer lugar onde você tenha acesso SSH (até mesmo entre redes não relacionadas)
  - contorna problemas de multicast/mDNS
  - não requer novas portas de entrada além do SSH

## Entradas de descoberta (como os clientes aprendem onde está o gateway)

### 1) Bonjour / mDNS (somente LAN)

O Bonjour é de melhor esforço e não atravessa redes. Ele é usado apenas para conveniência em “mesma LAN”.

Direção alvo:

- O **gateway** anuncia seu endpoint WS via Bonjour.
- Os clientes navegam e mostram uma lista “escolher um gateway”, depois armazenam o endpoint escolhido.

Detalhes de solução de problemas e beacons: [Bonjour](/gateway/bonjour).

#### Detalhes do beacon de serviço

- Tipos de serviço:
  - `_openclaw-gw._tcp` (beacon de transporte do gateway)
- Chaves TXT (não secretas):
  - `role=gateway`
  - `lanHost=<hostname>.local`
  - `sshPort=22` (ou o que estiver anunciado)
  - `gatewayPort=18789` (Gateway WS + HTTP)
  - `gatewayTls=1` (somente quando TLS está habilitado)
  - `gatewayTlsSha256=<sha256>` (somente quando TLS está habilitado e a impressão digital está disponível)
  - `canvasPort=18793` (porta padrão do host do canvas; serve `/__openclaw__/canvas/`)
  - `cliPath=<path>` (opcional; caminho absoluto para um entrypoint ou binário executável `openclaw`)
  - `tailnetDns=<magicdns>` (dica opcional; detectada automaticamente quando o Tailscale está disponível)

Desativar/substituir:

- `OPENCLAW_DISABLE_BONJOUR=1` desativa o anúncio.
- `gateway.bind` em `~/.openclaw/openclaw.json` controla o modo de bind do Gateway.
- `OPENCLAW_SSH_PORT` substitui a porta SSH anunciada no TXT (padrão 22).
- `OPENCLAW_TAILNET_DNS` publica uma dica `tailnetDns` (MagicDNS).
- `OPENCLAW_CLI_PATH` substitui o caminho do CLI anunciado.

### 2) Tailnet (entre redes)

Para configurações no estilo Londres/Viena, o Bonjour não ajuda. O alvo “direto” recomendado é:

- Nome MagicDNS do Tailscale (preferido) ou um IP estável da tailnet.

Se o gateway puder detectar que está sendo executado sob o Tailscale, ele publica `tailnetDns` como uma dica opcional para os clientes (incluindo beacons de ampla área).

### 3) Alvo manual / SSH

Quando não há rota direta (ou o direto está desativado), os clientes sempre podem se conectar via SSH encaminhando a porta do gateway em loopback local.

Veja [Remote access](/gateway/remote).

## Seleção de transporte (política do cliente)

Comportamento recomendado do cliente:

1. Se um endpoint direto pareado estiver configurado e acessível, use-o.
2. Caso contrário, se o Bonjour encontrar um gateway na LAN, ofereça uma opção de um toque “Usar este gateway” e salve-o como o endpoint direto.
3. Caso contrário, se um DNS/IP de tailnet estiver configurado, tente direto.
4. Caso contrário, faça fallback para SSH.

## Pareamento + autenticação (transporte direto)

O gateway é a fonte da verdade para a admissão de nós/clientes.

- Solicitações de pareamento são criadas/aprovadas/rejeitadas no gateway (veja [Gateway pairing](/gateway/pairing)).
- O gateway aplica:
  - autenticação (token / par de chaves)
  - escopos/ACLs (o gateway não é um proxy bruto para todos os métodos)
  - limites de taxa

## Responsabilidades por componente

- **Gateway**: anuncia beacons de descoberta, possui as decisões de pareamento e hospeda o endpoint WS.
- **app macOS**: ajuda você a escolher um gateway, mostra prompts de pareamento e usa SSH apenas como fallback.
- **nós iOS/Android**: navegam pelo Bonjour como conveniência e se conectam ao Gateway WS pareado.
