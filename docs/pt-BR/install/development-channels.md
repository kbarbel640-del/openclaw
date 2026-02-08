---
summary: "Canais stable, beta e dev: semântica, troca e marcação"
read_when:
  - Voce quer alternar entre stable/beta/dev
  - Voce esta marcando ou publicando pre-releases
title: "Canais de Desenvolvimento"
x-i18n:
  source_path: install/development-channels.md
  source_hash: 2b01219b7e705044
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:29Z
---

# Canais de desenvolvimento

Ultima atualizacao: 2026-01-21

O OpenClaw disponibiliza tres canais de atualizacao:

- **stable**: npm dist-tag `latest`.
- **beta**: npm dist-tag `beta` (builds em teste).
- **dev**: cabeca movel de `main` (git). npm dist-tag: `dev` (quando publicado).

Enviamos builds para **beta**, testamos, e depois **promovemos um build validado para `latest`**
sem alterar o numero da versao — os dist-tags sao a fonte de verdade para instalacoes via npm.

## Alternando canais

Checkout via git:

```bash
openclaw update --channel stable
openclaw update --channel beta
openclaw update --channel dev
```

- `stable`/`beta` faz checkout da tag correspondente mais recente (geralmente a mesma tag).
- `dev` muda para `main` e faz rebase no upstream.

Instalacao global via npm/pnpm:

```bash
openclaw update --channel stable
openclaw update --channel beta
openclaw update --channel dev
```

Isso atualiza usando o dist-tag correspondente do npm (`latest`, `beta`, `dev`).

Quando voce **explicitamente** alterna canais com `--channel`, o OpenClaw tambem alinha
o metodo de instalacao:

- `dev` garante um checkout git (padrao `~/openclaw`, substitua com `OPENCLAW_GIT_DIR`),
  atualiza-o e instala a CLI global a partir desse checkout.
- `stable`/`beta` instala a partir do npm usando o dist-tag correspondente.

Dica: se voce quiser stable + dev em paralelo, mantenha dois clones e aponte seu Gateway para o stable.

## Plugins e canais

Quando voce alterna canais com `openclaw update`, o OpenClaw tambem sincroniza as fontes dos plugins:

- `dev` prefere plugins empacotados a partir do checkout git.
- `stable` e `beta` restauram pacotes de plugins instalados via npm.

## Boas praticas de marcacao

- Marque releases nas quais voce quer que os checkouts git parem (`vYYYY.M.D` ou `vYYYY.M.D-<patch>`).
- Mantenha as tags imutaveis: nunca mova ou reutilize uma tag.
- Os dist-tags do npm permanecem a fonte de verdade para instalacoes via npm:
  - `latest` → stable
  - `beta` → build candidato
  - `dev` → snapshot do main (opcional)

## Disponibilidade do app para macOS

Builds beta e dev podem **nao** incluir um release do app para macOS. Tudo bem:

- A tag git e o dist-tag do npm ainda podem ser publicados.
- Informe “sem build para macOS neste beta” nas notas de release ou no changelog.
