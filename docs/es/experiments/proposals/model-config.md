---
summary: "Exploración: configuración de modelos, perfiles de autenticación y comportamiento de fallback"
read_when:
  - Explorando ideas futuras de selección de modelos + perfiles de autenticación
title: "Exploración de Configuración de Modelos"
x-i18n:
  source_path: experiments/proposals/model-config.md
  source_hash: 48623233d80f874c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:44Z
---

# Configuración de Modelos (Exploración)

Este documento recoge **ideas** para la configuración futura de modelos. No es una
especificación en envío. Para el comportamiento actual, vea:

- [Models](/concepts/models)
- [Model failover](/concepts/model-failover)
- [OAuth + profiles](/concepts/oauth)

## Motivación

Los operadores quieren:

- Múltiples perfiles de autenticación por proveedor (personal vs trabajo).
- Selección simple de `/model` con fallbacks predecibles.
- Separación clara entre modelos de texto y modelos con capacidad de imagen.

## Posible dirección (alto nivel)

- Mantener la selección de modelos simple: `provider/model` con alias opcionales.
- Permitir que los proveedores tengan múltiples perfiles de autenticación, con un orden explícito.
- Usar una lista global de fallback para que todas las sesiones hagan failover de forma consistente.
- Solo sobrescribir el enrutamiento de imágenes cuando se configure explícitamente.

## Preguntas abiertas

- ¿La rotación de perfiles debería ser por proveedor o por modelo?
- ¿Cómo debería la UI mostrar la selección de perfiles para una sesión?
- ¿Cuál es la ruta de migración más segura desde las claves de configuración heredadas?
