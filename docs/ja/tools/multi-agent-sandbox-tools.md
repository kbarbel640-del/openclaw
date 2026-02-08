---
summary: "エージェントごとのサンドボックス + ツール制限、優先順位、例"
title: マルチエージェント サンドボックス & ツール
read_when: "マルチエージェント ゲートウェイで、エージェントごとのサンドボックス化やツールの許可／拒否ポリシーが必要な場合。"
status: active
x-i18n:
  source_path: tools/multi-agent-sandbox-tools.md
  source_hash: 78364bcf0612a5e7
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:14:57Z
---

# マルチエージェント サンドボックス & ツール 設定

## 概要

マルチエージェント構成では、各エージェントが次を個別に持てます。

- **サンドボックス設定**（`agents.list[].sandbox` が `agents.defaults.sandbox` を上書き）
- **ツール制限**（`tools.allow` / `tools.deny`、および `agents.list[].tools`）

これにより、異なるセキュリティ プロファイルで複数のエージェントを実行できます。

- フル アクセスのパーソナル アシスタント
- 制限付きツールの家族／仕事用エージェント
- サンドボックス内の公開向けエージェント

`setupCommand` は `sandbox.docker`（グローバルまたはエージェント単位）の配下に置かれ、コンテナ作成時に一度だけ実行されます。

認証はエージェント単位です。各エージェントは次の場所にある自身の `agentDir` 認証ストアから読み取ります。

```
~/.openclaw/agents/<agentId>/agent/auth-profiles.json
```

資格情報はエージェント間で**共有されません**。エージェント間で `agentDir` を再利用しないでください。
資格情報を共有したい場合は、`auth-profiles.json` を別のエージェントの `agentDir` にコピーしてください。

実行時のサンドボックスの挙動については [Sandboxing](/gateway/sandboxing) を参照してください。
「なぜブロックされているのか？」のデバッグについては [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated) と `openclaw sandbox explain` を参照してください。

---

## 設定例

