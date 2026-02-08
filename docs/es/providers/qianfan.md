---
summary: "Use la API unificada de Qianfan para acceder a muchos modelos en OpenClaw"
read_when:
  - Quiere una sola clave de API para muchos LLM
  - Necesita orientacion para la configuracion de Baidu Qianfan
title: "Qianfan"
x-i18n:
  source_path: providers/qianfan.md
  source_hash: 2ca710b422f190b6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:29Z
---

# Guia del Proveedor Qianfan

Qianfan es la plataforma MaaS de Baidu; proporciona una **API unificada** que enruta solicitudes a muchos modelos detras de un solo
endpoint y una sola clave de API. Es compatible con OpenAI, por lo que la mayoria de los SDK de OpenAI funcionan al cambiar la URL base.

## Requisitos previos

1. Una cuenta de Baidu Cloud con acceso a la API de Qianfan
2. Una clave de API desde la consola de Qianfan
3. OpenClaw instalado en su sistema

## Obtencion de su clave de API

1. Visite la [Consola de Qianfan](https://console.bce.baidu.com/qianfan/ais/console/apiKey)
2. Cree una nueva aplicacion o seleccione una existente
3. Genere una clave de API (formato: `bce-v3/ALTAK-...`)
4. Copie la clave de API para usarla con OpenClaw

## Configuracion de la CLI

```bash
openclaw onboard --auth-choice qianfan-api-key
```

## Documentacion relacionada

- [Configuracion de OpenClaw](/gateway/configuration)
- [Proveedores de modelos](/concepts/model-providers)
- [Configuracion del agente](/concepts/agent)
- [Documentacion de la API de Qianfan](https://cloud.baidu.com/doc/qianfan-api/s/3m7of64lb)
