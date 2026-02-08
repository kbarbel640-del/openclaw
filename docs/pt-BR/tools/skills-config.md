---
summary: "Esquema de configuracao de Skills e exemplos"
read_when:
  - Ao adicionar ou modificar a configuracao de Skills
  - Ao ajustar a allowlist empacotada ou o comportamento de instalacao
title: "Configuracao de Skills"
x-i18n:
  source_path: tools/skills-config.md
  source_hash: e265c93da7856887
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:41Z
---

# Configuracao de Skills

Toda a configuracao relacionada a Skills fica em `skills` em `~/.openclaw/openclaw.json`.

```json5
{
  skills: {
    allowBundled: ["gemini", "peekaboo"],
    load: {
      extraDirs: ["~/Projects/agent-scripts/skills", "~/Projects/oss/some-skill-pack/skills"],
      watch: true,
      watchDebounceMs: 250,
    },
    install: {
      preferBrew: true,
      nodeManager: "npm", // npm | pnpm | yarn | bun (Gateway runtime still Node; bun not recommended)
    },
    entries: {
      "nano-banana-pro": {
        enabled: true,
        apiKey: "GEMINI_KEY_HERE",
        env: {
          GEMINI_API_KEY: "GEMINI_KEY_HERE",
        },
      },
      peekaboo: { enabled: true },
      sag: { enabled: false },
    },
  },
}
```

## Campos

- `allowBundled`: allowlist opcional apenas para Skills **empacotadas**. Quando definida, apenas
  as Skills empacotadas na lista sao elegiveis (Skills gerenciadas/do workspace nao sao afetadas).
- `load.extraDirs`: diretorios adicionais de Skills para varrer (menor precedencia).
- `load.watch`: observar pastas de Skills e atualizar o snapshot de Skills (padrao: true).
- `load.watchDebounceMs`: debounce para eventos do watcher de Skills em milissegundos (padrao: 250).
- `install.preferBrew`: preferir instaladores via brew quando disponiveis (padrao: true).
- `install.nodeManager`: preferencia do instalador Node (`npm` | `pnpm` | `yarn` | `bun`, padrao: npm).
  Isso afeta apenas **instalacoes de Skills**; o runtime do Gateway ainda deve ser Node
  (Bun nao recomendado para WhatsApp/Telegram).
- `entries.<skillKey>`: substituicoes por Skill.

Campos por Skill:

- `enabled`: definir `false` para desabilitar uma Skill mesmo se ela estiver empacotada/instalada.
- `env`: variaveis de ambiente injetadas para a execucao do agente (apenas se ainda nao estiverem definidas).
- `apiKey`: conveniencia opcional para Skills que declaram uma variavel de ambiente primaria.

## Observacoes

- Chaves em `entries` mapeiam para o nome da Skill por padrao. Se uma Skill definir
  `metadata.openclaw.skillKey`, use essa chave.
- Mudancas nas Skills sao aplicadas no proximo turno do agente quando o watcher esta habilitado.

### Skills em sandbox + variaveis de ambiente

Quando uma sessao esta **em sandbox**, os processos de Skills rodam dentro do Docker. O sandbox
**nao** herda `process.env` do host.

Use uma das opcoes:

- `agents.defaults.sandbox.docker.env` (ou por-agente `agents.list[].sandbox.docker.env`)
- incorporar as variaveis de ambiente na sua imagem de sandbox personalizada

`env` e `skills.entries.<skill>.env/apiKey` globais se aplicam apenas a execucoes no **host**.
