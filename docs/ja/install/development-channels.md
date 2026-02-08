---
summary: "stable、beta、dev チャンネルの意味、切り替え、タグ付け"
read_when:
  - stable/beta/dev を切り替えたい場合
  - プレリリースのタグ付けや公開を行う場合
title: "開発チャンネル"
x-i18n:
  source_path: install/development-channels.md
  source_hash: 2b01219b7e705044
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:05Z
---

# 開発チャンネル

最終更新日: 2026-01-21

OpenClaw は 3 つの更新チャンネルを提供します。

- **stable**: npm dist-tag `latest`。
- **beta**: npm dist-tag `beta`（テスト中のビルド）。
- **dev**: `main`（git）の移動する先端。npm dist-tag: `dev`（公開時）。

私たちは **beta** にビルドを配信してテストし、その後、**検証済みのビルドを `latest` に昇格** します。
バージョン番号は変更しません。npm インストールにおける信頼できる情報源は dist-tag です。

## チャンネルの切り替え

Git のチェックアウト:

```bash
openclaw update --channel stable
openclaw update --channel beta
openclaw update --channel dev
```

- `stable`/`beta` は、最新の一致するタグをチェックアウトします（多くの場合、同じタグです）。
- `dev` は `main` に切り替え、上流にリベースします。

npm/pnpm のグローバルインストール:

```bash
openclaw update --channel stable
openclaw update --channel beta
openclaw update --channel dev
```

これにより、対応する npm dist-tag（`latest`、`beta`、`dev`）を介して更新されます。

`--channel` を使って **明示的に** チャンネルを切り替えると、OpenClaw は
インストール方法も整合させます。

- `dev` は git チェックアウトを確保し（デフォルトは `~/openclaw`、`OPENCLAW_GIT_DIR` で上書き可能）、
  それを更新して、そのチェックアウトからグローバル CLI をインストールします。
- `stable`/`beta` は、対応する dist-tag を使用して npm からインストールします。

ヒント: stable と dev を並行して使いたい場合は、2 つのクローンを保持し、ゲートウェイを stable の方に向けてください。

## プラグインとチャンネル

`openclaw update` でチャンネルを切り替えると、OpenClaw はプラグインのソースも同期します。

- `dev` は、git チェックアウトに同梱されたプラグインを優先します。
- `stable` と `beta` は、npm でインストールされたプラグインパッケージを復元します。

## タグ付けのベストプラクティス

- git のチェックアウト先にしたいリリースにはタグを付けてください（`vYYYY.M.D` または `vYYYY.M.D-<patch>`）。
- タグは不変に保ちます。タグを移動したり再利用したりしないでください。
- npm dist-tag は npm インストールにおける信頼できる情報源のままです。
  - `latest` → stable
  - `beta` → 候補ビルド
  - `dev` → main スナップショット（任意）

## macOS アプリの提供状況

beta および dev のビルドには、macOS アプリのリリースが **含まれない** 場合があります。問題ありません。

- git タグおよび npm dist-tag は引き続き公開できます。
- リリースノートや変更履歴で「この beta には macOS ビルドはありません」と明記してください。
