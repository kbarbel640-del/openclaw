---
summary: "Lista de verificacion paso a paso para lanzamiento de npm + app macOS"
read_when:
  - Lanzando una nueva version de npm
  - Lanzando una nueva version de la app macOS
  - Verificando metadatos antes de publicar
x-i18n:
  source_path: reference/RELEASING.md
  source_hash: 54cb2b822bfa3c0b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:59Z
---

# Lista de Verificacion de Lanzamiento (npm + macOS)

Use `pnpm` (Node 22+) desde la raiz del repo. Mantenga el arbol de trabajo limpio antes de etiquetar/publicar.

## Activador del operador

Cuando el operador diga “release”, haga inmediatamente este preflight (sin preguntas adicionales a menos que este bloqueado):

- Lea este doc y `docs/platforms/mac/release.md`.
- Cargue las variables de entorno desde `~/.profile` y confirme que `SPARKLE_PRIVATE_KEY_FILE` + las variables de App Store Connect esten configuradas (SPARKLE_PRIVATE_KEY_FILE debe vivir en `~/.profile`).
- Use las claves de Sparkle desde `~/Library/CloudStorage/Dropbox/Backup/Sparkle` si es necesario.

1. **Version y metadatos**

- [ ] Incremente la version de `package.json` (p. ej., `2026.1.29`).
- [ ] Ejecute `pnpm plugins:sync` para alinear las versiones de los paquetes de extensiones + changelogs.
- [ ] Actualice las cadenas de CLI/version: [`src/cli/program.ts`](https://github.com/openclaw/openclaw/blob/main/src/cli/program.ts) y el user agent de Baileys en [`src/provider-web.ts`](https://github.com/openclaw/openclaw/blob/main/src/provider-web.ts).
- [ ] Confirme los metadatos del paquete (nombre, descripcion, repositorio, palabras clave, licencia) y que el mapa `bin` apunte a [`openclaw.mjs`](https://github.com/openclaw/openclaw/blob/main/openclaw.mjs) para `openclaw`.
- [ ] Si cambiaron dependencias, ejecute `pnpm install` para que `pnpm-lock.yaml` este actualizado.

2. **Build y artefactos**

- [ ] Si cambiaron las entradas de A2UI, ejecute `pnpm canvas:a2ui:bundle` y haga commit de cualquier [`src/canvas-host/a2ui/a2ui.bundle.js`](https://github.com/openclaw/openclaw/blob/main/src/canvas-host/a2ui/a2ui.bundle.js) actualizado.
- [ ] `pnpm run build` (regenera `dist/`).
- [ ] Verifique que el paquete npm `files` incluya todas las carpetas `dist/*` requeridas (en particular `dist/node-host/**` y `dist/acp/**` para node headless + ACP CLI).
- [ ] Confirme que `dist/build-info.json` exista e incluya el hash `commit` esperado (el banner del CLI lo usa para instalaciones npm).
- [ ] Opcional: `npm pack --pack-destination /tmp` despues del build; inspeccione el contenido del tarball y mantengalo a mano para el release de GitHub (no lo haga commit).

3. **Changelog y docs**

- [ ] Actualice `CHANGELOG.md` con los aspectos destacados orientados al usuario (cree el archivo si falta); mantenga las entradas estrictamente en orden descendente por version.
- [ ] Asegure que los ejemplos/flags del README coincidan con el comportamiento actual del CLI (en particular nuevos comandos u opciones).

4. **Validacion**

- [ ] `pnpm build`
- [ ] `pnpm check`
- [ ] `pnpm test` (o `pnpm test:coverage` si necesita salida de cobertura)
- [ ] `pnpm release:check` (verifica el contenido de npm pack)
- [ ] `OPENCLAW_INSTALL_SMOKE_SKIP_NONROOT=1 pnpm test:install:smoke` (prueba rapida de instalacion en Docker; ruta rapida; requerida antes del lanzamiento)
  - Si el lanzamiento npm inmediatamente anterior es conocido como roto, configure `OPENCLAW_INSTALL_SMOKE_PREVIOUS=<last-good-version>` o `OPENCLAW_INSTALL_SMOKE_SKIP_PREVIOUS=1` para el paso de preinstall.
- [ ] (Opcional) Prueba completa del instalador (agrega cobertura de no-root + CLI): `pnpm test:install:smoke`
- [ ] (Opcional) E2E del instalador (Docker, ejecuta `curl -fsSL https://openclaw.ai/install.sh | bash`, incorpora, luego ejecuta llamadas reales de herramientas):
  - `pnpm test:install:e2e:openai` (requiere `OPENAI_API_KEY`)
  - `pnpm test:install:e2e:anthropic` (requiere `ANTHROPIC_API_KEY`)
  - `pnpm test:install:e2e` (requiere ambas claves; ejecuta ambos proveedores)
- [ ] (Opcional) Revise puntualmente el gateway web si sus cambios afectan las rutas de envio/recepcion.

5. **App macOS (Sparkle)**

- [ ] Construya + firme la app macOS, luego comprímala en zip para distribucion.
- [ ] Genere el appcast de Sparkle (notas HTML via [`scripts/make_appcast.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/make_appcast.sh)) y actualice `appcast.xml`.
- [ ] Mantenga listo el zip de la app (y el zip dSYM opcional) para adjuntarlo al release de GitHub.
- [ ] Siga [macOS release](/platforms/mac/release) para los comandos exactos y las variables de entorno requeridas.
  - `APP_BUILD` debe ser numerico + monotono (sin `-beta`) para que Sparkle compare versiones correctamente.
  - Si se realiza notarizacion, use el perfil de llavero `openclaw-notary` creado a partir de las variables de entorno de la API de App Store Connect (vea [macOS release](/platforms/mac/release)).

6. **Publicar (npm)**

- [ ] Confirme que el estado de git este limpio; haga commit y push segun sea necesario.
- [ ] `npm login` (verificar 2FA) si es necesario.
- [ ] `npm publish --access public` (use `--tag beta` para pre-releases).
- [ ] Verifique el registro: `npm view openclaw version`, `npm view openclaw dist-tags` y `npx -y openclaw@X.Y.Z --version` (o `--help`).

### Solucion de problemas (notas del release 2.0.0-beta2)

- **npm pack/publish se cuelga o produce un tarball enorme**: el bundle de la app macOS en `dist/OpenClaw.app` (y los zips de release) se incluyen en el paquete. Corrija permitiendo solo el contenido de publicacion via `package.json` `files` (incluya subdirectorios dist, docs, skills; excluya bundles de app). Confirme con `npm pack --dry-run` que `dist/OpenClaw.app` no este listado.
- **Bucle de autenticacion web de npm para dist-tags**: use autenticacion heredada para obtener el prompt de OTP:
  - `NPM_CONFIG_AUTH_TYPE=legacy npm dist-tag add openclaw@X.Y.Z latest`
- **La verificacion de `npx` falla con `ECOMPROMISED: Lock compromised`**: reintente con una cache nueva:
  - `NPM_CONFIG_CACHE=/tmp/npm-cache-$(date +%s) npx -y openclaw@X.Y.Z --version`
- **La etiqueta necesita reubicarse despues de un arreglo tardio**: fuerce la actualizacion y haga push de la etiqueta, luego asegure que los artefactos del release de GitHub sigan coincidiendo:
  - `git tag -f vX.Y.Z && git push -f origin vX.Y.Z`

7. **Release de GitHub + appcast**

- [ ] Etiquete y haga push: `git tag vX.Y.Z && git push origin vX.Y.Z` (o `git push --tags`).
- [ ] Cree/actualice el release de GitHub para `vX.Y.Z` con **titulo `openclaw X.Y.Z`** (no solo la etiqueta); el cuerpo debe incluir la seccion **completa** del changelog para esa version (Highlights + Changes + Fixes), en linea (sin enlaces sueltos), y **no debe repetir el titulo dentro del cuerpo**.
- [ ] Adjunte artefactos: tarball `npm pack` (opcional), `OpenClaw-X.Y.Z.zip` y `OpenClaw-X.Y.Z.dSYM.zip` (si se genero).
- [ ] Haga commit del `appcast.xml` actualizado y haga push (Sparkle se alimenta desde main).
- [ ] Desde un directorio temporal limpio (sin `package.json`), ejecute `npx -y openclaw@X.Y.Z send --help` para confirmar que la instalacion/entrypoints del CLI funcionen.
- [ ] Anuncie/comparta las notas del release.

## Ambito de publicacion de plugins (npm)

Solo publicamos **plugins npm existentes** bajo el ambito `@openclaw/*`. Los plugins
incluidos que no estan en npm permanecen **solo en el arbol del disco** (aun se envian en
`extensions/**`).

Proceso para derivar la lista:

1. `npm search @openclaw --json` y capture los nombres de los paquetes.
2. Compare con los nombres de `extensions/*/package.json`.
3. Publique solo la **interseccion** (ya en npm).

Lista actual de plugins npm (actualice segun sea necesario):

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

Las notas del release tambien deben mencionar **nuevos plugins incluidos opcionales** que **no
estan habilitados por defecto** (ejemplo: `tlon`).
