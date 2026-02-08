---
summary: "マルチエージェントルーティング: 分離されたエージェント、チャンネルアカウント、およびバインディング"
title: マルチエージェントルーティング
read_when: "1 つの Gateway（ゲートウェイ）プロセス内で、複数の分離されたエージェント（ワークスペース + 認証）を使いたい場合。"
status: active
x-i18n:
  source_path: concepts/multi-agent.md
  source_hash: 49b3ba55d8a7f0b3
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:06:39Z
---

# マルチエージェントルーティング

目標: 1 つの稼働中の Gateway（ゲートウェイ）で、複数の _分離された_ エージェント（別々のワークスペース + `agentDir` + セッション）に加え、複数のチャンネルアカウント（例: 2 つの WhatsApp）を扱います。インバウンドは、バインディングによってエージェントへルーティングされます。

## 「1 つのエージェント」とは？

**エージェント**は、次をそれぞれ個別に持つ、完全にスコープされた 1 つの「頭脳」です。

- **ワークスペース**（ファイル、AGENTS.md/SOUL.md/USER.md、ローカルノート、ペルソナルール）。
- **State ディレクトリ**（`agentDir`）: 認証プロファイル、モデルレジストリ、エージェントごとの設定。
- **セッションストア**（チャット履歴 + ルーティング状態）: `~/.openclaw/agents/<agentId>/sessions` 配下。

認証プロファイルは **エージェントごと** です。各エージェントは、次の自身のものから読み取ります:

```
~/.openclaw/agents/<agentId>/agent/auth-profiles.json
```

メインエージェントの認証情報は、自動的には共有されません。エージェント間で `agentDir` を決して再利用しないでください（認証/セッション衝突の原因になります）。認証情報を共有したい場合は、`auth-profiles.json` を別のエージェントの `agentDir` にコピーしてください。

