---
summary: "Hook SOUL Evil (troca SOUL.md por SOUL_EVIL.md)"
read_when:
  - Voce quer habilitar ou ajustar o hook SOUL Evil
  - Voce quer uma janela de purge ou troca de persona por chance aleatoria
title: "Hook SOUL Evil"
x-i18n:
  source_path: hooks/soul-evil.md
  source_hash: cc32c1e207f2b692
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:24Z
---

# Hook SOUL Evil

O hook SOUL Evil troca o conteudo **injetado** `SOUL.md` por `SOUL_EVIL.md` durante
uma janela de purge ou por chance aleatoria. Ele **nao** modifica arquivos no disco.

## Como Funciona

Quando `agent:bootstrap` e executado, o hook pode substituir o conteudo `SOUL.md` em memoria
antes que o prompt do sistema seja montado. Se `SOUL_EVIL.md` estiver ausente ou vazio,
o OpenClaw registra um aviso e mantem o `SOUL.md` normal.

Execucoes de sub-agentes **nao** incluem `SOUL.md` em seus arquivos de bootstrap, portanto este hook
nao tem efeito em sub-agentes.

## Habilitar

```bash
openclaw hooks enable soul-evil
```

Em seguida, defina a configuracao:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "soul-evil": {
          "enabled": true,
          "file": "SOUL_EVIL.md",
          "chance": 0.1,
          "purge": { "at": "21:00", "duration": "15m" }
        }
      }
    }
  }
}
```

Crie `SOUL_EVIL.md` na raiz do workspace do agente (ao lado de `SOUL.md`).

## Opcoes

- `file` (string): nome alternativo do arquivo SOUL (padrao: `SOUL_EVIL.md`)
- `chance` (numero 0–1): chance aleatoria por execucao de usar `SOUL_EVIL.md`
- `purge.at` (HH:mm): inicio diario do purge (formato 24 horas)
- `purge.duration` (duracao): tamanho da janela (ex.: `30s`, `10m`, `1h`)

**Precedencia:** a janela de purge tem prioridade sobre a chance.

**Fuso horario:** usa `agents.defaults.userTimezone` quando definido; caso contrario, o fuso horario do host.

## Notas

- Nenhum arquivo e gravado ou modificado no disco.
- Se `SOUL.md` nao estiver na lista de bootstrap, o hook nao faz nada.

## Veja Tambem

- [Hooks](/hooks)
