---
summary: "Lista de verificacion de lanzamiento de OpenClaw para macOS (feed de Sparkle, empaquetado, firma)"
read_when:
  - Al crear o validar un lanzamiento de OpenClaw para macOS
  - Al actualizar el appcast de Sparkle o los activos del feed
title: "Lanzamiento de macOS"
x-i18n:
  source_path: platforms/mac/release.md
  source_hash: ded637bef8ee3dc4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:31Z
---

# Lanzamiento de OpenClaw para macOS (Sparkle)

Esta aplicacion ahora incluye actualizaciones automaticas con Sparkle. Las compilaciones de lanzamiento deben estar firmadas con Developer ID, comprimidas en zip y publicadas con una entrada de appcast firmada.

## Requisitos previos

- Certificado Developer ID Application instalado (ejemplo: `Developer ID Application: <Developer Name> (<TEAMID>)`).
- Ruta de la clave privada de Sparkle configurada en el entorno como `SPARKLE_PRIVATE_KEY_FILE` (ruta a su clave privada ed25519 de Sparkle; la clave publica esta integrada en Info.plist). Si falta, revise `~/.profile`.
- Credenciales de notarizacion (perfil de llavero o clave de API) para `xcrun notarytool` si desea una distribucion DMG/zip segura con Gatekeeper.
  - Usamos un perfil de llavero llamado `openclaw-notary`, creado a partir de variables de entorno de la clave de API de App Store Connect en el perfil de su shell:
    - `APP_STORE_CONNECT_API_KEY_P8`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`
    - `echo "$APP_STORE_CONNECT_API_KEY_P8" | sed 's/\\n/\n/g' > /tmp/openclaw-notary.p8`
    - `xcrun notarytool store-credentials "openclaw-notary" --key /tmp/openclaw-notary.p8 --key-id "$APP_STORE_CONNECT_KEY_ID" --issuer "$APP_STORE_CONNECT_ISSUER_ID"`
- Dependencias de `pnpm` instaladas (`pnpm install --config.node-linker=hoisted`).
- Las herramientas de Sparkle se obtienen automaticamente mediante SwiftPM en `apps/macos/.build/artifacts/sparkle/Sparkle/bin/` (`sign_update`, `generate_appcast`, etc.).

## Compilar y empaquetar

Notas:

- `APP_BUILD` se asigna a `CFBundleVersion`/`sparkle:version`; mantengalo numerico y monotono (sin `-beta`), o Sparkle lo comparara como igual.
- De forma predeterminada usa la arquitectura actual (`$(uname -m)`). Para compilaciones de lanzamiento/universales, configure `BUILD_ARCHS="arm64 x86_64"` (o `BUILD_ARCHS=all`).
- Use `scripts/package-mac-dist.sh` para artefactos de lanzamiento (zip + DMG + notarizacion). Use `scripts/package-mac-app.sh` para empaquetado local/de desarrollo.

```bash
# From repo root; set release IDs so Sparkle feed is enabled.
# APP_BUILD must be numeric + monotonic for Sparkle compare.
BUNDLE_ID=bot.molt.mac \
APP_VERSION=2026.2.4 \
APP_BUILD="$(git rev-list --count HEAD)" \
BUILD_CONFIG=release \
SIGN_IDENTITY="Developer ID Application: <Developer Name> (<TEAMID>)" \
scripts/package-mac-app.sh

# Zip for distribution (includes resource forks for Sparkle delta support)
ditto -c -k --sequesterRsrc --keepParent dist/OpenClaw.app dist/OpenClaw-2026.2.4.zip

# Optional: also build a styled DMG for humans (drag to /Applications)
scripts/create-dmg.sh dist/OpenClaw.app dist/OpenClaw-2026.2.4.dmg

# Recommended: build + notarize/staple zip + DMG
# First, create a keychain profile once:
#   xcrun notarytool store-credentials "openclaw-notary" \
#     --apple-id "<apple-id>" --team-id "<team-id>" --password "<app-specific-password>"
NOTARIZE=1 NOTARYTOOL_PROFILE=openclaw-notary \
BUNDLE_ID=bot.molt.mac \
APP_VERSION=2026.2.4 \
APP_BUILD="$(git rev-list --count HEAD)" \
BUILD_CONFIG=release \
SIGN_IDENTITY="Developer ID Application: <Developer Name> (<TEAMID>)" \
scripts/package-mac-dist.sh

# Optional: ship dSYM alongside the release
ditto -c -k --keepParent apps/macos/.build/release/OpenClaw.app.dSYM dist/OpenClaw-2026.2.4.dSYM.zip
```

## Entrada de appcast

Use el generador de notas de lanzamiento para que Sparkle renderice notas HTML con formato:

```bash
SPARKLE_PRIVATE_KEY_FILE=/path/to/ed25519-private-key scripts/make_appcast.sh dist/OpenClaw-2026.2.4.zip https://raw.githubusercontent.com/openclaw/openclaw/main/appcast.xml
```

Genera notas de lanzamiento en HTML a partir de `CHANGELOG.md` (mediante [`scripts/changelog-to-html.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/changelog-to-html.sh)) y las integra en la entrada del appcast.
Confirme el `appcast.xml` actualizado junto con los activos del lanzamiento (zip + dSYM) al publicar.

## Publicar y verificar

- Cargue `OpenClaw-2026.2.4.zip` (y `OpenClaw-2026.2.4.dSYM.zip`) en el lanzamiento de GitHub para la etiqueta `v2026.2.4`.
- Asegurese de que la URL cruda del appcast coincida con el feed integrado: `https://raw.githubusercontent.com/openclaw/openclaw/main/appcast.xml`.
- Comprobaciones rapidas:
  - `curl -I https://raw.githubusercontent.com/openclaw/openclaw/main/appcast.xml` devuelve 200.
  - `curl -I <enclosure url>` devuelve 200 despues de cargar los activos.
  - En una compilacion publica anterior, ejecute “Check for Updates…” desde la pestaña About y verifique que Sparkle instale la nueva compilacion sin problemas.

Definicion de terminado: la aplicacion firmada y el appcast estan publicados, el flujo de actualizacion funciona desde una version instalada anterior y los activos del lanzamiento estan adjuntos al lanzamiento de GitHub.
