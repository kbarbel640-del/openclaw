---
summary: "Mover (migrar) uma instalação do OpenClaw de uma máquina para outra"
read_when:
  - Voce esta movendo o OpenClaw para um novo laptop/servidor
  - Voce quer preservar sessoes, autenticacao e logins de canais (WhatsApp, etc.)
title: "Guia de Migracao"
x-i18n:
  source_path: install/migrating.md
  source_hash: 604d862c4bf86e79
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:45Z
---

# Migrando o OpenClaw para uma nova maquina

Este guia migra um Gateway do OpenClaw de uma maquina para outra **sem refazer a integracao inicial**.

A migracao e simples conceitualmente:

- Copiar o **diretorio de estado** (`$OPENCLAW_STATE_DIR`, padrao: `~/.openclaw/`) — isso inclui configuracao, autenticacao, sessoes e estado dos canais.
- Copiar o seu **workspace** (`~/.openclaw/workspace/` por padrao) — isso inclui seus arquivos de agente (memoria, prompts, etc.).

Mas ha armadilhas comuns envolvendo **perfis**, **permissoes** e **copias parciais**.

## Antes de comecar (o que voce esta migrando)

### 1) Identifique seu diretorio de estado

A maioria das instalacoes usa o padrao:

- **Dir de estado:** `~/.openclaw/`

Mas ele pode ser diferente se voce usar:

- `--profile <name>` (geralmente se torna `~/.openclaw-<profile>/`)
- `OPENCLAW_STATE_DIR=/some/path`

Se voce nao tiver certeza, execute na maquina **antiga**:

```bash
openclaw status
```

Procure mencoes a `OPENCLAW_STATE_DIR` / perfil na saida. Se voce executa varios gateways, repita para cada perfil.

### 2) Identifique seu workspace

Padroes comuns:

- `~/.openclaw/workspace/` (workspace recomendado)
- uma pasta personalizada que voce criou

Seu workspace e onde arquivos como `MEMORY.md`, `USER.md` e `memory/*.md` ficam.

### 3) Entenda o que voce ira preservar

Se voce copiar **ambos** o dir de estado e o workspace, voce mantem:

- Configuracao do Gateway (`openclaw.json`)
- Perfis de autenticacao / chaves de API / tokens OAuth
- Historico de sessoes + estado do agente
- Estado dos canais (ex.: login/sessao do WhatsApp)
- Seus arquivos de workspace (memoria, notas de Skills, etc.)

Se voce copiar **apenas** o workspace (por exemplo, via Git), voce **nao** preserva:

- sessoes
- credenciais
- logins de canais

Esses ficam em `$OPENCLAW_STATE_DIR`.

## Etapas de migracao (recomendado)

### Etapa 0 — Faca um backup (maquina antiga)

Na maquina **antiga**, pare o gateway primeiro para que os arquivos nao mudem durante a copia:

```bash
openclaw gateway stop
```

(Opcional, mas recomendado) compacte o dir de estado e o workspace:

```bash
# Adjust paths if you use a profile or custom locations
cd ~
tar -czf openclaw-state.tgz .openclaw

tar -czf openclaw-workspace.tgz .openclaw/workspace
```

Se voce tiver varios perfis/dirs de estado (por exemplo, `~/.openclaw-main`, `~/.openclaw-work`), compacte cada um.

### Etapa 1 — Instale o OpenClaw na nova maquina

Na maquina **nova**, instale a CLI (e o Node, se necessario):

- Veja: [Install](/install)

Nesta etapa, tudo bem se a integracao inicial criar um `~/.openclaw/` novo — voce ira sobrescreve-lo na proxima etapa.

### Etapa 2 — Copie o dir de estado + workspace para a nova maquina

Copie **ambos**:

- `$OPENCLAW_STATE_DIR` (padrao `~/.openclaw/`)
- seu workspace (padrao `~/.openclaw/workspace/`)

Abordagens comuns:

- `scp` os tarballs e extrair
- `rsync -a` via SSH
- unidade externa

Apos copiar, garanta:

- Diretorios ocultos foram incluidos (por exemplo, `.openclaw/`)
- A propriedade dos arquivos esta correta para o usuario que executa o gateway

### Etapa 3 — Execute o Doctor (migracoes + reparo de servicos)

Na maquina **nova**:

```bash
openclaw doctor
```

Doctor e o comando “seguro e sem surpresas”. Ele repara servicos, aplica migracoes de configuracao e alerta sobre incompatibilidades.

Em seguida:

```bash
openclaw gateway restart
openclaw status
```

## Armadilhas comuns (e como evita-las)

### Armadilha: incompatibilidade de perfil / dir de estado

Se voce executava o gateway antigo com um perfil (ou `OPENCLAW_STATE_DIR`), e o gateway novo usa um diferente, voce vera sintomas como:

- mudancas de configuracao nao surtindo efeito
- canais ausentes / desconectados
- historico de sessoes vazio

Correcao: execute o gateway/servico usando o **mesmo** perfil/dir de estado que voce migrou e, depois, execute novamente:

```bash
openclaw doctor
```

### Armadilha: copiar apenas `openclaw.json`

`openclaw.json` nao e suficiente. Muitos provedores armazenam estado em:

- `$OPENCLAW_STATE_DIR/credentials/`
- `$OPENCLAW_STATE_DIR/agents/<agentId>/...`

Sempre migre a pasta inteira `$OPENCLAW_STATE_DIR`.

### Armadilha: permissoes / propriedade

Se voce copiou como root ou mudou de usuarios, o gateway pode falhar ao ler credenciais/sessoes.

Correcao: garanta que o dir de estado + workspace pertencem ao usuario que executa o gateway.

### Armadilha: migrar entre modos remoto/local

- Se sua UI (WebUI/TUI) aponta para um gateway **remoto**, o host remoto e dono do armazenamento de sessoes + workspace.
- Migrar seu laptop nao movera o estado do gateway remoto.

Se voce estiver em modo remoto, migre o **host do gateway**.

### Armadilha: segredos em backups

`$OPENCLAW_STATE_DIR` contem segredos (chaves de API, tokens OAuth, credenciais do WhatsApp). Trate backups como segredos de producao:

- armazene de forma criptografada
- evite compartilhar por canais inseguros
- rotacione chaves se suspeitar de exposicao

## Checklist de verificacao

Na maquina nova, confirme:

- `openclaw status` mostra o gateway em execucao
- Seus canais ainda estao conectados (por exemplo, o WhatsApp nao exige novo pareamento)
- O painel abre e mostra sessoes existentes
- Seus arquivos de workspace (memoria, configuracoes) estao presentes

## Relacionados

- [Doctor](/gateway/doctor)
- [Solucao de problemas do Gateway](/gateway/troubleshooting)
- [Onde o OpenClaw armazena seus dados?](/help/faq#where-does-openclaw-store-its-data)
