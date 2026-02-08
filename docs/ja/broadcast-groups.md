---
summary: "複数のエージェントに WhatsApp メッセージをブロードキャストします"
read_when:
  - ブロードキャストグループの設定
  - WhatsApp におけるマルチエージェント返信のデバッグ
status: experimental
title: "ブロードキャストグループ"
x-i18n:
  source_path: broadcast-groups.md
  source_hash: eaeb4035912c4941
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:42:16Z
---

# ブロードキャストグループ

**ステータス:** 実験的  
**バージョン:** 2026.1.9 で追加

## 概要

ブロードキャストグループを使用すると、複数のエージェントが同じメッセージを同時に処理して応答できます。これにより、単一の WhatsApp グループまたはダイレクトメッセージ内で連携して動作する、専門化されたエージェントチームを作成できます。いずれも 1 つの電話番号で利用できます。

現在の対象範囲: **WhatsApp のみ**（web チャンネル）。

ブロードキャストグループは、チャンネルの許可リストおよびグループ有効化ルールの後に評価されます。WhatsApp グループでは、これは OpenClaw が通常返信するタイミング（例: グループ設定に応じたメンション時）でブロードキャストが行われることを意味します。

## ユースケース

### 1. 専門化されたエージェントチーム

原子的で焦点を絞った責務を持つ複数のエージェントを展開します:

```
Group: "Development Team"
Agents:
  - CodeReviewer (reviews code snippets)
  - DocumentationBot (generates docs)
  - SecurityAuditor (checks for vulnerabilities)
  - TestGenerator (suggests test cases)
```

各エージェントが同じメッセージを処理し、それぞれの専門的な観点を提供します。

### 2. 多言語サポート

```
Group: "International Support"
Agents:
  - Agent_EN (responds in English)
  - Agent_DE (responds in German)
  - Agent_ES (responds in Spanish)
```

### 3. 品質保証ワークフロー

```
Group: "Customer Support"
Agents:
  - SupportAgent (provides answer)
  - QAAgent (reviews quality, only responds if issues found)
```

### 4. タスク自動化

```
Group: "Project Management"
Agents:
  - TaskTracker (updates task database)
  - TimeLogger (logs time spent)
  - ReportGenerator (creates summaries)
```

## 設定

### 基本セットアップ

トップレベルの `broadcast` セクション（`bindings` の隣）を追加します。キーは WhatsApp の peer id です:

- グループチャット: グループ JID（例: `120363403215116621@g.us`）
- ダイレクトメッセージ: E.164 形式の電話番号（例: `+15551234567`）

```json
{
  "broadcast": {
    "120363403215116621@g.us": ["alfred", "baerbel", "assistant3"]
  }
}
```

**結果:** OpenClaw がこのチャットで返信する場合、3 つすべてのエージェントが実行されます。

### 処理戦略

エージェントがメッセージを処理する方法を制御します:

#### 並列（デフォルト）

すべてのエージェントが同時に処理します:

```json
{
  "broadcast": {
    "strategy": "parallel",
    "120363403215116621@g.us": ["alfred", "baerbel"]
  }
}
```

#### 順次

エージェントが順番に処理します（前の完了を待ちます）:

```json
{
  "broadcast": {
    "strategy": "sequential",
    "120363403215116621@g.us": ["alfred", "baerbel"]
  }
}
```

### 完全な例

```json
{
  "agents": {
    "list": [
      {
        "id": "code-reviewer",
        "name": "Code Reviewer",
        "workspace": "/path/to/code-reviewer",
        "sandbox": { "mode": "all" }
      },
      {
        "id": "security-auditor",
        "name": "Security Auditor",
        "workspace": "/path/to/security-auditor",
        "sandbox": { "mode": "all" }
      },
      {
        "id": "docs-generator",
        "name": "Documentation Generator",
        "workspace": "/path/to/docs-generator",
        "sandbox": { "mode": "all" }
      }
    ]
  },
  "broadcast": {
    "strategy": "parallel",
    "120363403215116621@g.us": ["code-reviewer", "security-auditor", "docs-generator"],
    "120363424282127706@g.us": ["support-en", "support-de"],
    "+15555550123": ["assistant", "logger"]
  }
}
```

## 仕組み

### メッセージフロー

