---
summary: "Checklist de lançamento passo a passo para npm + app macOS"
read_when:
  - Cortando um novo lançamento npm
  - Cortando um novo lançamento do app macOS
  - Verificando metadados antes de publicar
x-i18n:
  source_path: reference/RELEASING.md
  source_hash: 54cb2b822bfa3c0b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:26Z
---

# Checklist de Lançamento (npm + macOS)

Use `pnpm` (Node 22+) a partir da raiz do repositório. Mantenha a árvore de trabalho limpa antes de criar tags/publicar.

## Gatilho do operador

Quando o operador disser “release”, execute imediatamente este preflight (sem perguntas extras, a menos que esteja bloqueado):

- Leia este doc e `docs/platforms/mac/release.md`.
- Carregue as env a partir de `~/.profile` e confirme que `SPARKLE_PRIVATE_KEY_FILE` + variáveis do App Store Connect estão definidas (SPARKLE_PRIVATE_KEY_FILE deve ficar em `~/.profile`).
- Use as chaves do Sparkle de `~/Library/CloudStorage/Dropbox/Backup/Sparkle` se necessário.

1. **Versão e metadados**

- [ ] Incrementar a versão `package.json` (ex.: `2026.1.29`).
- [ ] Executar `pnpm plugins:sync` para alinhar versões dos pacotes de extensão + changelogs.
- [ ] Atualizar strings de CLI/versão: [`src/cli/program.ts`](https://github.com/openclaw/openclaw/blob/main/src/cli/program.ts) e o user agent do Baileys em [`src/provider-web.ts`](https://github.com/openclaw/openclaw/blob/main/src/provider-web.ts).
- [ ] Confirmar metadados do pacote (nome, descrição, repositório, keywords, licença) e que o mapa `bin` aponta para [`openclaw.mjs`](https://github.com/openclaw/openclaw/blob/main/openclaw.mjs) para `openclaw`.
- [ ] Se as dependências mudaram, execute `pnpm install` para que `pnpm-lock.yaml` fique atual.

2. **Build e artefatos**

- [ ] Se as entradas do A2UI mudaram, execute `pnpm canvas:a2ui:bundle` e faça commit de quaisquer [`src/canvas-host/a2ui/a2ui.bundle.js`](https://github.com/openclaw/openclaw/blob/main/src/canvas-host/a2ui/a2ui.bundle.js) atualizados.
- [ ] `pnpm run build` (regenera `dist/`).
- [ ] Verificar que o pacote npm `files` inclui todas as pastas `dist/*` necessárias (notadamente `dist/node-host/**` e `dist/acp/**` para node headless + ACP CLI).
- [ ] Confirmar que `dist/build-info.json` existe e inclui o hash `commit` esperado (o banner da CLI usa isso para instalações via npm).
- [ ] Opcional: `npm pack --pack-destination /tmp` após o build; inspecione o conteúdo do tarball e mantenha-o à mão para o release do GitHub (não faça commit).

3. **Changelog e docs**

- [ ] Atualizar `CHANGELOG.md` com destaques voltados ao usuário (crie o arquivo se não existir); mantenha as entradas estritamente em ordem decrescente por versão.
- [ ] Garantir que exemplos/flags do README correspondam ao comportamento atual da CLI (notadamente novos comandos ou opções).

4. **Validação**

- [ ] `pnpm build`
- [ ] `pnpm check`
- [ ] `pnpm test` (ou `pnpm test:coverage` se você precisar de saída de cobertura)
- [ ] `pnpm release:check` (verifica o conteúdo do npm pack)
- [ ] `OPENCLAW_INSTALL_SMOKE_SKIP_NONROOT=1 pnpm test:install:smoke` (smoke test de instalação via Docker, caminho rápido; obrigatório antes do release)
  - Se o release npm imediatamente anterior for conhecido como quebrado, defina `OPENCLAW_INSTALL_SMOKE_PREVIOUS=<last-good-version>` ou `OPENCLAW_INSTALL_SMOKE_SKIP_PREVIOUS=1` para a etapa de preinstall.
- [ ] (Opcional) Smoke completo do instalador (adiciona cobertura de não-root + CLI): `pnpm test:install:smoke`
- [ ] (Opcional) E2E do instalador (Docker, executa `curl -fsSL https://openclaw.ai/install.sh | bash`, faz onboarding e depois executa chamadas reais de ferramentas):
  - `pnpm test:install:e2e:openai` (requer `OPENAI_API_KEY`)
  - `pnpm test:install:e2e:anthropic` (requer `ANTHROPIC_API_KEY`)
  - `pnpm test:install:e2e` (requer ambas as chaves; executa ambos os provedores)
- [ ] (Opcional) Verificação pontual do web gateway se suas mudanças afetarem caminhos de envio/recebimento.

5. **App macOS (Sparkle)**

- [ ] Build + assinatura do app macOS e, em seguida, zip para distribuição.
- [ ] Gerar o appcast do Sparkle (notas em HTML via [`scripts/make_appcast.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/make_appcast.sh)) e atualizar `appcast.xml`.
- [ ] Manter o zip do app (e zip dSYM opcional) prontos para anexar ao release do GitHub.
- [ ] Seguir [macOS release](/platforms/mac/release) para os comandos exatos e variáveis de ambiente necessárias.
  - `APP_BUILD` deve ser numérico + monotônico (sem `-beta`) para que o Sparkle compare versões corretamente.
  - Se for notarizar, use o perfil de keychain `openclaw-notary` criado a partir das variáveis de ambiente da API do App Store Connect (ver [macOS release](/platforms/mac/release)).

6. **Publicar (npm)**

- [ ] Confirmar que o status do git está limpo; fazer commit e push conforme necessário.
- [ ] `npm login` (verificar 2FA) se necessário.
- [ ] `npm publish --access public` (use `--tag beta` para pré-releases).
- [ ] Verificar o registro: `npm view openclaw version`, `npm view openclaw dist-tags` e `npx -y openclaw@X.Y.Z --version` (ou `--help`).

### Solução de problemas (notas do release 2.0.0-beta2)

- **npm pack/publish trava ou produz tarball enorme**: o bundle do app macOS em `dist/OpenClaw.app` (e zips de release) é varrido para dentro do pacote. Corrija fazendo whitelist do conteúdo publicado via `package.json` `files` (incluir subdirs de dist, docs, skills; excluir bundles de app). Confirme com `npm pack --dry-run` que `dist/OpenClaw.app` não está listado.
- **Loop de auth web do npm para dist-tags**: use auth legado para obter prompt de OTP:
  - `NPM_CONFIG_AUTH_TYPE=legacy npm dist-tag add openclaw@X.Y.Z latest`
- **Verificação `npx` falha com `ECOMPROMISED: Lock compromised`**: tente novamente com cache novo:
  - `NPM_CONFIG_CACHE=/tmp/npm-cache-$(date +%s) npx -y openclaw@X.Y.Z --version`
- **Tag precisa ser repontada após correção tardia**: force-update e faça push da tag; depois garanta que os assets do release no GitHub ainda correspondem:
  - `git tag -f vX.Y.Z && git push -f origin vX.Y.Z`

7. **Release do GitHub + appcast**

- [ ] Criar tag e fazer push: `git tag vX.Y.Z && git push origin vX.Y.Z` (ou `git push --tags`).
- [ ] Criar/atualizar o release do GitHub para `vX.Y.Z` com **título `openclaw X.Y.Z`** (não apenas a tag); o corpo deve incluir a seção **completa** do changelog para essa versão (Highlights + Changes + Fixes), inline (sem links soltos), e **não deve repetir o título dentro do corpo**.
- [ ] Anexar artefatos: tarball `npm pack` (opcional), `OpenClaw-X.Y.Z.zip` e `OpenClaw-X.Y.Z.dSYM.zip` (se gerado).
- [ ] Fazer commit do `appcast.xml` atualizado e dar push (o Sparkle consome a partir do main).
- [ ] A partir de um diretório temporário limpo (sem `package.json`), executar `npx -y openclaw@X.Y.Z send --help` para confirmar que a instalação/entrypoints da CLI funcionam.
- [ ] Anunciar/compartilhar as notas do release.

## Escopo de publicação de plugins (npm)

Publicamos apenas **plugins npm existentes** sob o escopo `@openclaw/*`. Plugins
empacotados que não estão no npm permanecem **apenas na árvore de disco**
(ainda enviados em `extensions/**`).

Processo para derivar a lista:

1. `npm search @openclaw --json` e capturar os nomes dos pacotes.
2. Comparar com os nomes em `extensions/*/package.json`.
3. Publicar apenas a **interseção** (já existentes no npm).

Lista atual de plugins npm (atualize conforme necessário):

- @openclaw/bluebubbles
- @openclaw/diagnostics-otel
- @openclaw/discord
- @openclaw/feishu
- @openclaw/lobster
- @openclaw/matrix
- @openclaw/msteams
- @openclaw/nextcloud-talk
- @openclaw/nostr
- @openclaw/voice-call
- @openclaw/zalo
- @openclaw/zalouser

As notas de release também devem destacar **novos plugins empacotados opcionais** que **não
estão ativados por padrão** (exemplo: `tlon`).
