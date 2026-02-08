---
summary: "Bun ワークフロー（実験的）：pnpm とのインストール手順および注意点"
read_when:
  - 最速のローカル開発ループ（bun + watch）を求めている場合
  - Bun の install / patch / ライフサイクルスクリプトで問題に遭遇した場合
title: "Bun（実験的）"
x-i18n:
  source_path: install/bun.md
  source_hash: eb3f4c222b6bae49
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:02Z
---

# Bun（実験的）

目的：pnpm のワークフローから逸脱せずに、このリポジトリを **Bun** で実行します（任意。WhatsApp / Telegram では非推奨）。

⚠️ **Gateway ランタイムには非推奨**（WhatsApp / Telegram のバグ）。本番環境では Node を使用してください。

## ステータス

- Bun は、TypeScript を直接実行するための任意のローカルランタイムです（`bun run …`、`bun --watch …`）。
- `pnpm` はビルドのデフォルトであり、引き続き完全にサポートされています（また、一部のドキュメントツールで使用されています）。
- Bun は `pnpm-lock.yaml` を使用できず、これを無視します。

## インストール

デフォルト：

```sh
bun install
```

注意：`bun.lock` / `bun.lockb` は gitignore されているため、いずれの場合でもリポジトリに差分は発生しません。_ロックファイルを書き込まない_ 場合は次を使用してください：

```sh
bun install --no-save
```

## ビルド / テスト（Bun）

```sh
bun run build
bun run vitest run
```

## Bun のライフサイクルスクリプト（デフォルトでブロック）

Bun は、明示的に信頼しない限り依存関係のライフサイクルスクリプトをブロックする場合があります（`bun pm untrusted` / `bun pm trust`）。
このリポジトリでは、一般にブロックされるスクリプトは不要です：

- `@whiskeysockets/baileys` `preinstall`：Node のメジャーバージョンが 20 以上であることを確認します（本プロジェクトは Node 22 以上で実行します）。
- `protobufjs` `postinstall`：互換性のないバージョンスキームに関する警告を出力します（ビルド成果物は生成しません）。

これらのスクリプトが必要となる実際のランタイム問題に遭遇した場合は、明示的に信頼してください：

```sh
bun pm trust @whiskeysockets/baileys protobufjs
```

## 注意点

- 一部のスクリプトは依然として pnpm をハードコードしています（例：`docs:build`、`ui:*`、`protocol:check`）。当面は pnpm 経由で実行してください。
