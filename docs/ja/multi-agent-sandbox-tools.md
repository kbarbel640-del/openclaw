---
summary: "エージェントごとのサンドボックス + ツール制限、優先順位、例"
title: マルチエージェント サンドボックス & ツール
read_when: "マルチエージェント Gateway（ゲートウェイ）で、エージェントごとのサンドボックス化やエージェントごとのツール許可／拒否ポリシーが必要な場合。"
status: active
x-i18n:
  source_path: multi-agent-sandbox-tools.md
  source_hash: f602cb6192b84b40
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:16Z
---

# マルチエージェント サンドボックス & ツール設定

## 概要

マルチエージェント構成では、各エージェントがそれぞれ以下を持てます。

- **サンドボックス設定**（`agents.list[].sandbox` が `agents.defaults.sandbox` を上書き）
- **ツール制限**（`tools.allow` / `tools.deny`、および `agents.list[].tools`）

これにより、異なるセキュリティプロファイルを持つ複数のエージェントを実行できます。

- フルアクセスの個人用アシスタント
- ツールを制限した家族／業務用エージェント
- サンドボックス内で動作する公開向けエージェント

`setupCommand` は `sandbox.docker`（グローバルまたはエージェントごと）の配下に配置され、コンテナ作成時に一度だけ実行されます。

認証はエージェントごとです。各エージェントは、以下にある自身専用の `agentDir` 認証ストアを読み込みます。

```
~/.openclaw/agents/<agentId>/agent/auth-profiles.json
```

資格情報はエージェント間で**共有されません**。`agentDir` をエージェント間で再利用しないでください。
資格情報を共有したい場合は、`auth-profiles.json` を他のエージェントの `agentDir` にコピーしてください。

実行時におけるサンドボックス化の挙動については [Sandboxing](/gateway/sandboxing) を参照してください。
「なぜブロックされているのか」をデバッグするには、[Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated) および `openclaw sandbox explain` を参照してください。

---

## 設定例

### 例 1: 個人用 + 制限付きファミリーエージェント

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

- `main` エージェント: ホスト上で実行、すべてのツールにアクセス可能
- `family` エージェント: Docker で実行（エージェントごとに 1 コンテナ）、`read` ツールのみ使用可能

---

### 例 2: サンドボックスを共有する業務用エージェント

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

### 例 2b: グローバルなコーディングプロファイル + メッセージング専用エージェント

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

- デフォルトのエージェントはコーディングツールを利用可能
- `support` エージェントはメッセージング専用（+ Slack ツール）

---

### 例 3: エージェントごとに異なるサンドボックスモード

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

- `agents.list[].sandbox.{docker,browser,prune}.*` は、そのエージェントに対して `agents.defaults.sandbox.{docker,browser,prune}.*` を上書きします（サンドボックスのスコープが `"shared"` に解決される場合は無視されます）。

### ツール制限

フィルタリングの順序は次のとおりです。

1. **ツールプロファイル**（`tools.profile` または `agents.list[].tools.profile`）
2. **プロバイダーツールプロファイル**（`tools.byProvider[provider].profile` または `agents.list[].tools.byProvider[provider].profile`）
3. **グローバルツールポリシー**（`tools.allow` / `tools.deny`）
4. **プロバイダーツールポリシー**（`tools.byProvider[provider].allow/deny`）
5. **エージェント固有ツールポリシー**（`agents.list[].tools.allow/deny`）
6. **エージェントのプロバイダーポリシー**（`agents.list[].tools.byProvider[provider].allow/deny`）
7. **サンドボックスのツールポリシー**（`tools.sandbox.tools` または `agents.list[].tools.sandbox.tools`）
8. **サブエージェントのツールポリシー**（該当する場合は `tools.subagents.tools`）

各レベルでは、さらにツールを制限することはできますが、以前のレベルで拒否されたツールを再度許可することはできません。
`agents.list[].tools.sandbox.tools` が設定されている場合、そのエージェントでは `tools.sandbox.tools` を置き換えます。
`agents.list[].tools.profile` が設定されている場合、そのエージェントでは `tools.profile` を上書きします。
プロバイダーツールキーは、`provider`（例: `google-antigravity`）または `provider/model`（例: `openai/gpt-5.2`）のいずれも受け付けます。

