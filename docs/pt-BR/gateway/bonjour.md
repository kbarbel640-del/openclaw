---
summary: "Descoberta Bonjour/mDNS + depuracao (beacons do Gateway, clientes e modos comuns de falha)"
read_when:
  - Depurando problemas de descoberta Bonjour no macOS/iOS
  - Alterando tipos de servico mDNS, registros TXT ou a UX de descoberta
title: "Descoberta Bonjour"
x-i18n:
  source_path: gateway/bonjour.md
  source_hash: 47569da55f0c0523
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:18Z
---

# Descoberta Bonjour / mDNS

O OpenClaw usa Bonjour (mDNS / DNS‑SD) como uma **conveniencia apenas de LAN** para descobrir
um Gateway ativo (endpoint WebSocket). E de melhor esforco e **nao** substitui SSH ou
conectividade baseada em Tailnet.

## Bonjour de area ampla (DNS‑SD unicast) sobre Tailscale

Se o node e o gateway estiverem em redes diferentes, o mDNS multicast nao atravessa o
limite. Voce pode manter a mesma UX de descoberta trocando para **DNS‑SD unicast**
("Bonjour de area ampla") sobre Tailscale.

Passos em alto nivel:

1. Execute um servidor DNS no host do gateway (acessivel via Tailnet).
2. Publique registros DNS‑SD para `_openclaw-gw._tcp` sob uma zona dedicada
   (exemplo: `openclaw.internal.`).
3. Configure **DNS dividido** do Tailscale para que seu dominio escolhido resolva via esse
   servidor DNS para clientes (incluindo iOS).

O OpenClaw oferece suporte a qualquer dominio de descoberta; `openclaw.internal.` e apenas um exemplo.
Nodes iOS/Android pesquisam tanto `local.` quanto o dominio de area ampla configurado.

### Configuracao do Gateway (recomendado)

```json5
{
  gateway: { bind: "tailnet" }, // tailnet-only (recommended)
  discovery: { wideArea: { enabled: true } }, // enables wide-area DNS-SD publishing
}
```

### Configuracao unica do servidor DNS (host do gateway)

```bash
openclaw dns setup --apply
```

Isso instala o CoreDNS e o configura para:

- escutar na porta 53 apenas nas interfaces Tailscale do gateway
- servir o dominio escolhido (exemplo: `openclaw.internal.`) a partir de `~/.openclaw/dns/<domain>.db`

Valide a partir de uma maquina conectada ao tailnet:

```bash
dns-sd -B _openclaw-gw._tcp openclaw.internal.
dig @<TAILNET_IPV4> -p 53 _openclaw-gw._tcp.openclaw.internal PTR +short
```

### Configuracoes de DNS do Tailscale

No console de administracao do Tailscale:

- Adicione um nameserver apontando para o IP do tailnet do gateway (UDP/TCP 53).
- Adicione DNS dividido para que seu dominio de descoberta use esse nameserver.

Quando os clientes aceitarem o DNS do tailnet, nodes iOS poderao pesquisar
`_openclaw-gw._tcp` no seu dominio de descoberta sem multicast.

### Seguranca do listener do Gateway (recomendado)

A porta WS do Gateway (padrao `18789`) se vincula ao loopback por padrao. Para acesso
LAN/tailnet, vincule explicitamente e mantenha a autenticacao ativada.

Para configuracoes somente de tailnet:

- Defina `gateway.bind: "tailnet"` em `~/.openclaw/openclaw.json`.
- Reinicie o Gateway (ou reinicie o app da barra de menus do macOS).

## O que anuncia

Apenas o Gateway anuncia `_openclaw-gw._tcp`.

## Tipos de servico

- `_openclaw-gw._tcp` — beacon de transporte do gateway (usado por nodes macOS/iOS/Android).

## Chaves TXT (dicas nao secretas)

O Gateway anuncia pequenas dicas nao secretas para tornar os fluxos de UI convenientes:

