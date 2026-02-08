---
summary: "Hub de rede: superfícies do gateway, pareamento, descoberta e segurança"
read_when:
  - Você precisa da visão geral da arquitetura de rede + segurança
  - Você está depurando acesso local vs tailnet ou pareamento
  - Você quer a lista canônica de documentos de rede
title: "Rede"
x-i18n:
  source_path: network.md
  source_hash: 0fe4e7dbc8ddea31
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:39Z
---

# Hub de rede

Este hub conecta os documentos centrais sobre como o OpenClaw se conecta, realiza o pareamento e protege
dispositivos em localhost, LAN e tailnet.

## Modelo central

- [Arquitetura do Gateway](/concepts/architecture)
- [Protocolo do Gateway](/gateway/protocol)
- [Runbook do Gateway](/gateway)
- [Superfícies web + modos de bind](/web)

## Pareamento + identidade

- [Visão geral de pareamento (Mensagem direta + nós)](/start/pairing)
- [Pareamento de nós de propriedade do Gateway](/gateway/pairing)
- [CLI de dispositivos (pareamento + rotação de tokens)](/cli/devices)
- [CLI de pareamento (aprovações por Mensagem direta)](/cli/pairing)

Confiança local:

- Conexões locais (loopback ou o próprio endereço tailnet do host do gateway) podem ser
  aprovadas automaticamente para pareamento, mantendo uma UX fluida no mesmo host.
- Clientes não locais em tailnet/LAN ainda exigem aprovação explícita de pareamento.

## Descoberta + transportes

- [Descoberta e transportes](/gateway/discovery)
- [Bonjour / mDNS](/gateway/bonjour)
- [Acesso remoto (SSH)](/gateway/remote)
- [Tailscale](/gateway/tailscale)

## Nós + transportes

- [Visão geral de nós](/nodes)
- [Protocolo de bridge (nós legados)](/gateway/bridge-protocol)
- [Runbook de nó: iOS](/platforms/ios)
- [Runbook de nó: Android](/platforms/android)

## Segurança

- [Visão geral de segurança](/gateway/security)
- [Referência de configuracao do Gateway](/gateway/configuration)
- [Solucao de problemas](/gateway/troubleshooting)
- [Doctor](/gateway/doctor)
