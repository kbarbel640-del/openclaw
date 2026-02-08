---
summary: "Exploracao: configuracao de modelo, perfis de autenticacao e comportamento de fallback"
read_when:
  - Explorando ideias futuras de selecao de modelo + perfis de autenticacao
title: "Exploracao de Configuracao de Modelo"
x-i18n:
  source_path: experiments/proposals/model-config.md
  source_hash: 48623233d80f874c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:06Z
---

# Configuracao de Modelo (Exploracao)

Este documento captura **ideias** para futuras configuracoes de modelo. Nao e uma
especificacao de entrega. Para o comportamento atual, veja:

- [Models](/concepts/models)
- [Model failover](/concepts/model-failover)
- [OAuth + profiles](/concepts/oauth)

## Motivacao

Operadores querem:

- Multiplos perfis de autenticacao por provedor (pessoal vs trabalho).
- Selecao simples de `/model` com fallbacks previsiveis.
- Separacao clara entre modelos de texto e modelos com capacidade de imagem.

## Possivel direcao (alto nivel)

- Manter a selecao de modelos simples: `provider/model` com aliases opcionais.
- Permitir que provedores tenham multiplos perfis de autenticacao, com uma ordem explicita.
- Usar uma lista global de fallback para que todas as sessoes realizem failover de forma consistente.
- Substituir o roteamento de imagem apenas quando explicitamente configurado.

## Questoes em aberto

- A rotacao de perfis deve ser por provedor ou por modelo?
- Como a UI deve apresentar a selecao de perfil para uma sessao?
- Qual e o caminho de migracao mais seguro a partir de chaves de configuracao legadas?
