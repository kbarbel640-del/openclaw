---
summary: "パッケージングスクリプトで生成される macOS デバッグビルドの署名手順"
read_when:
  - mac デバッグビルドのビルドまたは署名時
title: "macOS 署名"
x-i18n:
  source_path: platforms/mac/signing.md
  source_hash: 403b92f9a0ecdb7c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:30Z
---

# mac 署名（デバッグビルド）

このアプリは通常、[`scripts/package-mac-app.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/package-mac-app.sh) からビルドされます。このスクリプトは現在、以下を行います。

- 安定したデバッグ用バンドル識別子 `ai.openclaw.mac.debug` を設定します。
- そのバンドル ID を使用して Info.plist を書き込みます（`BUNDLE_ID=...` で上書き可能）。
- [`scripts/codesign-mac-app.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/codesign-mac-app.sh) を呼び出して、メインバイナリとアプリバンドルに署名します。これにより、macOS は各リビルドを同一の署名済みバンドルとして扱い、TCC の権限（通知、アクセシビリティ、画面収録、マイク、音声）を保持します。権限を安定させるには実在の署名 ID を使用してください。ad-hoc はオプトインで不安定です（[macOS permissions](/platforms/mac/permissions) を参照）。
- 既定で `CODESIGN_TIMESTAMP=auto` を使用します。これは Developer ID 署名に対して信頼済みタイムスタンプを有効にします。`CODESIGN_TIMESTAMP=off` を設定するとタイムスタンプをスキップできます（オフラインのデバッグビルド）。
- ビルドメタデータを Info.plist に注入します。`OpenClawBuildTimestamp`（UTC）および `OpenClawGitCommit`（短いハッシュ）により、「About」ペインでビルド、git、デバッグ／リリースのチャンネルを表示できます。
- **パッケージングには Node 22+ が必要です**。このスクリプトは TS ビルドと Control UI ビルドを実行します。
- 環境から `SIGN_IDENTITY` を読み取ります。常に自分の証明書で署名するには、`export SIGN_IDENTITY="Apple Development: Your Name (TEAMID)"`（または Developer ID Application 証明書）をシェルの rc に追加してください。ad-hoc 署名は `ALLOW_ADHOC_SIGNING=1` または `SIGN_IDENTITY="-"` による明示的なオプトインが必要です（権限テストには推奨されません）。
- 署名後に Team ID の監査を実行し、アプリバンドル内のいずれかの Mach-O が異なる Team ID で署名されている場合は失敗します。回避するには `SKIP_TEAM_ID_CHECK=1` を設定してください。

## 使用方法

```bash
# from repo root
scripts/package-mac-app.sh               # auto-selects identity; errors if none found
SIGN_IDENTITY="Developer ID Application: Your Name" scripts/package-mac-app.sh   # real cert
ALLOW_ADHOC_SIGNING=1 scripts/package-mac-app.sh    # ad-hoc (permissions will not stick)
SIGN_IDENTITY="-" scripts/package-mac-app.sh        # explicit ad-hoc (same caveat)
DISABLE_LIBRARY_VALIDATION=1 scripts/package-mac-app.sh   # dev-only Sparkle Team ID mismatch workaround
```

### ad-hoc 署名に関する注意

`SIGN_IDENTITY="-"`（ad-hoc）で署名する場合、スクリプトは **Hardened Runtime**（`--options runtime`）を自動的に無効化します。これは、同一の Team ID を共有しない埋め込みフレームワーク（Sparkle など）をアプリが読み込もうとした際のクラッシュを防ぐために必要です。ad-hoc 署名では TCC の権限保持も壊れます。復旧手順については [macOS permissions](/platforms/mac/permissions) を参照してください。

## About 用のビルドメタデータ

`package-mac-app.sh` は、バンドルに次の情報をスタンプします。

- `OpenClawBuildTimestamp`: パッケージ時点の ISO8601 UTC
- `OpenClawGitCommit`: 短い git ハッシュ（利用できない場合は `unknown`）

「About」タブは、これらのキーを読み取り、バージョン、ビルド日時、git コミット、そしてデバッグビルドかどうか（`#if DEBUG` 経由）を表示します。コード変更後は、これらの値を更新するためにパッケージャーを実行してください。

## 理由

TCC の権限は、バンドル識別子 **および** コード署名に紐づいています。UUID が変化する未署名のデバッグビルドでは、各リビルド後に macOS が付与済み権限を忘れてしまっていました。バイナリに署名（既定では ad-hoc）し、固定のバンドル ID／パス（`dist/OpenClaw.app`）を維持することで、VibeTunnel のアプローチと同様に、ビルド間で権限を保持できます。
