---
summary: "Danh sach kiem tra phat hanh OpenClaw macOS (nguon Sparkle, dong goi, ky)"
read_when:
  - Cat hoac xac nhan mot ban phat hanh OpenClaw macOS
  - Cap nhat appcast Sparkle hoac tai san nguon
title: "Phat hanh macOS"
x-i18n:
  source_path: platforms/mac/release.md
  source_hash: ded637bef8ee3dc4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:59Z
---

# Phat hanh OpenClaw macOS (Sparkle)

Ung dung nay hien phat hanh cap nhat tu dong qua Sparkle. Ban phat hanh phai duoc ky Developer ID, nen zip, va cong bo voi mot muc appcast da duoc ky.

## Dieu kien tien quyet

- Chung chi Developer ID Application da duoc cai dat (vi du: `Developer ID Application: <Developer Name> (<TEAMID>)`).
- Duong dan khoa rieng Sparkle duoc thiet lap trong moi truong la `SPARKLE_PRIVATE_KEY_FILE` (duong dan toi khoa rieng ed25519 cua Sparkle; khoa cong khai duoc nhung trong Info.plist). Neu thieu, hay kiem tra `~/.profile`.
- Thong tin dang nhap Notary (ho so keychain hoac khoa API) cho `xcrun notarytool` neu ban muon phan phoi DMG/zip an toan voi Gatekeeper.
  - Chung toi su dung ho so Keychain ten `openclaw-notary`, duoc tao tu cac env vars khoa API App Store Connect trong shell profile cua ban:
    - `APP_STORE_CONNECT_API_KEY_P8`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`
    - `echo "$APP_STORE_CONNECT_API_KEY_P8" | sed 's/\\n/\n/g' > /tmp/openclaw-notary.p8`
    - `xcrun notarytool store-credentials "openclaw-notary" --key /tmp/openclaw-notary.p8 --key-id "$APP_STORE_CONNECT_KEY_ID" --issuer "$APP_STORE_CONNECT_ISSUER_ID"`
- Da cai dat cac phu thuoc `pnpm` (`pnpm install --config.node-linker=hoisted`).
- Cong cu Sparkle duoc tai tu dong qua SwiftPM tai `apps/macos/.build/artifacts/sparkle/Sparkle/bin/` (`sign_update`, `generate_appcast`, v.v.).

## Build & dong goi

Ghi chu:

- `APP_BUILD` anh xa toi `CFBundleVersion`/`sparkle:version`; hay giu no la so va tang dan (khong `-beta`), neu khong Sparkle se so sanh no la bang nhau.
- Mac dinh theo kien truc hien tai (`$(uname -m)`). Doi voi ban phat hanh/universal, dat `BUILD_ARCHS="arm64 x86_64"` (hoac `BUILD_ARCHS=all`).
- Su dung `scripts/package-mac-dist.sh` cho tai san phat hanh (zip + DMG + notarization). Su dung `scripts/package-mac-app.sh` cho dong goi local/dev.

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

## Muc appcast

Su dung trinh tao ghi chu phat hanh de Sparkle hien thi ghi chu HTML da dinh dang:

```bash
SPARKLE_PRIVATE_KEY_FILE=/path/to/ed25519-private-key scripts/make_appcast.sh dist/OpenClaw-2026.2.4.zip https://raw.githubusercontent.com/openclaw/openclaw/main/appcast.xml
```

Tao ghi chu phat hanh HTML tu `CHANGELOG.md` (qua [`scripts/changelog-to-html.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/changelog-to-html.sh)) va nhung chung vao muc appcast.
Commit `appcast.xml` da cap nhat cung voi cac tai san phat hanh (zip + dSYM) khi cong bo.

## Cong bo & xac minh

- Tai len `OpenClaw-2026.2.4.zip` (va `OpenClaw-2026.2.4.dSYM.zip`) len GitHub release cho the `v2026.2.4`.
- Dam bao URL appcast raw khop voi nguon da duoc nhung: `https://raw.githubusercontent.com/openclaw/openclaw/main/appcast.xml`.
- Kiem tra nhanh:
  - `curl -I https://raw.githubusercontent.com/openclaw/openclaw/main/appcast.xml` tra ve 200.
  - `curl -I <enclosure url>` tra ve 200 sau khi tai tai san len.
  - Tren mot ban cong khai truoc do, chay “Check for Updates…” tu tab About va xac minh Sparkle cai dat ban moi thanh cong.

Dinh nghia hoan thanh: ung dung da duoc ky + appcast da duoc cong bo, luong cap nhat hoat dong tu mot phien ban cu da cai dat, va tai san phat hanh da duoc dinh kem vao GitHub release.