- `role=gateway`
- `displayName=<friendly name>`
- `lanHost=<hostname>.local`
- `gatewayPort=<port>` (Gateway WS + HTTP)
- `gatewayTls=1` (apenas quando TLS esta habilitado)
- `gatewayTlsSha256=<sha256>` (apenas quando TLS esta habilitado e a impressao digital esta disponivel)
- `canvasPort=<port>` (apenas quando o host do canvas esta habilitado; padrao `18793`)
- `sshPort=<port>` (padrao 22 quando nao substituido)
- `transport=gateway`
- `cliPath=<path>` (opcional; caminho absoluto para um entrypoint `openclaw` executavel)
- `tailnetDns=<magicdns>` (dica opcional quando o Tailnet esta disponivel)

## Depuracao no macOS

Ferramentas integradas uteis:

- Navegar por instancias:
  ```bash
  dns-sd -B _openclaw-gw._tcp local.
  ```
- Resolver uma instancia (substitua `<instance>`):
  ```bash
  dns-sd -L "<instance>" _openclaw-gw._tcp local.
  ```

Se a navegacao funciona mas a resolucao falha, voce geralmente esta enfrentando uma politica
de LAN ou um problema do resolvedor mDNS.

## Depuracao nos logs do Gateway

O Gateway grava um arquivo de log rotativo (impresso na inicializacao como
`gateway log file: ...`). Procure por linhas `bonjour:`, especialmente:

- `bonjour: advertise failed ...`
- `bonjour: ... name conflict resolved` / `hostname conflict resolved`
- `bonjour: watchdog detected non-announced service ...`

## Depuracao no node iOS

O node iOS usa `NWBrowser` para descobrir `_openclaw-gw._tcp`.

Para capturar logs:

- Ajustes → Gateway → Avancado → **Logs de depuracao de Descoberta**
- Ajustes → Gateway → Avancado → **Logs de Descoberta** → reproduzir → **Copiar**

O log inclui transicoes de estado do navegador e alteracoes do conjunto de resultados.

## Modos comuns de falha

- **Bonjour nao atravessa redes**: use Tailnet ou SSH.
- **Multicast bloqueado**: algumas redes Wi‑Fi desativam mDNS.
- **Suspensao / troca de interfaces**: o macOS pode descartar temporariamente resultados mDNS; tente novamente.
- **Navegar funciona, mas resolver falha**: mantenha nomes de maquina simples (evite emojis ou
  pontuacao), depois reinicie o Gateway. O nome da instancia de servico deriva do nome do host,
  entao nomes excessivamente complexos podem confundir alguns resolvedores.

## Nomes de instancia escapados (`\032`)

O Bonjour/DNS‑SD frequentemente escapa bytes em nomes de instancia de servico como sequencias
decimais `\DDD` (por exemplo, espacos se tornam `\032`).

- Isso e normal no nivel de protocolo.
- As UIs devem decodificar para exibicao (o iOS usa `BonjourEscapes.decode`).

## Desativacao / configuracao

- `OPENCLAW_DISABLE_BONJOUR=1` desativa a publicidade (legado: `OPENCLAW_DISABLE_BONJOUR`).
- `gateway.bind` em `~/.openclaw/openclaw.json` controla o modo de bind do Gateway.
- `OPENCLAW_SSH_PORT` substitui a porta SSH anunciada no TXT (legado: `OPENCLAW_SSH_PORT`).
- `OPENCLAW_TAILNET_DNS` publica uma dica de MagicDNS no TXT (legado: `OPENCLAW_TAILNET_DNS`).
- `OPENCLAW_CLI_PATH` substitui o caminho de CLI anunciado (legado: `OPENCLAW_CLI_PATH`).

## Documentos relacionados

- Politica de descoberta e selecao de transporte: [Discovery](/gateway/discovery)
- Pareamento de nodes + aprovacoes: [Gateway pairing](/gateway/pairing)
