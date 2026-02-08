---
summary: "トラブルシューティングハブ：症状 → 確認 → 修正"
read_when:
  - エラーが表示され、修正手順を知りたい場合
  - インストーラーが「success」と表示されるが、CLI が動作しない場合
title: "トラブルシューティング"
x-i18n:
  source_path: help/troubleshooting.md
  source_hash: 00ba2a20732fa22c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:01Z
---

# トラブルシューティング

## 最初の60秒

次を順番に実行してください。

```bash
openclaw status
openclaw status --all
openclaw gateway probe
openclaw logs --follow
openclaw doctor
```

Gateway（ゲートウェイ）に到達できる場合は、詳細プローブを実行します。

```bash
openclaw status --deep
```

## よくある「壊れた」ケース

### `openclaw: command not found`

ほぼ確実に Node/npm の PATH の問題です。まずはここから始めてください。

- [インストール（Node/npm PATH の健全性確認）](/install#nodejs--npm-path-sanity)

### インストーラーが失敗する（または完全なログが必要な場合）

完全なトレースと npm の出力を確認するため、verbose モードでインストーラーを再実行します。

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --verbose
```

ベータ版インストールの場合：

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --beta --verbose
```

フラグの代わりに `OPENCLAW_VERBOSE=1` を設定することもできます。

### Gateway（ゲートウェイ）が「unauthorized」と表示される、接続できない、または再接続を繰り返す

- [Gateway トラブルシューティング](/gateway/troubleshooting)
- [Gateway 認証](/gateway/authentication)

### Control UI が HTTP で失敗する（デバイス ID が必要）

- [Gateway トラブルシューティング](/gateway/troubleshooting)
- [Control UI](/web/control-ui#insecure-http)

### `docs.openclaw.ai` に SSL エラーが表示される（Comcast/Xfinity）

一部の Comcast/Xfinity 接続では、Xfinity Advanced Security により `docs.openclaw.ai` がブロックされます。
Advanced Security を無効化するか、`docs.openclaw.ai` を許可リストに追加してから再試行してください。

- Xfinity Advanced Security のヘルプ：https://www.xfinity.com/support/articles/using-xfinity-xfi-advanced-security
- 簡易確認：モバイルホットスポットや VPN を試し、ISP レベルのフィルタリングかどうかを確認してください

### サービスは実行中と表示されるが、RPC プローブが失敗する

- [Gateway トラブルシューティング](/gateway/troubleshooting)
- [バックグラウンドプロセス / サービス](/gateway/background-process)

### モデル / 認証の失敗（レート制限、課金、「all models failed」）

- [モデル](/cli/models)
- [OAuth / 認証の概念](/concepts/oauth)

### `/model` が `model not allowed` と表示される

これは通常、`agents.defaults.models` が許可リストとして設定されていることを意味します。空でない場合、
そのプロバイダー / モデルのキーのみが選択可能になります。

- 許可リストを確認：`openclaw config get agents.defaults.models`
- 使いたいモデルを追加（または許可リストをクリア）して `/model` を再試行してください
- 許可されているプロバイダー / モデルを参照するには `/models` を使用してください

### Issue を提出する場合

安全なレポートを貼り付けてください。

```bash
openclaw status --all
```

可能であれば、`openclaw logs --follow` から該当するログの末尾も含めてください。
