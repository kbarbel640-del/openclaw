---
summary: "ブラウザ自動化 + X/Twitter 投稿のための手動ログイン"
read_when:
  - ブラウザ自動化のためにサイトへログインする必要がある場合
  - X/Twitter に更新を投稿したい場合
title: "ブラウザログイン"
x-i18n:
  source_path: tools/browser-login.md
  source_hash: 8ceea2d5258836e3
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:11:40Z
---

# ブラウザログイン + X/Twitter 投稿

## 手動ログイン（推奨）

サイトでログインが必要な場合は、**ホスト**のブラウザプロファイル（OpenClaw ブラウザ）で **手動でサインイン**してください。

モデルに認証情報を渡さないでください。自動ログインはアンチボット防御を作動させることが多く、アカウントがロックされる可能性があります。

メインのブラウザドキュメントに戻る: [Browser](/tools/browser)。

## どの Chrome プロファイルが使われますか？

OpenClaw は、**専用の Chrome プロファイル**（名前は `openclaw`、UI はオレンジがかった色味）を制御します。これは日常的に使っているブラウザプロファイルとは別です。

アクセスする簡単な方法が 2 つあります:

1. エージェントに **ブラウザを開く**よう依頼してから、自分でログインします。
2. **CLI 経由で開く**:

```bash
openclaw browser start
openclaw browser open https://x.com
```

複数のプロファイルがある場合は、`--browser-profile <name>` を渡してください（デフォルトは `openclaw` です）。

## X/Twitter: 推奨フロー

- **読み取り/検索/スレッド:** **bird** の CLI skill を使用します（ブラウザ不要、安定）。
  - リポジトリ: https://github.com/steipete/bird
- **更新の投稿:** **ホスト**のブラウザを使用します（手動ログイン）。

## サンドボックス化 + ホストブラウザへのアクセス

サンドボックス化されたブラウザセッションは、ボット検出を引き起こす可能性が **より高い**です。X/Twitter（および他の厳格なサイト）では、**ホスト**のブラウザを優先してください。

エージェントがサンドボックス化されている場合、ブラウザツールはデフォルトでサンドボックスを使用します。ホスト制御を許可するには:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        browser: {
          allowHostControl: true,
        },
      },
    },
  },
}
```

次に、ホストブラウザを対象にします:

```bash
openclaw browser open https://x.com --browser-profile openclaw --target host
```

または、更新を投稿するエージェントのサンドボックス化を無効にしてください。