1. **受信メッセージ** が WhatsApp グループに到着します
2. **ブロードキャストチェック**: システムが peer ID が `broadcast` に含まれているかを確認します
3. **ブロードキャストリストに含まれる場合**:
   - 記載されているすべてのエージェントがメッセージを処理します
   - 各エージェントは独自のセッションキーと分離されたコンテキストを持ちます
   - エージェントは並列（デフォルト）または順次で処理します
4. **ブロードキャストリストに含まれない場合**:
   - 通常のルーティングが適用されます（最初に一致するバインディング）

注: ブロードキャストグループは、チャンネルの許可リストやグループ有効化ルール（メンション/コマンド等）を迂回しません。メッセージが処理対象になったときに「どのエージェントが実行されるか」だけを変更します。

### セッション分離

ブロードキャストグループ内の各エージェントは、完全に分離された以下を維持します:

- **セッションキー**（`agent:alfred:whatsapp:group:120363...` と `agent:baerbel:whatsapp:group:120363...`）
- **会話履歴**（エージェントは他のエージェントのメッセージを参照しません）
- **ワークスペース**（設定されている場合は別個のサンドボックス）
- **ツールアクセス**（異なる許可/拒否リスト）
- **メモリ/コンテキスト**（別々の IDENTITY.md、SOUL.md など）
- **グループコンテキストバッファ**（コンテキストとして使用される直近のグループメッセージ）は peer ごとに共有されるため、トリガーされたときにすべてのブロードキャストエージェントが同じコンテキストを参照します

これにより、各エージェントは次のようにできます:

- 異なる人格
- 異なるツールアクセス（例: 読み取り専用 vs 読み書き）
- 異なるモデル（例: opus vs sonnet）
- 異なる Skills をインストール

### 例: 分離されたセッション

グループ `120363403215116621@g.us` で、エージェント `["alfred", "baerbel"]` がいる場合:

**Alfred のコンテキスト:**

```
Session: agent:alfred:whatsapp:group:120363403215116621@g.us
History: [user message, alfred's previous responses]
Workspace: /Users/pascal/openclaw-alfred/
Tools: read, write, exec
```

**Bärbel のコンテキスト:**

```
Session: agent:baerbel:whatsapp:group:120363403215116621@g.us
History: [user message, baerbel's previous responses]
Workspace: /Users/pascal/openclaw-baerbel/
Tools: read only
```

## ベストプラクティス

### 1. エージェントを焦点化したままにする

各エージェントを単一で明確な責務で設計します:

```json
{
  "broadcast": {
    "DEV_GROUP": ["formatter", "linter", "tester"]
  }
}
```

✅ **良い例:** 各エージェントは 1 つの仕事を持つ  
❌ **悪い例:** 汎用的な「dev-helper」エージェント 1 つ

### 2. 分かりやすい名前を使用する

各エージェントが何をするかを明確にします:

```json
{
  "agents": {
    "security-scanner": { "name": "Security Scanner" },
    "code-formatter": { "name": "Code Formatter" },
    "test-generator": { "name": "Test Generator" }
  }
}
```

### 3. 異なるツールアクセスを設定する

エージェントに必要なツールだけを与えます:

```json
{
  "agents": {
    "reviewer": {
      "tools": { "allow": ["read", "exec"] } // Read-only
    },
    "fixer": {
      "tools": { "allow": ["read", "write", "edit", "exec"] } // Read-write
    }
  }
}
```

### 4. パフォーマンスを監視する

多数のエージェントがいる場合は、次を検討します:

- 速度のために `"strategy": "parallel"`（デフォルト）を使用する
- ブロードキャストグループを 5〜10 エージェントに制限する
- 単純なエージェントには高速なモデルを使用する

### 5. 失敗を適切に処理する

エージェントは独立して失敗します。1 つのエージェントのエラーが他をブロックすることはありません:

```
Message → [Agent A ✓, Agent B ✗ error, Agent C ✓]
Result: Agent A and C respond, Agent B logs error
```

## 互換性

### プロバイダー

ブロードキャストグループは現在、以下で動作します:

- ✅ WhatsApp（実装済み）
- 🚧 Telegram（予定）
- 🚧 Discord（予定）
- 🚧 Slack（予定）

### ルーティング

ブロードキャストグループは既存のルーティングと併用できます:

```json
{
  "bindings": [
    {
      "match": { "channel": "whatsapp", "peer": { "kind": "group", "id": "GROUP_A" } },
      "agentId": "alfred"
    }
  ],
  "broadcast": {
    "GROUP_B": ["agent1", "agent2"]
  }
}
```

