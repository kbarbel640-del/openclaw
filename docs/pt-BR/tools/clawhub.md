---
summary: "Guia do ClawHub: registro publico de skills + fluxos de trabalho da CLI"
read_when:
  - Apresentando o ClawHub a novos usuarios
  - Instalando, pesquisando ou publicando skills
  - Explicando flags da CLI do ClawHub e o comportamento de sincronizacao
title: "ClawHub"
x-i18n:
  source_path: tools/clawhub.md
  source_hash: b572473a11246357
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:46Z
---

# ClawHub

ClawHub é o **registro publico de skills do OpenClaw**. É um servico gratuito: todas as skills sao publicas, abertas e visiveis para todos para compartilhamento e reutilizacao. Uma skill é apenas uma pasta com um arquivo `SKILL.md` (alem de arquivos de texto de suporte). Voce pode navegar pelas skills no aplicativo web ou usar a CLI para pesquisar, instalar, atualizar e publicar skills.

Site: [clawhub.ai](https://clawhub.ai)

## O que é o ClawHub

- Um registro publico para skills do OpenClaw.
- Um repositório versionado de pacotes de skills e metadados.
- Uma superficie de descoberta para busca, tags e sinais de uso.

## Como funciona

1. Um usuario publica um pacote de skill (arquivos + metadados).
2. O ClawHub armazena o pacote, analisa os metadados e atribui uma versao.
3. O registro indexa a skill para busca e descoberta.
4. Usuarios navegam, baixam e instalam skills no OpenClaw.

## O que voce pode fazer

- Publicar novas skills e novas versoes de skills existentes.
- Descobrir skills por nome, tags ou busca.
- Baixar pacotes de skills e inspecionar seus arquivos.
- Denunciar skills que sejam abusivas ou inseguras.
- Se voce for moderador, ocultar, reexibir, excluir ou banir.

## Para quem isso é (amigavel para iniciantes)

Se voce quer adicionar novas capacidades ao seu agente OpenClaw, o ClawHub é a forma mais facil de encontrar e instalar skills. Voce nao precisa saber como o backend funciona. Voce pode:

- Pesquisar skills usando linguagem simples.
- Instalar uma skill no seu workspace.
- Atualizar skills depois com um unico comando.
- Fazer backup das suas proprias skills publicando-as.

## Inicio rapido (nao tecnico)

1. Instale a CLI (veja a proxima secao).
2. Pesquise algo de que voce precisa:
   - `clawhub search "calendar"`
3. Instale uma skill:
   - `clawhub install <skill-slug>`
4. Inicie uma nova sessao do OpenClaw para que a nova skill seja carregada.

## Instalar a CLI

Escolha uma opcao:

```bash
npm i -g clawhub
```

```bash
pnpm add -g clawhub
```

## Como isso se encaixa no OpenClaw

Por padrao, a CLI instala skills em `./skills` dentro do seu diretorio de trabalho atual. Se um workspace do OpenClaw estiver configurado, `clawhub` recorre a esse workspace, a menos que voce sobrescreva `--workdir` (ou `CLAWHUB_WORKDIR`). O OpenClaw carrega skills do workspace a partir de `<workspace>/skills` e as reconhece na **proxima** sessao. Se voce ja usa `~/.openclaw/skills` ou skills empacotadas, as skills do workspace tem precedencia.

Para mais detalhes sobre como as skills sao carregadas, compartilhadas e controladas, veja
[Skills](/tools/skills).

## Visao geral do sistema de skills

Uma skill é um pacote versionado de arquivos que ensina o OpenClaw a executar uma
tarefa especifica. Cada publicacao cria uma nova versao, e o registro mantem um
historico de versoes para que usuarios possam auditar mudancas.

Uma skill tipica inclui:

- Um arquivo `SKILL.md` com a descricao principal e uso.
- Configuracoes opcionais, scripts ou arquivos de suporte usados pela skill.
- Metadados como tags, resumo e requisitos de instalacao.

O ClawHub usa metadados para impulsionar a descoberta e expor com seguranca as capacidades das skills.
O registro tambem acompanha sinais de uso (como estrelas e downloads) para melhorar
o ranqueamento e a visibilidade.

## O que o servico oferece (recursos)

- **Navegacao publica** de skills e de seu conteudo `SKILL.md`.
- **Busca** baseada em embeddings (busca vetorial), nao apenas em palavras-chave.
- **Versionamento** com semver, changelogs e tags (incluindo `latest`).
- **Downloads** como um zip por versao.
- **Estrelas e comentarios** para feedback da comunidade.
- **Moderacao** com ganchos para aprovacoes e auditorias.
- **API amigavel para CLI** para automacao e scripts.

## Seguranca e moderacao

O ClawHub é aberto por padrao. Qualquer pessoa pode enviar skills, mas uma conta do GitHub
precisa ter pelo menos uma semana para publicar. Isso ajuda a reduzir abusos sem bloquear
contribuidores legitimos.

Denuncias e moderacao:

- Qualquer usuario autenticado pode denunciar uma skill.
- Motivos de denuncia sao obrigatorios e registrados.
- Cada usuario pode ter ate 20 denuncias ativas por vez.
- Skills com mais de 3 denuncias unicas sao ocultadas automaticamente por padrao.
- Moderadores podem ver skills ocultas, reexibi-las, exclui-las ou banir usuarios.
- Abusar do recurso de denuncia pode resultar em banimento de conta.

Interessado em se tornar um moderador? Pergunte no Discord do OpenClaw e entre em contato com um
moderador ou mantenedor.

## Comandos e parametros da CLI

Opcoes globais (aplicam-se a todos os comandos):

- `--workdir <dir>`: Diretorio de trabalho (padrao: diretorio atual; recorre ao workspace do OpenClaw).
- `--dir <dir>`: Diretorio de skills, relativo ao workdir (padrao: `skills`).
- `--site <url>`: URL base do site (login no navegador).
- `--registry <url>`: URL base da API do registro.
- `--no-input`: Desativar prompts (nao interativo).
- `-V, --cli-version`: Exibir a versao da CLI.

Autenticacao:

- `clawhub login` (fluxo via navegador) ou `clawhub login --token <token>`
- `clawhub logout`
- `clawhub whoami`

Opcoes:

- `--token <token>`: Colar um token de API.
- `--label <label>`: Rotulo armazenado para tokens de login via navegador (padrao: `CLI token`).
- `--no-browser`: Nao abrir um navegador (requer `--token`).

Busca:

- `clawhub search "query"`
- `--limit <n>`: Maximo de resultados.

Instalar:

- `clawhub install <slug>`
- `--version <version>`: Instalar uma versao especifica.
- `--force`: Sobrescrever se a pasta ja existir.

Atualizar:

- `clawhub update <slug>`
- `clawhub update --all`
- `--version <version>`: Atualizar para uma versao especifica (apenas um slug).
- `--force`: Sobrescrever quando os arquivos locais nao correspondem a nenhuma versao publicada.

Listar:

- `clawhub list` (le `.clawhub/lock.json`)

Publicar:

- `clawhub publish <path>`
- `--slug <slug>`: Slug da skill.
- `--name <name>`: Nome de exibicao.
- `--version <version>`: Versao semver.
- `--changelog <text>`: Texto do changelog (pode estar vazio).
- `--tags <tags>`: Tags separadas por virgula (padrao: `latest`).

Excluir/restaurar (apenas proprietario/admin):

- `clawhub delete <slug> --yes`
- `clawhub undelete <slug> --yes`

Sync (varrer skills locais + publicar novas/atualizadas):

- `clawhub sync`
- `--root <dir...>`: Raizes extras para varredura.
- `--all`: Enviar tudo sem prompts.
- `--dry-run`: Mostrar o que seria enviado.
- `--bump <type>`: `patch|minor|major` para atualizacoes (padrao: `patch`).
- `--changelog <text>`: Changelog para atualizacoes nao interativas.
- `--tags <tags>`: Tags separadas por virgula (padrao: `latest`).
- `--concurrency <n>`: Verificacoes do registro (padrao: 4).

## Fluxos de trabalho comuns para agentes

### Pesquisar skills

```bash
clawhub search "postgres backups"
```

### Baixar novas skills

```bash
clawhub install my-skill-pack
```

### Atualizar skills instaladas

```bash
clawhub update --all
```

### Fazer backup das suas skills (publicar ou sincronizar)

Para uma unica pasta de skill:

```bash
clawhub publish ./my-skill --slug my-skill --name "My Skill" --version 1.0.0 --tags latest
```

Para varrer e fazer backup de muitas skills de uma vez:

```bash
clawhub sync --all
```

## Detalhes avancados (tecnico)

### Versionamento e tags

- Cada publicacao cria uma nova **semver** `SkillVersion`.
- Tags (como `latest`) apontam para uma versao; mover tags permite reverter.
- Changelogs sao anexados por versao e podem estar vazios ao sincronizar ou publicar atualizacoes.

### Mudancas locais vs versoes do registro

As atualizacoes comparam o conteudo local da skill com as versoes do registro usando um hash de conteudo. Se os arquivos locais nao corresponderem a nenhuma versao publicada, a CLI pergunta antes de sobrescrever (ou exige `--force` em execucoes nao interativas).

### Varredura do sync e raizes de fallback

`clawhub sync` varre primeiro o seu workdir atual. Se nenhuma skill for encontrada, ele recorre a locais legados conhecidos (por exemplo `~/openclaw/skills` e `~/.openclaw/skills`). Isso foi projetado para encontrar instalacoes antigas de skills sem flags extras.

### Armazenamento e arquivo de bloqueio

- Skills instaladas sao registradas em `.clawhub/lock.json` dentro do seu workdir.
- Tokens de autenticacao sao armazenados no arquivo de configuracao da CLI do ClawHub (sobrescreva via `CLAWHUB_CONFIG_PATH`).

### Telemetria (contagens de instalacao)

Quando voce executa `clawhub sync` enquanto esta autenticado, a CLI envia um snapshot minimo para calcular contagens de instalacao. Voce pode desativar isso completamente:

```bash
export CLAWHUB_DISABLE_TELEMETRY=1
```

## Variaveis de ambiente

- `CLAWHUB_SITE`: Sobrescrever a URL do site.
- `CLAWHUB_REGISTRY`: Sobrescrever a URL da API do registro.
- `CLAWHUB_CONFIG_PATH`: Sobrescrever onde a CLI armazena o token/configuracao.
- `CLAWHUB_WORKDIR`: Sobrescrever o workdir padrao.
- `CLAWHUB_DISABLE_TELEMETRY=1`: Desativar telemetria em `sync`.
