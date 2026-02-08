---
summary: "Use a API unificada da Qianfan para acessar muitos modelos no OpenClaw"
read_when:
  - Voce quer uma unica chave de API para muitos LLMs
  - Voce precisa de orientacao de configuracao do Baidu Qianfan
title: "Qianfan"
x-i18n:
  source_path: providers/qianfan.md
  source_hash: 2ca710b422f190b6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:13Z
---

# Guia do Provedor Qianfan

Qianfan é a plataforma MaaS da Baidu, que fornece uma **API unificada** que encaminha solicitacoes para muitos modelos por tras de um unico endpoint e chave de API. Ela é compativel com OpenAI, portanto a maioria dos SDKs da OpenAI funciona ao trocar a URL base.

## Pre-requisitos

1. Uma conta Baidu Cloud com acesso à API Qianfan
2. Uma chave de API do console Qianfan
3. OpenClaw instalado no seu sistema

## Obtendo sua Chave de API

1. Visite o [Console Qianfan](https://console.bce.baidu.com/qianfan/ais/console/apiKey)
2. Crie um novo aplicativo ou selecione um existente
3. Gere uma chave de API (formato: `bce-v3/ALTAK-...`)
4. Copie a chave de API para uso com o OpenClaw

## Configuracao da CLI

```bash
openclaw onboard --auth-choice qianfan-api-key
```

## Documentacao Relacionada

- [Configuracao do OpenClaw](/gateway/configuration)
- [Provedores de Modelo](/concepts/model-providers)
- [Configuracao de Agente](/concepts/agent)
- [Documentacao da API Qianfan](https://cloud.baidu.com/doc/qianfan-api/s/3m7of64lb)