- `GROUP_A`: alfred のみが応答します（通常のルーティング）
- `GROUP_B`: agent1 と agent2 の両方が応答します（ブロードキャスト）

**優先順位:** `broadcast` は `bindings` より優先されます。

## トラブルシューティング

### エージェントが応答しない

**確認:**

1. エージェント ID が `agents.list` に存在する
2. peer ID の形式が正しい（例: `120363403215116621@g.us`）
3. エージェントが拒否リストに入っていない

**デバッグ:**

```bash
tail -f ~/.openclaw/logs/gateway.log | grep broadcast
```

### 1 つのエージェントだけが応答する

**原因:** peer ID が `bindings` にはあるが、`broadcast` にはない可能性があります。

**対処:** ブロードキャスト設定に追加するか、バインディングから削除します。

### パフォーマンスの問題

**多数のエージェントで遅い場合:**

- グループあたりのエージェント数を減らす
- 軽量なモデルを使用する（opus の代わりに sonnet）
- サンドボックスの起動時間を確認する

## 例

### 例 1: コードレビューチーム

```json
{
  "broadcast": {
    "strategy": "parallel",
    "120363403215116621@g.us": [
      "code-formatter",
      "security-scanner",
      "test-coverage",
      "docs-checker"
    ]
  },
  "agents": {
    "list": [
      {
        "id": "code-formatter",
        "workspace": "~/agents/formatter",
        "tools": { "allow": ["read", "write"] }
      },
      {
        "id": "security-scanner",
        "workspace": "~/agents/security",
        "tools": { "allow": ["read", "exec"] }
      },
      {
        "id": "test-coverage",
        "workspace": "~/agents/testing",
        "tools": { "allow": ["read", "exec"] }
      },
      { "id": "docs-checker", "workspace": "~/agents/docs", "tools": { "allow": ["read"] } }
    ]
  }
}
```

**ユーザーが送信:** コードスニペット  
**応答:**

- code-formatter: 「インデントを修正し、型ヒントを追加しました」
- security-scanner: 「⚠️ 12 行目に SQL インジェクションの脆弱性があります」
- test-coverage: 「カバレッジは 45% で、エラーケースのテストが不足しています」
- docs-checker: 「関数 `process_data` の docstring がありません」

### 例 2: 多言語サポート

```json
{
  "broadcast": {
    "strategy": "sequential",
    "+15555550123": ["detect-language", "translator-en", "translator-de"]
  },
  "agents": {
    "list": [
      { "id": "detect-language", "workspace": "~/agents/lang-detect" },
      { "id": "translator-en", "workspace": "~/agents/translate-en" },
      { "id": "translator-de", "workspace": "~/agents/translate-de" }
    ]
  }
}
```

## API リファレンス

### 設定スキーマ

```typescript
interface OpenClawConfig {
  broadcast?: {
    strategy?: "parallel" | "sequential";
    [peerId: string]: string[];
  };
}
```

### フィールド

- `strategy`（任意）: エージェントの処理方法
  - `"parallel"`（デフォルト）: すべてのエージェントが同時に処理します
  - `"sequential"`: エージェントは配列の順序で処理します
- `[peerId]`: WhatsApp グループ JID、E.164 番号、または他の peer ID
  - 値: メッセージを処理すべきエージェント ID の配列

## 制限事項

1. **最大エージェント数:** 厳密な上限はありませんが、10 以上のエージェントは遅くなる可能性があります
2. **共有コンテキスト:** エージェント同士は互いの応答を参照しません（設計による）
3. **メッセージ順序:** 並列応答は任意の順序で到着する可能性があります
4. **レート制限:** すべてのエージェントが WhatsApp のレート制限にカウントされます

## 今後の拡張

予定されている機能:

- [ ] 共有コンテキストモード（エージェントが互いの応答を参照する）
- [ ] エージェント協調（エージェント同士がシグナルを送れる）
- [ ] 動的なエージェント選択（メッセージ内容に基づいてエージェントを選択する）
- [ ] エージェントの優先順位（特定のエージェントが他より先に応答する）

## 関連項目

- [マルチエージェント設定](/multi-agent-sandbox-tools)
- [ルーティング設定](/concepts/channel-routing)
- [セッション管理](/concepts/sessions)