### ツールグループ（ショートハンド）

ツールポリシー（グローバル、エージェント、サンドボックス）では、複数の具体的なツールに展開される `group:*` エントリをサポートします。

- `group:runtime`: `exec`, `bash`, `process`
- `group:fs`: `read`, `write`, `edit`, `apply_patch`
- `group:sessions`: `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`, `session_status`
- `group:memory`: `memory_search`, `memory_get`
- `group:ui`: `browser`, `canvas`
- `group:automation`: `cron`, `gateway`
- `group:messaging`: `message`
- `group:nodes`: `nodes`
- `group:openclaw`: すべての組み込み OpenClaw ツール（プロバイダープラグインは除外）

### Elevated モード

`tools.elevated` はグローバルなベースライン（送信者ベースの許可リスト）です。`agents.list[].tools.elevated` により、特定のエージェントについて Elevated をさらに制限できます（両方で許可されている必要があります）。

緩和パターン:

- 信頼できないエージェント（`agents.list[].tools.deny: ["exec"]`）に対して `exec` を拒否する
- 制限されたエージェントにルーティングされる送信者を許可リストに入れない
- サンドボックス化された実行のみを行いたい場合は、Elevated をグローバルで無効化する（`tools.elevated.enabled: false`）
- 機密性の高いプロファイルでは、エージェントごとに Elevated を無効化する（`agents.list[].tools.elevated.enabled: false`）

---

## シングルエージェントからの移行

**変更前（シングルエージェント）:**

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

**変更後（異なるプロファイルを持つマルチエージェント）:**

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

レガシーの `agent.*` 設定は `openclaw doctor` によって移行されますが、今後は `agents.defaults` + `agents.list` の使用を推奨します。

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

`agents.defaults.sandbox.mode: "non-main"` は、エージェント ID ではなく `session.mainKey`（デフォルトは `"main"`）に基づいています。
グループ／チャンネルのセッションは常に独自のキーを持つため、non-main として扱われ、サンドボックス化されます。
エージェントを常にサンドボックス化しないようにしたい場合は、`agents.list[].sandbox.mode: "off"` を設定してください。

---

## テスト

マルチエージェントのサンドボックスおよびツールを設定した後は、以下を実施してください。

1. **エージェント解決の確認:**

   ```exec
   openclaw agents list --bindings
   ```

2. **サンドボックスコンテナの確認:**

   ```exec
   docker ps --filter "name=openclaw-sbx-"
   ```

3. **ツール制限のテスト:**
   - 制限されたツールを必要とするメッセージを送信する
   - エージェントが拒否されたツールを使用できないことを確認する

4. **ログの監視:**
   ```exec
   tail -f "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}/logs/gateway.log" | grep -E "routing|sandbox|tools"
   ```

---

## トラブルシューティング

### `mode: "all"` を設定しているのにエージェントがサンドボックス化されない

- 上書きしているグローバルの `agents.defaults.sandbox.mode` がないか確認してください
- エージェント固有の設定が優先されるため、`agents.list[].sandbox.mode: "all"` を設定してください

### deny リストがあるのにツールが利用できてしまう

- ツールのフィルタリング順序（グローバル → エージェント → サンドボックス → サブエージェント）を確認してください
- 各レベルでは制限のみ可能で、再付与はできません
- ログで確認してください: `[tools] filtering tools for agent:${agentId}`

### エージェントごとにコンテナが分離されていない

- エージェント固有のサンドボックス設定で `scope: "agent"` を設定してください
- デフォルトは `"session"` で、セッションごとに 1 コンテナが作成されます

---

## 関連項目

- [Multi-Agent Routing](/concepts/multi-agent)
- [Sandbox Configuration](/gateway/configuration#agentsdefaults-sandbox)
- [Session Management](/concepts/session)
