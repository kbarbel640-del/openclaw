---
title: サンドボックス vs ツールポリシー vs Elevated
summary: "ツールがブロックされる理由：サンドボックス実行時、ツールの許可／拒否ポリシー、Elevated 実行ゲート"
read_when: "「sandbox jail」に当たった、またはツール／Elevated の拒否を見て、変更すべき正確な設定キーを知りたいとき。"
status: active
x-i18n:
  source_path: gateway/sandbox-vs-tool-policy-vs-elevated.md
  source_hash: 863ea5e6d137dfb6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:31:51Z
---

# サンドボックス vs ツールポリシー vs Elevated

OpenClaw には、関連はしているものの異なる 3 つの制御があります。

1. **サンドボックス**（`agents.defaults.sandbox.*` / `agents.list[].sandbox.*`）は、**ツールがどこで実行されるか**（Docker かホストか）を決定します。
2. **ツールポリシー**（`tools.*`, `tools.sandbox.tools.*`, `agents.list[].tools.*`）は、**どのツールが利用可能／許可されるか**を決定します。
3. **Elevated**（`tools.elevated.*`, `agents.list[].tools.elevated.*`）は、サンドボックス化されているときにホスト上で実行するための **exec 専用の非常口** です。

## クイックデバッグ

インスペクターを使って、OpenClaw が _実際に_ 何をしているかを確認します。

```bash
openclaw sandbox explain
openclaw sandbox explain --session agent:main:main
openclaw sandbox explain --agent work
openclaw sandbox explain --json
```

出力内容：

- 有効なサンドボックスのモード／スコープ／ワークスペースアクセス
- セッションが現在サンドボックス化されているかどうか（main か non-main か）
- 有効なサンドボックスのツール許可／拒否（agent／global／default のどれ由来か）
- Elevated のゲートと修正用キーのパス

## サンドボックス：ツールが実行される場所

サンドボックス化は `agents.defaults.sandbox.mode` で制御されます。

- `"off"`：すべてがホスト上で実行されます。
- `"non-main"`：non-main セッションのみがサンドボックス化されます（グループ／チャンネルでよくある「想定外」）。
- `"all"`：すべてがサンドボックス化されます。

完全なマトリクス（スコープ、ワークスペースのマウント、イメージ）については [サンドボックス化](/gateway/sandboxing) を参照してください。

### バインドマウント（セキュリティのクイックチェック）

- `docker.binds` はサンドボックスのファイルシステムを _貫通_ します。マウントしたものは、設定したモード（`:ro` または `:rw`）でコンテナ内から見えます。
- モードを省略した場合のデフォルトは読み書き可能です。ソースやシークレットには `:ro` を推奨します。
- `scope: "shared"` はエージェントごとのバインドを無視します（グローバルバインドのみが適用されます）。
- `/var/run/docker.sock` をバインドすると、事実上ホストの制御をサンドボックスに渡すことになります。意図的な場合にのみ行ってください。
- ワークスペースアクセス（`workspaceAccess: "ro"`/`"rw"`）は、バインドモードとは独立しています。

## ツールポリシー：存在／呼び出し可能なツール

重要なのは次の 2 層です。

- **ツールプロファイル**：`tools.profile` と `agents.list[].tools.profile`（基本の許可リスト）
- **プロバイダーツールプロファイル**：`tools.byProvider[provider].profile` と `agents.list[].tools.byProvider[provider].profile`
- **グローバル／エージェント別ツールポリシー**：`tools.allow`/`tools.deny` と `agents.list[].tools.allow`/`agents.list[].tools.deny`
- **プロバイダーツールポリシー**：`tools.byProvider[provider].allow/deny` と `agents.list[].tools.byProvider[provider].allow/deny`
- **サンドボックスツールポリシー**（サンドボックス時のみ適用）：`tools.sandbox.tools.allow`/`tools.sandbox.tools.deny` と `agents.list[].tools.sandbox.tools.*`

経験則：

- `deny` が常に優先されます。
- `allow` が空でない場合、それ以外はすべてブロックされたものとして扱われます。
- ツールポリシーが最終的な停止点です。`/exec` は、拒否された `exec` ツールを上書きできません。
- `/exec` は、認可された送信者に対するセッション既定値を変更するだけで、ツールアクセスを付与しません。  
  プロバイダーツールキーは、`provider`（例：`google-antigravity`）または `provider/model`（例：`openai/gpt-5.2`）のいずれかを受け付けます。

### ツールグループ（ショートハンド）

ツールポリシー（グローバル、エージェント、サンドボックス）は、複数のツールに展開される `group:*` エントリーをサポートします。

```json5
{
  tools: {
    sandbox: {
      tools: {
        allow: ["group:runtime", "group:fs", "group:sessions", "group:memory"],
      },
    },
  },
}
```

利用可能なグループ：

- `group:runtime`：`exec`, `bash`, `process`
- `group:fs`：`read`, `write`, `edit`, `apply_patch`
- `group:sessions`：`sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`, `session_status`
- `group:memory`：`memory_search`, `memory_get`
- `group:ui`：`browser`, `canvas`
- `group:automation`：`cron`, `gateway`
- `group:messaging`：`message`
- `group:nodes`：`nodes`
- `group:openclaw`：すべての組み込み OpenClaw ツール（プロバイダープラグインは除外）

## Elevated：exec 専用の「ホストで実行」

Elevated は追加のツールを付与 **しません**。影響するのは `exec` のみです。

- サンドボックス化されている場合、`/elevated on`（または `exec` と `elevated: true`）はホスト上で実行されます（承認が必要な場合があります）。
- セッションの exec 承認をスキップするには `/elevated full` を使用します。
- すでに直接実行している場合、Elevated は実質的に no-op です（それでもゲートは適用されます）。
- Elevated は Skill スコープではなく、ツールの許可／拒否を上書き **しません**。
- `/exec` は Elevated とは別です。認可された送信者に対するセッションごとの exec 既定値を調整するだけです。

ゲート：

- 有効化：`tools.elevated.enabled`（必要に応じて `agents.list[].tools.elevated.enabled`）
- 送信者の許可リスト：`tools.elevated.allowFrom.<provider>`（必要に応じて `agents.list[].tools.elevated.allowFrom.<provider>`）

詳細は [Elevated モード](/tools/elevated) を参照してください。

## よくある「sandbox jail」の修正

### 「ツール X がサンドボックスツールポリシーによりブロックされた」

修正用キー（いずれかを選択）：

- サンドボックスを無効化：`agents.defaults.sandbox.mode=off`（またはエージェント別に `agents.list[].sandbox.mode=off`）
- サンドボックス内でツールを許可：
  - `tools.sandbox.tools.deny`（またはエージェント別の `agents.list[].tools.sandbox.tools.deny`）から削除する
  - または `tools.sandbox.tools.allow`（またはエージェント別の allow）に追加する

### 「これは main だと思っていたのに、なぜサンドボックスなのか？」

`"non-main"` モードでは、グループ／チャンネルのキーは main ではありません。main セッションキー（`sandbox explain` に表示されます）を使用するか、モードを `"off"` に切り替えてください。
