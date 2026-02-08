---
summary: "Centro de red: superficies del gateway, emparejamiento, descubrimiento y seguridad"
read_when:
  - Necesita la arquitectura de red + el panorama de seguridad
  - Está depurando el acceso local vs tailnet o el emparejamiento
  - Quiere la lista canónica de documentos de redes
title: "Red"
x-i18n:
  source_path: network.md
  source_hash: 0fe4e7dbc8ddea31
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:14Z
---

# Centro de red

Este centro enlaza la documentación principal sobre cómo OpenClaw se conecta, empareja y protege
dispositivos a través de localhost, LAN y tailnet.

## Modelo central

- [Arquitectura del Gateway](/concepts/architecture)
- [Protocolo del Gateway](/gateway/protocol)
- [Runbook del Gateway](/gateway)
- [Superficies web + modos de enlace](/web)

## Emparejamiento + identidad

- [Resumen de emparejamiento (Mensaje directo + nodos)](/start/pairing)
- [Emparejamiento de nodos propiedad del Gateway](/gateway/pairing)
- [CLI de dispositivos (emparejamiento + rotación de tokens)](/cli/devices)
- [CLI de emparejamiento (aprobaciones por Mensaje directo)](/cli/pairing)

Confianza local:

- Las conexiones locales (loopback o la propia dirección tailnet del host del gateway) pueden
  aprobarse automáticamente para el emparejamiento y así mantener una UX fluida en el mismo host.
- Los clientes tailnet/LAN no locales aún requieren aprobación explícita de emparejamiento.

## Descubrimiento + transportes

- [Descubrimiento y transportes](/gateway/discovery)
- [Bonjour / mDNS](/gateway/bonjour)
- [Acceso remoto (SSH)](/gateway/remote)
- [Tailscale](/gateway/tailscale)

## Nodos + transportes

- [Resumen de nodos](/nodes)
- [Protocolo Bridge (nodos heredados)](/gateway/bridge-protocol)
- [Runbook de nodos: iOS](/platforms/ios)
- [Runbook de nodos: Android](/platforms/android)

## Seguridad

- [Resumen de seguridad](/gateway/security)
- [Referencia de configuracion del Gateway](/gateway/configuration)
- [Solucion de problemas](/gateway/troubleshooting)
- [Doctor](/gateway/doctor)
