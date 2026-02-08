---
summary: "OpenClaw macOS リリースチェックリスト（Sparkle フィード、パッケージング、署名）"
read_when:
  - OpenClaw macOS リリースを作成または検証する際
  - Sparkle の appcast またはフィードアセットを更新する際
title: "macOS リリース"
x-i18n:
  source_path: platforms/mac/release.md
  source_hash: ded637bef8ee3dc4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:26Z
---

# OpenClaw macOS リリース（Sparkle）

本アプリは現在、Sparkle の自動アップデートを提供しています。リリースビルドは、Developer ID で署名し、zip 化し、署名済み appcast エントリーとともに公開する必要があります。

## 前提条件

- Developer ID Application 証明書がインストールされていること（例: `Developer ID Application: <Developer Name> (<TEAMID>)`）。
- Sparkle の秘密鍵パスが環境内で `SPARKLE_PRIVATE_KEY_FILE` として設定されていること（Sparkle ed25519 秘密鍵へのパス。公開鍵は Info.plist に組み込まれています）。存在しない場合は、`~/.profile` を確認してください。
- Gatekeeper 対応の DMG / zip 配布を行う場合、`xcrun notarytool` 用の Notary 認証情報（キーチェーンプロファイルまたは API キー）があること。
  - App Store Connect API キーの環境変数から作成された、`openclaw-notary` という名前のキーチェーンプロファイルを使用します（シェルプロファイル内）。
    - `APP_STORE_CONNECT_API_KEY_P8`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`
    - `echo "$APP_STORE_CONNECT_API_KEY_P8" | sed 's/\\n/\n/g' > /tmp/openclaw-notary.p8`
    - `xcrun notarytool store-credentials "openclaw-notary" --key /tmp/openclaw-notary.p8 --key-id "$APP_STORE_CONNECT_KEY_ID" --issuer "$APP_STORE_CONNECT_ISSUER_ID"`
- `pnpm` の依存関係がインストールされていること（`pnpm install --config.node-linker=hoisted`）。
- Sparkle ツールは SwiftPM により `apps/macos/.build/artifacts/sparkle/Sparkle/bin/` から自動的に取得されます（`sign_update`, `generate_appcast` など）。

## ビルド & パッケージング

注意点:

- `APP_BUILD` は `CFBundleVersion`/`sparkle:version` に対応します。数値かつ単調増加にしてください（`-beta` は不可）。そうしないと、Sparkle が同一と比較します。
- デフォルトでは現在のアーキテクチャ（`$(uname -m)`）になります。リリース / ユニバーサルビルドの場合は、`BUILD_ARCHS="arm64 x86_64"`（または `BUILD_ARCHS=all`）を設定してください。
- リリース成果物（zip + DMG + 公証）には `scripts/package-mac-dist.sh` を使用します。ローカル / 開発用のパッケージングには `scripts/package-mac-app.sh` を使用します。

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

## Appcast エントリー

Sparkle が整形済み HTML のリリースノートをレンダリングできるよう、リリースノートジェネレーターを使用します。

```bash
SPARKLE_PRIVATE_KEY_FILE=/path/to/ed25519-private-key scripts/make_appcast.sh dist/OpenClaw-2026.2.4.zip https://raw.githubusercontent.com/openclaw/openclaw/main/appcast.xml
```

[`scripts/changelog-to-html.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/changelog-to-html.sh) を介して `CHANGELOG.md` から HTML のリリースノートを生成し、それらを appcast エントリーに埋め込みます。
公開時には、更新された `appcast.xml` をリリースアセット（zip + dSYM）とともにコミットしてください。

## 公開 & 検証

- タグ `v2026.2.4` の GitHub リリースに `OpenClaw-2026.2.4.zip`（および `OpenClaw-2026.2.4.dSYM.zip`）をアップロードします。
- raw appcast の URL が、組み込まれたフィードと一致していることを確認してください: `https://raw.githubusercontent.com/openclaw/openclaw/main/appcast.xml`。
- サニティチェック:
  - `curl -I https://raw.githubusercontent.com/openclaw/openclaw/main/appcast.xml` が 200 を返すこと。
  - アセットアップロード後に `curl -I <enclosure url>` が 200 を返すこと。
  - 以前の公開ビルド上で、「About」タブから「Check for Updates…」を実行し、Sparkle が新しいビルドを問題なくインストールすることを確認してください。

完了条件: 署名済みアプリと appcast が公開され、古いインストール済みバージョンからのアップデートフローが正常に動作し、リリースアセットが GitHub リリースに添付されていること。
