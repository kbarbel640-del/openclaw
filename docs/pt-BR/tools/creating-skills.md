---
title: "Criando Skills"
x-i18n:
  source_path: tools/creating-skills.md
  source_hash: ad801da34fe361ff
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:37Z
---

# Criando Skills Personalizadas 🛠

O OpenClaw foi projetado para ser facilmente extensível. "Skills" são a principal forma de adicionar novas capacidades ao seu assistente.

## O que e uma Skill?

Uma skill e um diretorio que contem um arquivo `SKILL.md` (que fornece instrucoes e definicoes de ferramentas para o LLM) e, opcionalmente, alguns scripts ou recursos.

## Passo a passo: Sua primeira Skill

### 1. Crie o diretorio

As Skills ficam no seu workspace, geralmente em `~/.openclaw/workspace/skills/`. Crie uma nova pasta para sua skill:

```bash
mkdir -p ~/.openclaw/workspace/skills/hello-world
```

### 2. Defina o `SKILL.md`

Crie um arquivo `SKILL.md` nesse diretorio. Esse arquivo usa frontmatter YAML para metadados e Markdown para instrucoes.

```markdown
---
name: hello_world
description: A simple skill that says hello.
---

# Hello World Skill

When the user asks for a greeting, use the `echo` tool to say "Hello from your custom skill!".
```

### 3. Adicione ferramentas (Opcional)

Voce pode definir ferramentas personalizadas no frontmatter ou instruir o agente a usar ferramentas de sistema existentes (como `bash` ou `browser`).

### 4. Atualize o OpenClaw

Peça ao seu agente para "atualizar skills" ou reinicie o Gateway. O OpenClaw vai descobrir o novo diretorio e indexar o `SKILL.md`.

## Boas praticas

- **Seja conciso**: Instrua o modelo sobre _o que_ fazer, nao sobre como ser uma IA.
- **Seguranca em primeiro lugar**: Se sua skill usa `bash`, garanta que os prompts nao permitam injecao arbitraria de comandos a partir de entrada de usuario nao confiavel.
- **Teste localmente**: Use `openclaw agent --message "use my new skill"` para testar.

## Skills compartilhadas

Voce tambem pode navegar e contribuir com skills no [ClawHub](https://clawhub.com).