### 例 1: パーソナル + 制限付きファミリー エージェント

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "default": true,
        "name": "Personal Assistant",
        "workspace": "~/.openclaw/workspace",
        "sandbox": { "mode": "off" }
      },
      {
        "id": "family",
        "name": "Family Bot",
        "workspace": "~/.openclaw/workspace-family",
        "sandbox": {
          "mode": "all",
          "scope": "agent"
        },
        "tools": {
          "allow": ["read"],
          "deny": ["exec", "write", "edit", "apply_patch", "process", "browser"]
        }
      }
    ]
  },
  "bindings": [
    {
      "agentId": "family",
      "match": {
        "provider": "whatsapp",
        "accountId": "*",
        "peer": {
          "kind": "group",
          "id": "120363424282127706@g.us"
        }
      }
    }
  ]
}
```

**結果:**

- `main` エージェント: ホスト上で実行、フル ツール アクセス
- `family` エージェント: Docker で実行（エージェントごとに 1 コンテナ）、`read` ツールのみ

---

### 例 2: 共有サンドボックスのワーク エージェント

```json
{
  "agents": {
    "list": [
      {
        "id": "personal",
        "workspace": "~/.openclaw/workspace-personal",
        "sandbox": { "mode": "off" }
      },
      {
        "id": "work",
        "workspace": "~/.openclaw/workspace-work",
        "sandbox": {
          "mode": "all",
          "scope": "shared",
          "workspaceRoot": "/tmp/work-sandboxes"
        },
        "tools": {
          "allow": ["read", "write", "apply_patch", "exec"],
          "deny": ["browser", "gateway", "discord"]
        }
      }
    ]
  }
}
```

---

### 例 2b: グローバルなコーディング プロファイル + メッセージング専用エージェント

```json
{
  "tools": { "profile": "coding" },
  "agents": {
    "list": [
      {
        "id": "support",
        "tools": { "profile": "messaging", "allow": ["slack"] }
      }
    ]
  }
}
```

**結果:**

- デフォルト エージェントはコーディング ツールを利用可能
- `support` エージェントはメッセージング専用（+ Slack ツール）

---

### 例 3: エージェントごとに異なるサンドボックス モード

```json
{
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "non-main", // Global default
        "scope": "session"
      }
    },
    "list": [
      {
        "id": "main",
        "workspace": "~/.openclaw/workspace",
        "sandbox": {
          "mode": "off" // Override: main never sandboxed
        }
      },
      {
        "id": "public",
        "workspace": "~/.openclaw/workspace-public",
        "sandbox": {
          "mode": "all", // Override: public always sandboxed
          "scope": "agent"
        },
        "tools": {
          "allow": ["read"],
          "deny": ["exec", "write", "edit", "apply_patch"]
        }
      }
    ]
  }
}
```

---

## 設定の優先順位

グローバル（`agents.defaults.*`）とエージェント固有（`agents.list[].*`）の設定が両方存在する場合:

### サンドボックス設定

エージェント固有の設定がグローバルを上書きします。

```
agents.list[].sandbox.mode > agents.defaults.sandbox.mode
agents.list[].sandbox.scope > agents.defaults.sandbox.scope
agents.list[].sandbox.workspaceRoot > agents.defaults.sandbox.workspaceRoot
agents.list[].sandbox.workspaceAccess > agents.defaults.sandbox.workspaceAccess
agents.list[].sandbox.docker.* > agents.defaults.sandbox.docker.*
agents.list[].sandbox.browser.* > agents.defaults.sandbox.browser.*
agents.list[].sandbox.prune.* > agents.defaults.sandbox.prune.*
```

**注記:**

- そのエージェントに対して `agents.list[].sandbox.{docker,browser,prune}.*` が `agents.defaults.sandbox.{docker,browser,prune}.*` を上書きします（サンドボックスのスコープが `"shared"` に解決される場合は無視されます）。

### ツール制限

フィルタリング順は次のとおりです。

1. **ツール プロファイル**（`tools.profile` または `agents.list[].tools.profile`）
2. **プロバイダー ツール プロファイル**（`tools.byProvider[provider].profile` または `agents.list[].tools.byProvider[provider].profile`）
3. **グローバル ツール ポリシー**（`tools.allow` / `tools.deny`）
4. **プロバイダー ツール ポリシー**（`tools.byProvider[provider].allow/deny`）
5. **エージェント固有 ツール ポリシー**（`agents.list[].tools.allow/deny`）
6. **エージェント プロバイダー ポリシー**（`agents.list[].tools.byProvider[provider].allow/deny`）
7. **サンドボックス ツール ポリシー**（`tools.sandbox.tools` または `agents.list[].tools.sandbox.tools`）
8. **サブエージェント ツール ポリシー**（該当する場合は `tools.subagents.tools`）

各レベルはツールをさらに制限できますが、前段で拒否されたツールを復活させることはできません。
`agents.list[].tools.sandbox.tools` が設定されている場合、そのエージェントでは `tools.sandbox.tools` を置き換えます。
`agents.list[].tools.profile` が設定されている場合、そのエージェントでは `tools.profile` を上書きします。
プロバイダー ツールのキーは、`provider`（例: `google-antigravity`）または `provider/model`（例: `openai/gpt-5.2`）のいずれかを受け付けます。

### ツール グループ（ショートハンド）

ツール ポリシー（グローバル、エージェント、サンドボックス）は、複数の具体的なツールに展開される `group:*` エントリをサポートします。

- `group:runtime`: `exec`, `bash`, `process`
- `group:fs`: `read`, `write`, `edit`, `apply_patch`
- `group:sessions`: `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`, `session_status`
- `group:memory`: `memory_search`, `memory_get`
- `group:ui`: `browser`, `canvas`
- `group:automation`: `cron`, `gateway`
- `group:messaging`: `message`
- `group:nodes`: `nodes`
- `group:openclaw`: 組み込みの OpenClaw ツールすべて（プロバイダー プラグインは除外）

### Elevated モード

`tools.elevated` はグローバルのベースライン（送信者ベースの許可リスト）です。`agents.list[].tools.elevated` は特定のエージェントに対して Elevated をさらに制限できます（両方が許可する必要があります）。

緩和パターン:

- 信頼されていないエージェント（`agents.list[].tools.deny: ["exec"]`）に対して `exec` を拒否
- 制限付きエージェントにルーティングする送信者を許可リストに追加しない
- サンドボックス実行のみを望む場合は、グローバルで Elevated を無効化（`tools.elevated.enabled: false`）
- 機密プロファイルでは、エージェント単位で Elevated を無効化（`agents.list[].tools.elevated.enabled: false`）

---

## 単一エージェントからの移行

**Before（単一エージェント）:**

```json
{
  "agents": {
    "defaults": {
      "workspace": "~/.openclaw/workspace",
      "sandbox": {
        "mode": "non-main"
      }
    }
  },
  "tools": {
    "sandbox": {
      "tools": {
        "allow": ["read", "write", "apply_patch", "exec"],
        "deny": []
      }
    }
  }
}
```

**After（異なるプロファイルを持つマルチエージェント）:**

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "default": true,
        "workspace": "~/.openclaw/workspace",
        "sandbox": { "mode": "off" }
      }
    ]
  }
}
```

