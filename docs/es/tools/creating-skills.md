---
title: "Creación de Skills"
x-i18n:
  source_path: tools/creating-skills.md
  source_hash: ad801da34fe361ff
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:07Z
---

# Creación de Skills Personalizados 🛠

OpenClaw está diseñado para ser fácilmente extensible. Los "Skills" son la forma principal de agregar nuevas capacidades a su asistente.

## ¿Qué es un Skill?

Un Skill es un directorio que contiene un archivo `SKILL.md` (que proporciona instrucciones y definiciones de herramientas al LLM) y, de forma opcional, algunos scripts o recursos.

## Paso a Paso: Su Primer Skill

### 1. Cree el Directorio

Los Skills viven en su espacio de trabajo, normalmente `~/.openclaw/workspace/skills/`. Cree una nueva carpeta para su Skill:

```bash
mkdir -p ~/.openclaw/workspace/skills/hello-world
```

### 2. Defina el `SKILL.md`

Cree un archivo `SKILL.md` en ese directorio. Este archivo utiliza frontmatter YAML para los metadatos y Markdown para las instrucciones.

```markdown
---
name: hello_world
description: A simple skill that says hello.
---

# Hello World Skill

When the user asks for a greeting, use the `echo` tool to say "Hello from your custom skill!".
```

### 3. Agregue Herramientas (Opcional)

Puede definir herramientas personalizadas en el frontmatter o indicar al agente que use herramientas del sistema existentes (como `bash` o `browser`).

### 4. Actualice OpenClaw

Pida a su agente que "actualice skills" o reinicie el Gateway. OpenClaw descubrirá el nuevo directorio e indexará el `SKILL.md`.

## Mejores Prácticas

- **Sea Conciso**: Indique al modelo _qué_ hacer, no cómo ser una IA.
- **La Seguridad es lo Primero**: Si su Skill utiliza `bash`, asegúrese de que los prompts no permitan la inyección arbitraria de comandos desde entradas de usuario no confiables.
- **Pruebe Localmente**: Use `openclaw agent --message "use my new skill"` para realizar pruebas.

## Skills Compartidos

También puede explorar y contribuir Skills en [ClawHub](https://clawhub.com).
