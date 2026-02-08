---
summary: "Zalo Personal プラグイン：zca-cli による QR ログイン + メッセージング（プラグインのインストール + チャンネル設定 + CLI + ツール）"
read_when:
  - OpenClaw で Zalo Personal（非公式）のサポートが必要な場合
  - zalouser プラグインを設定または開発している場合
title: "Zalo Personal プラグイン"
x-i18n:
  source_path: plugins/zalouser.md
  source_hash: b29b788b023cd507
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:31Z
---

# Zalo Personal（プラグイン）

`zca-cli` を使用して通常の Zalo ユーザーアカウントを自動化する、プラグイン経由の OpenClaw 向け Zalo Personal サポートです。

> **警告:** 非公式の自動化は、アカウントの一時停止または永久停止につながる可能性があります。自己責任で使用してください。

## 命名

チャンネル ID は `zalouser` です。これは **個人の Zalo ユーザーアカウント**（非公式）を自動化することを明示するためです。将来の公式 Zalo API 統合の可能性に備え、`zalo` は予約しています。

## 実行場所

このプラグインは **Gateway（ゲートウェイ）プロセス内** で実行されます。

リモートの Gateway（ゲートウェイ）を使用している場合は、**Gateway（ゲートウェイ）を実行しているマシン** にインストールおよび設定し、その後 Gateway（ゲートウェイ）を再起動してください。

## インストール

### オプション A: npm からインストール

```bash
openclaw plugins install @openclaw/zalouser
```

その後、Gateway（ゲートウェイ）を再起動してください。

### オプション B: ローカルフォルダからインストール（開発用）

```bash
openclaw plugins install ./extensions/zalouser
cd ./extensions/zalouser && pnpm install
```

その後、Gateway（ゲートウェイ）を再起動してください。

## 前提条件: zca-cli

Gateway（ゲートウェイ）マシンには、`PATH` 上に `zca` がインストールされている必要があります。

```bash
zca --version
```

## 設定

チャンネル設定は `channels.zalouser` 配下にあります（`plugins.entries.*` ではありません）。

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

## CLI

```bash
openclaw channels login --channel zalouser
openclaw channels logout --channel zalouser
openclaw channels status --probe
openclaw message send --channel zalouser --target <threadId> --message "Hello from OpenClaw"
openclaw directory peers list --channel zalouser --query "name"
```

## エージェントツール

ツール名: `zalouser`

アクション: `send`, `image`, `link`, `friends`, `groups`, `me`, `status`
