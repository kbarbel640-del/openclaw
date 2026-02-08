---
summary: "`openclaw browser` の CLI リファレンス（プロファイル、タブ、アクション、拡張機能リレー）"
read_when:
  - `openclaw browser` を使用しており、一般的なタスクの例が欲しい場合
  - node host 経由で別のマシン上で動作しているブラウザを制御したい場合
  - Chrome 拡張機能リレーを使用したい場合（ツールバーボタンでの attach/detach）
title: "browser"
x-i18n:
  source_path: cli/browser.md
  source_hash: af35adfd68726fd5
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:52:39Z
---

# `openclaw browser`

OpenClaw のブラウザ制御サーバーを管理し、ブラウザアクション（タブ、スナップショット、スクリーンショット、ナビゲーション、クリック、入力）を実行します。

関連:

- ブラウザツール + API: [Browser tool](/tools/browser)
- Chrome 拡張機能リレー: [Chrome extension](/tools/chrome-extension)

## Common flags

- `--url <gatewayWsUrl>`: Gateway（ゲートウェイ）の WebSocket URL（デフォルトは設定）。
- `--token <token>`: Gateway（ゲートウェイ）トークン（必要な場合）。
- `--timeout <ms>`: リクエストタイムアウト（ms）。
- `--browser-profile <name>`: ブラウザプロファイルを選択（デフォルトは設定）。
- `--json`: 機械可読な出力（対応している場合）。

## Quick start (local)

```bash
openclaw browser --browser-profile chrome tabs
openclaw browser --browser-profile openclaw start
openclaw browser --browser-profile openclaw open https://example.com
openclaw browser --browser-profile openclaw snapshot
```

## Profiles

プロファイルは、名前付きのブラウザルーティング設定です。実際には:

- `openclaw`: OpenClaw が管理する専用の Chrome インスタンスを起動/アタッチします（分離されたユーザーデータディレクトリ）。
- `chrome`: Chrome 拡張機能リレーを介して、既存の Chrome タブを制御します。

```bash
openclaw browser profiles
openclaw browser create-profile --name work --color "#FF5A36"
openclaw browser delete-profile --name work
```

特定のプロファイルを使用します:

```bash
openclaw browser --browser-profile work tabs
```

## Tabs

```bash
openclaw browser tabs
openclaw browser open https://docs.openclaw.ai
openclaw browser focus <targetId>
openclaw browser close <targetId>
```

## Snapshot / screenshot / actions

スナップショット:

```bash
openclaw browser snapshot
```

スクリーンショット:

```bash
openclaw browser screenshot
```

ナビゲート/クリック/入力（ref ベースの UI 自動化）:

```bash
openclaw browser navigate https://example.com
openclaw browser click <ref>
openclaw browser type <ref> "hello"
```

## Chrome extension relay (attach via toolbar button)

このモードでは、手動で attach した既存の Chrome タブをエージェントが制御できます（自動 attach はしません）。

展開済みの拡張機能を安定したパスにインストールします:

```bash
openclaw browser extension install
openclaw browser extension path
```

続いて、Chrome → `chrome://extensions` → 「Developer mode」を有効化 → 「Load unpacked」→ 表示されたフォルダーを選択します。

完全ガイド: [Chrome extension](/tools/chrome-extension)

## Remote browser control (node host proxy)

Gateway（ゲートウェイ）がブラウザとは別のマシンで動作している場合は、Chrome/Brave/Edge/Chromium があるマシンで **node host** を実行します。Gateway（ゲートウェイ）は、その node にブラウザアクションをプロキシします（別途ブラウザ制御サーバーは不要です）。

自動ルーティングの制御には `gateway.nodes.browser.mode` を使用し、複数接続されている場合に特定の node に固定するには `gateway.nodes.browser.node` を使用します。

セキュリティ + リモート設定: [Browser tool](/tools/browser), [Remote access](/gateway/remote), [Tailscale](/gateway/tailscale), [Security](/gateway/security)