Skills は、各ワークスペースの `skills/` フォルダー経由でエージェントごとに適用され、共有 Skills は `~/.openclaw/skills` から利用できます。[Skills: per-agent vs shared](/tools/skills#per-agent-vs-shared-skills) を参照してください。

Gateway（ゲートウェイ）は **1 つのエージェント**（デフォルト）または **複数のエージェント** を並列にホストできます。

**ワークスペース注記:** 各エージェントのワークスペースは、厳格なサンドボックスではなく **デフォルトの cwd** です。相対パスはワークスペース内で解決されますが、サンドボックス化が有効でない限り、絶対パスは他のホスト上の場所に到達し得ます。[Sandboxing](/gateway/sandboxing) を参照してください。

## パス（クイックマップ）

- Config: `~/.openclaw/openclaw.json`（または `OPENCLAW_CONFIG_PATH`）
- State dir: `~/.openclaw`（または `OPENCLAW_STATE_DIR`）
- Workspace: `~/.openclaw/workspace`（または `~/.openclaw/workspace-<agentId>`）
- Agent dir: `~/.openclaw/agents/<agentId>/agent`（または `agents.list[].agentDir`）
- Sessions: `~/.openclaw/agents/<agentId>/sessions`

### シングルエージェントモード（デフォルト）

何もしない場合、OpenClaw は単一エージェントを実行します:

- `agentId` はデフォルトで **`main`** です。
- セッションは `agent:main:<mainKey>` としてキー付けされます。
- ワークスペースはデフォルトで `~/.openclaw/workspace`（または `OPENCLAW_PROFILE` が設定されている場合は `~/.openclaw/workspace-<profile>`）です。
- State はデフォルトで `~/.openclaw/agents/main/agent` です。

## エージェントヘルパー

エージェントウィザードを使用して、新しい分離エージェントを追加します:

```bash
openclaw agents add work
```

次に、インバウンドメッセージをルーティングするために `bindings` を追加します（またはウィザードに任せます）。

次で検証します:

```bash
openclaw agents list --bindings
```

## 複数エージェント = 複数人、複数人格

**複数エージェント** では、各 `agentId` が **完全に分離されたペルソナ** になります:

- **異なる電話番号/アカウント**（チャンネル `accountId` ごと）。
- **異なる人格**（エージェントごとのワークスペースファイル。例: `AGENTS.md` や `SOUL.md`）。
- **分離された認証 + セッション**（明示的に有効化しない限り、相互干渉なし）。

これにより、複数人が 1 台の Gateway（ゲートウェイ）サーバーを共有しつつ、AI の「頭脳」とデータを分離したまま利用できます。

## 1 つの WhatsApp 番号、複数人（DM 分割）

**1 つの WhatsApp アカウント** のまま、**異なる WhatsApp ダイレクトメッセージ** を別々のエージェントへルーティングできます。送信者の E.164（`+15551234567` のような）で `peer.kind: "dm"` を用いてマッチします。返信は同じ WhatsApp 番号から送られ続けます（エージェントごとの送信者アイデンティティはありません）。

重要な詳細: 直接チャットはエージェントの **メインセッションキー** に集約されるため、真の分離には **1 人につき 1 エージェント** が必要です。

例:

```json5
{
  agents: {
    list: [
      { id: "alex", workspace: "~/.openclaw/workspace-alex" },
      { id: "mia", workspace: "~/.openclaw/workspace-mia" },
    ],
  },
  bindings: [
    { agentId: "alex", match: { channel: "whatsapp", peer: { kind: "dm", id: "+15551230001" } } },
    { agentId: "mia", match: { channel: "whatsapp", peer: { kind: "dm", id: "+15551230002" } } },
  ],
  channels: {
    whatsapp: {
      dmPolicy: "allowlist",
      allowFrom: ["+15551230001", "+15551230002"],
    },
  },
}
```

注記:

- DM のアクセス制御は、エージェントごとではなく **WhatsApp アカウントごとのグローバル**（ペアリング/許可リスト）です。
- 共有グループの場合は、グループを 1 つのエージェントにバインドするか、[Broadcast groups](/broadcast-groups) を使用してください。

## ルーティングルール（メッセージがエージェントを選ぶ仕組み）

バインディングは **決定的** で、**最も具体的なものが優先** されます:

1. `peer` マッチ（厳密な DM/グループ/チャンネル id）
2. `guildId`（Discord）
3. `teamId`（Slack）
4. あるチャンネルに対する `accountId` マッチ
5. チャンネルレベルのマッチ（`accountId: "*"`）
6. デフォルトエージェントへのフォールバック（`agents.list[].default`、それ以外はリストの先頭、デフォルト: `main`）

## 複数アカウント / 複数電話番号

**複数アカウント**（例: WhatsApp）をサポートするチャンネルは、各ログインを識別するために `accountId` を使用します。各 `accountId` は別のエージェントへルーティングできるため、1 台のサーバーで複数の電話番号を、セッションを混在させずにホストできます。

## 概念

- `agentId`: 1 つの「頭脳」（ワークスペース、エージェントごとの認証、エージェントごとのセッションストア）。
- `accountId`: 1 つのチャンネルアカウントインスタンス（例: WhatsApp アカウント `"personal"` と `"biz"`）。
- `binding`: `(channel, accountId, peer)` および任意で guild/team id により、インバウンドメッセージを `agentId` へルーティングします。
- 直接チャットは `agent:<agentId>:<mainKey>`（エージェントごとの「メイン」; `session.mainKey`）に集約されます。

## 例: 2 つの WhatsApp → 2 つのエージェント

`~/.openclaw/openclaw.json`（JSON5）:

```js
{
  agents: {
    list: [
      {
        id: "home",
        default: true,
        name: "Home",
        workspace: "~/.openclaw/workspace-home",
        agentDir: "~/.openclaw/agents/home/agent",
      },
      {
        id: "work",
        name: "Work",
        workspace: "~/.openclaw/workspace-work",
        agentDir: "~/.openclaw/agents/work/agent",
      },
    ],
  },

  // Deterministic routing: first match wins (most-specific first).
  bindings: [
    { agentId: "home", match: { channel: "whatsapp", accountId: "personal" } },
    { agentId: "work", match: { channel: "whatsapp", accountId: "biz" } },

    // Optional per-peer override (example: send a specific group to work agent).
    {
      agentId: "work",
      match: {
        channel: "whatsapp",
        accountId: "personal",
        peer: { kind: "group", id: "1203630...@g.us" },
      },
    },
  ],

  // Off by default: agent-to-agent messaging must be explicitly enabled + allowlisted.
  tools: {
    agentToAgent: {
      enabled: false,
      allow: ["home", "work"],
    },
  },

  channels: {
    whatsapp: {
      accounts: {
        personal: {
          // Optional override. Default: ~/.openclaw/credentials/whatsapp/personal
          // authDir: "~/.openclaw/credentials/whatsapp/personal",
        },
        biz: {
          // Optional override. Default: ~/.openclaw/credentials/whatsapp/biz
          // authDir: "~/.openclaw/credentials/whatsapp/biz",
        },
      },
    },
  },
}
```

## 例: WhatsApp の日次チャット + Telegram の深い作業

チャンネルで分割します: WhatsApp は素早い日常用エージェントに、Telegram は Opus エージェントにルーティングします。

```json5
{
  agents: {
    list: [
      {
        id: "chat",
        name: "Everyday",
        workspace: "~/.openclaw/workspace-chat",
        model: "anthropic/claude-sonnet-4-5",
      },
      {
        id: "opus",
        name: "Deep Work",
        workspace: "~/.openclaw/workspace-opus",
        model: "anthropic/claude-opus-4-6",
      },
    ],
  },
  bindings: [
    { agentId: "chat", match: { channel: "whatsapp" } },
    { agentId: "opus", match: { channel: "telegram" } },
  ],
}
```

注記:

- チャンネルに複数アカウントがある場合は、バインディングに `accountId` を追加してください（例: `{ channel: "whatsapp", accountId: "personal" }`）。
- 1 つの DM/グループだけを Opus にルーティングし、それ以外をチャットに保持したい場合は、その相手に対して `match.peer` バインディングを追加してください。相手マッチは常にチャンネル全体のルールに優先します。

## 例: 同じチャンネルで、1 つの相手を Opus に

WhatsApp は高速エージェントのままにしつつ、1 つの DM だけを Opus にルーティングします:

```json5
{
  agents: {
    list: [
      {
        id: "chat",
        name: "Everyday",
        workspace: "~/.openclaw/workspace-chat",
        model: "anthropic/claude-sonnet-4-5",
      },
      {
        id: "opus",
        name: "Deep Work",
        workspace: "~/.openclaw/workspace-opus",
        model: "anthropic/claude-opus-4-6",
      },
    ],
  },
  bindings: [
    { agentId: "opus", match: { channel: "whatsapp", peer: { kind: "dm", id: "+15551234567" } } },
    { agentId: "chat", match: { channel: "whatsapp" } },
  ],
}
```

相手バインディングは常に優先されるため、チャンネル全体のルールより上に置いてください。

## WhatsApp グループにバインドされたファミリーエージェント

@mention によるゲーティングと、より厳格なツールポリシーを備えた専用ファミリーエージェントを、単一の WhatsApp グループにバインドします:

```json5
{
  agents: {
    list: [
      {
        id: "family",
        name: "Family",
        workspace: "~/.openclaw/workspace-family",
        identity: { name: "Family Bot" },
        groupChat: {
          mentionPatterns: ["@family", "@familybot", "@Family Bot"],
        },
        sandbox: {
          mode: "all",
          scope: "agent",
        },
        tools: {
          allow: [
            "exec",
            "read",
            "sessions_list",
            "sessions_history",
            "sessions_send",
            "sessions_spawn",
            "session_status",
          ],
          deny: ["write", "edit", "apply_patch", "browser", "canvas", "nodes", "cron"],
        },
      },
    ],
  },
  bindings: [
    {
      agentId: "family",
      match: {
        channel: "whatsapp",
        peer: { kind: "group", id: "120363999999999999@g.us" },
      },
    },
  ],
}
```

注記:

- ツールの許可/拒否リストは、skills ではなく **ツール** です。ある skill がバイナリを実行する必要がある場合は、`exec` が許可されており、かつそのバイナリがサンドボックス内に存在することを確認してください。
- より厳格なゲーティングのために、`agents.list[].groupChat.mentionPatterns` を設定し、チャンネルのグループ許可リストを有効のままにしてください。

## エージェントごとのサンドボックスとツール設定

v2026.1.6 以降、各エージェントは自身のサンドボックスおよびツール制限を持てます:

```js
{
  agents: {
    list: [
      {
        id: "personal",
        workspace: "~/.openclaw/workspace-personal",
        sandbox: {
          mode: "off",  // No sandbox for personal agent
        },
        // No tool restrictions - all tools available
      },
      {
        id: "family",
        workspace: "~/.openclaw/workspace-family",
        sandbox: {
          mode: "all",     // Always sandboxed
          scope: "agent",  // One container per agent
          docker: {
            // Optional one-time setup after container creation
            setupCommand: "apt-get update && apt-get install -y git curl",
          },
        },
        tools: {
          allow: ["read"],                    // Only read tool
          deny: ["exec", "write", "edit", "apply_patch"],    // Deny others
        },
      },
    ],
  },
}
```

注記: `setupCommand` は `sandbox.docker` 配下にあり、コンテナー作成時に 1 回実行されます。解決されたスコープが `"shared"` の場合、エージェントごとの `sandbox.docker.*` オーバーライドは無視されます。

**利点:**

- **セキュリティ分離**: 信頼できないエージェント向けにツールを制限できます
- **リソース制御**: 一部のエージェントをサンドボックス化しつつ、他はホスト上のままにできます
- **柔軟なポリシー**: エージェントごとに異なる権限を設定できます

注記: `tools.elevated` は **グローバル** で送信者ベースであり、エージェントごとには設定できません。エージェントごとの境界が必要な場合は、`agents.list[].tools` を使用して `exec` を拒否してください。グループのターゲティングには `agents.list[].groupChat.mentionPatterns` を使用し、@mentions が意図したエージェントへきれいにマップされるようにしてください。

詳細な例については、[Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools) を参照してください。
