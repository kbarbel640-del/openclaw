---
summary: "Modelo de workspace para TOOLS.md"
read_when:
  - Inicializando um workspace manualmente
x-i18n:
  source_path: reference/templates/TOOLS.md
  source_hash: 3ed08cd537620749
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:19Z
---

# TOOLS.md - Notas Locais

Skills definem _como_ as ferramentas funcionam. Este arquivo é para as suas especificidades — o que é exclusivo da sua configuração.

## O que vai aqui

Coisas como:

- Nomes e locais de câmeras
- Hosts e aliases de SSH
- Vozes preferidas para TTS
- Nomes de alto-falantes/salas
- Apelidos de dispositivos
- Qualquer coisa específica do ambiente

## Exemplos

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Por que separar?

Skills são compartilhadas. Sua configuração é sua. Mantê-las separadas significa que você pode atualizar Skills sem perder suas notas e compartilhar Skills sem vazar sua infraestrutura.

---

Adicione o que ajudar você a fazer seu trabalho. Este é o seu guia rápido.
