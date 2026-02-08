---
summary: "zca-cli（QR ログイン）による Zalo 個人アカウントのサポート、機能、および設定"
read_when:
  - OpenClaw 用の Zalo Personal をセットアップする場合
  - Zalo Personal のログインやメッセージフローをデバッグする場合
title: "Zalo Personal"
x-i18n:
  source_path: channels/zalouser.md
  source_hash: 2a249728d556e5cc
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:51:01Z
---

# Zalo Personal（非公式）

ステータス: 実験的です。この統合は `zca-cli` により **Zalo の個人アカウント** を自動化します。

> **警告:** これは非公式の統合であり、アカウント停止／BAN につながる可能性があります。自己責任で使用してください。

## 必要なプラグイン

Zalo Personal はプラグインとして提供され、コアインストールには同梱されていません。

- CLI でインストール: `openclaw plugins install @openclaw/zalouser`
- またはソースのチェックアウトから: `openclaw plugins install ./extensions/zalouser`
- 詳細: [プラグイン](/plugin)

## 前提条件: zca-cli

Gateway（ゲートウェイ）マシンには、`PATH` に `zca` バイナリが利用可能である必要があります。

- 確認: `zca --version`
- ない場合は、zca-cli をインストールしてください（`extensions/zalouser/README.md` または上流の zca-cli ドキュメントを参照）。

## クイックセットアップ（初心者）

1. プラグインをインストールします（上記参照）。
2. ログインします（QR、Gateway（ゲートウェイ）マシン上）:
   - `openclaw channels login --channel zalouser`
   - 端末に表示された QR コードを Zalo のモバイルアプリでスキャンします。
3. チャンネルを有効化します:

```json5
{
  channels: {
    zalouser: {
      enabled: true,
      dmPolicy: "pairing",
    },
  },
}
```

4. Gateway（ゲートウェイ）を再起動します（またはオンボーディングを完了します）。
5. ダイレクトメッセージのアクセスはデフォルトでペアリングです。初回接触時にペアリングコードを承認してください。

## 概要

- `zca listen` を使用して受信メッセージを受け取ります。
- `zca msg ...` を使用して返信（テキスト／メディア／リンク）を送信します。
- Zalo Bot API が利用できない「個人アカウント」用途向けに設計されています。

## 命名

チャンネル ID は、**Zalo の個人ユーザーアカウント**（非公式）を自動化することを明確にするため `zalouser` です。将来の公式 Zalo API 統合の可能性に備え、`zalo` は予約しています。

## ID を見つける（ディレクトリ）

ディレクトリ CLI を使用して、相手／グループとその ID を検出します:

```bash
openclaw directory self --channel zalouser
openclaw directory peers list --channel zalouser --query "name"
openclaw directory groups list --channel zalouser --query "work"
```

## 制限

- 送信テキストは約 2000 文字ごとに分割されます（Zalo クライアントの制限）。
- ストリーミングはデフォルトでブロックされます。

## アクセス制御（ダイレクトメッセージ）

`channels.zalouser.dmPolicy` は `pairing | allowlist | open | disabled` をサポートします（デフォルト: `pairing`）。
`channels.zalouser.allowFrom` はユーザー ID または名前を受け付けます。ウィザードは利用可能な場合、`zca friend find` を介して名前を ID に解決します。

次で承認します:

- `openclaw pairing list zalouser`
- `openclaw pairing approve zalouser <code>`

## グループアクセス（任意）

- デフォルト: `channels.zalouser.groupPolicy = "open"`（グループを許可）。未設定時のデフォルトを上書きするには `channels.defaults.groupPolicy` を使用します。
- 許可リストで制限するには:
  - `channels.zalouser.groupPolicy = "allowlist"`
  - `channels.zalouser.groups`（キーはグループ ID または名前）
- すべてのグループをブロック: `channels.zalouser.groupPolicy = "disabled"`。
- 設定ウィザードはグループ許可リストの入力を促すことができます。
- 起動時に OpenClaw は許可リスト内のグループ／ユーザー名を ID に解決し、対応関係をログに記録します。解決できないエントリは入力どおりに保持されます。

例:

```json5
{
  channels: {
    zalouser: {
      groupPolicy: "allowlist",
      groups: {
        "123456789": { allow: true },
        "Work Chat": { allow: true },
      },
    },
  },
}
```

## マルチアカウント

アカウントは zca プロファイルに対応します。例:

```json5
{
  channels: {
    zalouser: {
      enabled: true,
      defaultAccount: "default",
      accounts: {
        work: { enabled: true, profile: "work" },
      },
    },
  },
}
```

## トラブルシューティング

**`zca` が見つかりません:**

- zca-cli をインストールし、Gateway（ゲートウェイ）プロセスの `PATH` 上にあることを確認してください。

**ログインが保持されません:**

- `openclaw channels status --probe`
- 再ログイン: `openclaw channels logout --channel zalouser && openclaw channels login --channel zalouser`