レガシーの `agent.*` 設定は `openclaw doctor` により移行されます。今後は `agents.defaults` + `agents.list` を推奨します。

---

## ツール制限の例

### 読み取り専用エージェント

```json
{
  "tools": {
    "allow": ["read"],
    "deny": ["exec", "write", "edit", "apply_patch", "process"]
  }
}
```

### 安全実行エージェント（ファイル変更なし）

```json
{
  "tools": {
    "allow": ["read", "exec", "process"],
    "deny": ["write", "edit", "apply_patch", "browser", "gateway"]
  }
}
```

### 通信専用エージェント

```json
{
  "tools": {
    "allow": ["sessions_list", "sessions_send", "sessions_history", "session_status"],
    "deny": ["exec", "write", "edit", "apply_patch", "read", "browser"]
  }
}
```

---

## よくある落とし穴: 「non-main」

`agents.defaults.sandbox.mode: "non-main"` はエージェント ID ではなく、`session.mainKey`（デフォルトは `"main"`）に基づきます。
グループ／チャンネル セッションは常に独自のキーを持つため、non-main として扱われ、サンドボックス化されます。
エージェントを決してサンドボックス化したくない場合は、`agents.list[].sandbox.mode: "off"` を設定してください。

---

## テスト

マルチエージェントのサンドボックスとツールを設定した後:

1. **エージェント解決の確認:**

   ```exec
   openclaw agents list --bindings
   ```

2. **サンドボックス コンテナの確認:**

   ```exec
   docker ps --filter "name=openclaw-sbx-"
   ```

3. **ツール制限のテスト:**
   - 制限されたツールを必要とするメッセージを送信
   - 拒否されたツールをエージェントが使用できないことを確認

4. **ログの監視:**

   ```exec
   tail -f "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}/logs/gateway.log" | grep -E "routing|sandbox|tools"
   ```

---

## トラブルシューティング

### `mode: "all"` にもかかわらずエージェントがサンドボックス化されない

- 上書きするグローバルな `agents.defaults.sandbox.mode` がないか確認
- エージェント固有の設定が優先されるため、`agents.list[].sandbox.mode: "all"` を設定

### 拒否リストがあるのにツールが利用可能

- ツール フィルタリング順を確認: グローバル → エージェント → サンドボックス → サブエージェント
- 各レベルは制限のみ可能で、復活は不可
- ログで検証: `[tools] filtering tools for agent:${agentId}`

### エージェントごとにコンテナが分離されない

- エージェント固有のサンドボックス設定で `scope: "agent"` を設定
- デフォルトは `"session"` で、セッションごとに 1 コンテナを作成

---

## 参照

- [Multi-Agent Routing](/concepts/multi-agent)
- [Sandbox Configuration](/gateway/configuration#agentsdefaults-sandbox)
- [Session Management](/concepts/session)
