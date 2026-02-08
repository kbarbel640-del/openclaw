---
summary: "NIP-04 で暗号化されたメッセージによる Nostr ダイレクトメッセージチャンネル"
read_when:
  - Nostr 経由で OpenClaw がダイレクトメッセージを受信するようにしたい場合
  - 分散型メッセージングをセットアップしている場合
title: "Nostr"
x-i18n:
  source_path: channels/nostr.md
  source_hash: 6b9fe4c74bf5e7c0
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:47:45Z
---

# Nostr

**ステータス:** オプションのプラグイン（デフォルトでは無効）。

Nostr は、ソーシャルネットワーキングのための分散型プロトコルです。このチャンネルにより、OpenClaw は NIP-04 経由で暗号化されたダイレクトメッセージ（DM）を受信し、応答できます。

## インストール（オンデマンド）

### オンボーディング（推奨）

- オンボーディングウィザード（`openclaw onboard`）と `openclaw channels add` に、オプションのチャンネルプラグインが一覧表示されます。
- Nostr を選択すると、オンデマンドでプラグインをインストールするよう促されます。

インストールのデフォルト:

- **Dev チャンネル + git checkout が利用可能:** ローカルのプラグインパスを使用します。
- **Stable/Beta:** npm からダウンロードします。

プロンプトではいつでも選択を上書きできます。

### 手動インストール

```bash
openclaw plugins install @openclaw/nostr
```

ローカル checkout を使用します（dev ワークフロー）:

```bash
openclaw plugins install --link <path-to-openclaw>/extensions/nostr
```

プラグインをインストールまたは有効化した後は、Gateway（ゲートウェイ）を再起動してください。

## クイックセットアップ

1. Nostr の鍵ペアを生成します（必要な場合）:

```bash
# Using nak
nak key generate
```

2. 設定に追加します:

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}"
    }
  }
}
```

3. 鍵をエクスポートします:

```bash
export NOSTR_PRIVATE_KEY="nsec1..."
```

4. Gateway（ゲートウェイ）を再起動します。

## 設定リファレンス

| Key          | Type     | Default                                     | Description                        |
| ------------ | -------- | ------------------------------------------- | ---------------------------------- |
| `privateKey` | string   | required                                    | `nsec` または hex 形式の秘密鍵     |
| `relays`     | string[] | `['wss://relay.damus.io', 'wss://nos.lol']` | リレー URL（WebSocket）            |
| `dmPolicy`   | string   | `pairing`                                   | ダイレクトメッセージのアクセス方針 |
| `allowFrom`  | string[] | `[]`                                        | 許可する送信者 pubkey              |
| `enabled`    | boolean  | `true`                                      | チャンネルの有効/無効              |
| `name`       | string   | -                                           | 表示名                             |
| `profile`    | object   | -                                           | NIP-01 のプロフィールメタデータ    |

## プロフィールメタデータ

プロフィールデータは NIP-01 の `kind:0` イベントとして公開されます。Control UI（Channels -> Nostr -> Profile）から管理するか、設定で直接指定できます。

例:

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "profile": {
        "name": "openclaw",
        "displayName": "OpenClaw",
        "about": "Personal assistant DM bot",
        "picture": "https://example.com/avatar.png",
        "banner": "https://example.com/banner.png",
        "website": "https://example.com",
        "nip05": "openclaw@example.com",
        "lud16": "openclaw@example.com"
      }
    }
  }
}
```

注記:

- プロフィール URL は `https://` を使用する必要があります。
- リレーからのインポートはフィールドをマージし、ローカルの上書きを保持します。

## アクセス制御

### DM ポリシー

- **pairing**（デフォルト）: 未知の送信者にはペアリングコードを返します。
- **allowlist**: `allowFrom` 内の pubkey のみが DM できます。
- **open**: 公開の受信 DM（`allowFrom: ["*"]` が必要）。
- **disabled**: 受信 DM を無視します。

### allowlist の例

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "dmPolicy": "allowlist",
      "allowFrom": ["npub1abc...", "npub1xyz..."]
    }
  }
}
```

## 鍵フォーマット

受け付ける形式:

- **秘密鍵:** `nsec...` または 64 文字の hex
- **pubkey（`allowFrom`）:** `npub...` または hex

## リレー

デフォルト: `relay.damus.io` と `nos.lol`。

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "relays": ["wss://relay.damus.io", "wss://relay.primal.net", "wss://nostr.wine"]
    }
  }
}
```

ヒント:

- 冗長化のために 2〜3 個のリレーを使用してください。
- リレーが多すぎるのは避けてください（レイテンシ、重複）。
- 有料リレーは信頼性の向上に役立つ場合があります。
- ローカルリレーはテスト用途として問題ありません（`ws://localhost:7777`）。

## プロトコル対応

| NIP    | Status    | Description                               |
| ------ | --------- | ----------------------------------------- |
| NIP-01 | Supported | 基本イベント形式 + プロフィールメタデータ |
| NIP-04 | Supported | 暗号化 DM（`kind:4`）                     |
| NIP-17 | Planned   | ギフトラップ DM                           |
| NIP-44 | Planned   | バージョン付き暗号化                      |

## テスト

### ローカルリレー

```bash
# Start strfry
docker run -p 7777:7777 ghcr.io/hoytech/strfry
```

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "relays": ["ws://localhost:7777"]
    }
  }
}
```

### 手動テスト

1. ログからボットの pubkey（npub）を確認します。
2. Nostr クライアント（Damus、Amethyst など）を開きます。
3. ボットの pubkey に DM を送ります。
4. 応答を確認します。

## トラブルシューティング

### メッセージを受信できない

- 秘密鍵が有効であることを確認してください。
- リレー URL に到達でき、`wss://` を使用していることを確認してください（ローカルの場合は `ws://`）。
- `enabled` が `false` ではないことを確認してください。
- リレー接続エラーについて Gateway（ゲートウェイ）のログを確認してください。

### 応答を送信できない

- リレーが書き込みを受け付けることを確認してください。
- アウトバウンドの接続性を確認してください。
- リレーのレート制限に注意してください。

### 応答が重複する

- 複数のリレーを使用している場合に想定されます。
- メッセージはイベント ID で重複排除され、最初の配信のみが応答をトリガーします。

## セキュリティ

- 秘密鍵は決してコミットしないでください。
- 鍵には環境変数を使用してください。
- 本番ボットでは `allowlist` を検討してください。

## 制限（MVP）

- ダイレクトメッセージのみ（グループチャットは非対応）。
- メディア添付は非対応。
- NIP-04 のみ（NIP-17 のギフトラップは予定）。
