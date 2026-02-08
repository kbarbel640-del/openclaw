---
summary: " `openclaw devices` の CLI リファレンス（デバイスのペアリング + トークンのローテーション/失効）"
read_when:
  - デバイスのペアリング要求を承認する場合
  - デバイストークンをローテーションまたは失効させる必要がある場合
title: "デバイス"
x-i18n:
  source_path: cli/devices.md
  source_hash: ac7d130ecdc5d429
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:00:39Z
---

# `openclaw devices`

デバイスのペアリング要求とデバイススコープのトークンを管理します。

## コマンド

### `openclaw devices list`

保留中のペアリング要求とペアリング済みデバイスを一覧表示します。

```
openclaw devices list
openclaw devices list --json
```

### `openclaw devices approve <requestId>`

保留中のデバイスペアリング要求を承認します。

```
openclaw devices approve <requestId>
```

### `openclaw devices reject <requestId>`

保留中のデバイスペアリング要求を拒否します。

```
openclaw devices reject <requestId>
```

### `openclaw devices rotate --device <id> --role <role> [--scope <scope...>]`

特定のロールに対するデバイストークンをローテーションします（任意でスコープも更新します）。

```
openclaw devices rotate --device <deviceId> --role operator --scope operator.read --scope operator.write
```

### `openclaw devices revoke --device <id> --role <role>`

特定のロールに対するデバイストークンを失効させます。

```
openclaw devices revoke --device <deviceId> --role node
```

## 共通オプション

- `--url <url>`: Gateway（ゲートウェイ） WebSocket URL（設定されている場合は既定で `gateway.remote.url` になります）。
- `--token <token>`: Gateway（ゲートウェイ） トークン（必要な場合）。
- `--password <password>`: Gateway（ゲートウェイ） パスワード（パスワード認証）。
- `--timeout <ms>`: RPC タイムアウト。
- `--json`: JSON 出力（スクリプト用途に推奨）。

注: `--url` を設定すると、CLI は設定または環境変数の資格情報にフォールバックしません。
`--token` または `--password` を明示的に渡してください。明示的な資格情報が不足している場合はエラーになります。

## 注記

- トークンのローテーションは新しいトークン（機密）を返します。シークレットとして扱ってください。
- これらのコマンドには `operator.pairing`（または `operator.admin`）スコープが必要です。
