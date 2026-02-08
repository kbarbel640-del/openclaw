---
summary: "リファクタリング計画: exec ホストのルーティング、ノード承認、ヘッドレスランナー"
read_when:
  - exec ホストのルーティングや exec 承認を設計する場合
  - ノードランナー + UI IPC を実装する場合
  - exec ホストのセキュリティモードやスラッシュコマンドを追加する場合
title: "Exec ホストのリファクタリング"
x-i18n:
  source_path: refactor/exec-host.md
  source_hash: 53a9059cbeb1f3f1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:02Z
---

# Exec ホストのリファクタリング計画

## Goals

- **sandbox**、**gateway**、**node** 間で実行をルーティングするために `exec.host` + `exec.security` を追加します。
- デフォルトを **安全** に保ちます。明示的に有効化されない限り、ホスト間実行は行いません。
- 実行を **ヘッドレスランナーサービス** に分離し、ローカル IPC を介した任意の UI（macOS アプリ）を提供します。
- **エージェント単位** のポリシー、許可リスト、確認モード、ノードバインディングを提供します。
- 許可リストの _有無に関わらず_ 動作する **確認モード** をサポートします。
- クロスプラットフォーム: Unix ソケット + トークン認証（macOS/Linux/Windows の同等性）。

## Non-goals

- レガシー許可リストの移行やレガシースキーマのサポートは行いません。
- ノード exec に対する PTY/ストリーミングは行いません（集約された出力のみ）。
- 既存の Bridge + Gateway 以外の新しいネットワーク層は追加しません。

## Decisions (locked)

- **Config keys:** `exec.host` + `exec.security`（エージェント単位のオーバーライドを許可）。
- **Elevation:** `/elevated` を gateway のフルアクセスのエイリアスとして維持します。
- **Ask default:** `on-miss`。
- **Approvals store:** `~/.openclaw/exec-approvals.json`（JSON、レガシー移行なし）。
- **Runner:** ヘッドレスなシステムサービス。UI アプリは承認用の Unix ソケットをホストします。
- **Node identity:** 既存の `nodeId` を使用します。
- **Socket auth:** Unix ソケット + トークン（クロスプラットフォーム）。必要に応じて後で分離します。
- **Node host state:** `~/.openclaw/node.json`（ノード ID + ペアリングトークン）。
- **macOS exec host:** macOS アプリ内で `system.run` を実行します。ノードホストサービスはローカル IPC 経由でリクエストを転送します。
- **No XPC helper:** Unix ソケット + トークン + ピアチェックに限定します。

## Key concepts

### Host

- `sandbox`: Docker exec（現在の挙動）。
- `gateway`: gateway ホスト上での exec。
- `node`: Bridge（`system.run`）経由でノードランナー上の exec。

### Security mode

- `deny`: 常にブロック。
- `allowlist`: 一致するもののみ許可。
- `full`: すべて許可（elevated と同等）。

### Ask mode

- `off`: 決して確認しない。
- `on-miss`: 許可リストが一致しない場合のみ確認。
- `always`: 毎回確認。

確認は許可リストと **独立** しています。許可リストは `always` または `on-miss` と併用できます。

### Policy resolution (per exec)

1. `exec.host` を解決します（ツールパラメータ → エージェントオーバーライド → グローバルデフォルト）。
2. `exec.security` と `exec.ask` を解決します（同じ優先順位）。
3. ホストが `sandbox` の場合、ローカルサンドボックス exec を実行します。
4. ホストが `gateway` または `node` の場合、そのホストでセキュリティ + 確認ポリシーを適用します。

## Default safety

- デフォルトは `exec.host = sandbox`。
- `gateway` および `node` に対するデフォルトは `exec.security = deny`。
- デフォルトは `exec.ask = on-miss`（セキュリティが許可する場合のみ関連）。
- ノードバインディングが設定されていない場合、**エージェントは任意のノードを対象にできます** が、ポリシーが許可する場合に限られます。

## Config surface

### Tool parameters

- `exec.host`（任意）: `sandbox | gateway | node`。
- `exec.security`（任意）: `deny | allowlist | full`。
- `exec.ask`（任意）: `off | on-miss | always`。
- `exec.node`（任意）: `host=node` の場合に使用するノード ID/名前。

### Config keys (global)

- `tools.exec.host`
- `tools.exec.security`
- `tools.exec.ask`
- `tools.exec.node`（デフォルトのノードバインディング）

### Config keys (per agent)

- `agents.list[].tools.exec.host`
- `agents.list[].tools.exec.security`
- `agents.list[].tools.exec.ask`
- `agents.list[].tools.exec.node`

### Alias

- `/elevated on` = エージェントセッションに対して `tools.exec.host=gateway`、`tools.exec.security=full` を設定します。
- `/elevated off` = エージェントセッションの以前の exec 設定を復元します。

## Approvals store (JSON)

Path: `~/.openclaw/exec-approvals.json`

Purpose:

- **実行ホスト**（gateway またはノードランナー）向けのローカルポリシー + 許可リスト。
- UI が利用できない場合の確認フォールバック。
- UI クライアント用の IPC 資格情報。

Proposed schema (v1):

```json
{
  "version": 1,
  "socket": {
    "path": "~/.openclaw/exec-approvals.sock",
    "token": "base64-opaque-token"
  },
  "defaults": {
    "security": "deny",
    "ask": "on-miss",
    "askFallback": "deny"
  },
  "agents": {
    "agent-id-1": {
      "security": "allowlist",
      "ask": "on-miss",
      "allowlist": [
        {
          "pattern": "~/Projects/**/bin/rg",
          "lastUsedAt": 0,
          "lastUsedCommand": "rg -n TODO",
          "lastResolvedPath": "/Users/user/Projects/.../bin/rg"
        }
      ]
    }
  }
}
```

Notes:

- レガシー許可リスト形式はサポートしません。
- `askFallback` は、`ask` が必要で、かつ UI に到達できない場合にのみ適用されます。
- ファイル権限: `0600`。

## Runner service (headless)

### Role

- ローカルで `exec.security` + `exec.ask` を強制します。
- システムコマンドを実行し、出力を返します。
- exec ライフサイクル用の Bridge イベントを送出します（任意ですが推奨）。

### Service lifecycle

- macOS では Launchd/デーモン、Linux/Windows ではシステムサービス。
- Approvals JSON は実行ホストにローカルです。
- UI はローカル Unix ソケットをホストし、ランナーはオンデマンドで接続します。

## UI integration (macOS app)

### IPC

- `~/.openclaw/exec-approvals.sock` の Unix ソケット（0600）。
- `exec-approvals.json` に保存されたトークン（0600）。
- ピアチェック: 同一 UID のみ。
- チャレンジ/レスポンス: リプレイ防止のための nonce + HMAC(token, request-hash)。
- 短い TTL（例: 10 秒）+ 最大ペイロード + レート制限。

### Ask flow (macOS app exec host)

1. ノードサービスが gateway から `system.run` を受信します。
2. ノードサービスがローカルソケットに接続し、プロンプト/exec リクエストを送信します。
3. アプリがピア + トークン + HMAC + TTL を検証し、必要に応じてダイアログを表示します。
4. アプリが UI コンテキストでコマンドを実行し、出力を返します。
5. ノードサービスが出力を gateway に返します。

UI が存在しない場合:

- `askFallback`（`deny|allowlist|full`）を適用します。

### Diagram (SCI)

```
Agent -> Gateway -> Bridge -> Node Service (TS)
                         |  IPC (UDS + token + HMAC + TTL)
                         v
                     Mac App (UI + TCC + system.run)
```

## Node identity + binding

- Bridge ペアリングから既存の `nodeId` を使用します。
- バインディングモデル:
  - `tools.exec.node` はエージェントを特定のノードに制限します。
  - 未設定の場合、エージェントは任意のノードを選択できます（ポリシーは引き続きデフォルトを強制します）。
- ノード選択の解決順:
  - `nodeId` の完全一致
  - `displayName`（正規化）
  - `remoteIp`
  - `nodeId` プレフィックス（6 文字以上）

## Eventing

### Who sees events

- システムイベントは **セッション単位** で、次のプロンプト時にエージェントへ表示されます。
- gateway のインメモリキュー（`enqueueSystemEvent`）に保存されます。

### Event text

- `Exec started (node=<id>, id=<runId>)`
- `Exec finished (node=<id>, id=<runId>, code=<code>)` + 任意の出力末尾
- `Exec denied (node=<id>, id=<runId>, <reason>)`

### Transport

Option A（推奨）:

- ランナーが Bridge の `event` フレーム `exec.started` / `exec.finished` を送信します。
- gateway の `handleBridgeEvent` がこれらを `enqueueSystemEvent` にマッピングします。

Option B:

- gateway の `exec` ツールがライフサイクルを直接処理します（同期のみ）。

## Exec flows

### Sandbox host

- 既存の `exec` の挙動（Docker、または非サンドボックス時のホスト）。
- PTY は非サンドボックスモードでのみサポートされます。

### Gateway host

- gateway プロセスが自身のマシン上で実行します。
- ローカルの `exec-approvals.json`（セキュリティ/確認/許可リスト）を強制します。

### Node host

- gateway が `system.run` を伴って `node.invoke` を呼び出します。
- ランナーがローカル承認を強制します。
- ランナーが集約された stdout/stderr を返します。
- 開始/終了/拒否に関する Bridge イベントは任意です。

## Output caps

- stdout+stderr の合計を **200k** に制限し、イベント用に **末尾 20k** を保持します。
- 明確なサフィックス（例: `"… (truncated)"`）を付けて切り詰めます。

## Slash commands

- `/exec host=<sandbox|gateway|node> security=<deny|allowlist|full> ask=<off|on-miss|always> node=<id>`
- エージェント単位・セッション単位のオーバーライドで、設定に保存しない限り非永続です。
- `/elevated on|off|ask|full` は `host=gateway security=full` のショートカットとして残ります（`full` により承認をスキップ）。

## Cross-platform story

- ランナーサービスがポータブルな実行ターゲットです。
- UI は任意であり、存在しない場合は `askFallback` が適用されます。
- Windows/Linux は同じ approvals JSON + ソケットプロトコルをサポートします。

## Implementation phases

### Phase 1: config + exec routing

- `exec.host`、`exec.security`、`exec.ask`、`exec.node` の config スキーマを追加します。
- ツールの配線を更新し、`exec.host` を尊重するようにします。
- `/exec` スラッシュコマンドを追加し、`/elevated` のエイリアスを維持します。

### Phase 2: approvals store + gateway enforcement

- `exec-approvals.json` のリーダー/ライターを実装します。
- `gateway` ホストに対して許可リスト + 確認モードを強制します。
- 出力制限を追加します。

### Phase 3: node runner enforcement

- ノードランナーを更新し、許可リスト + 確認を強制します。
- macOS アプリ UI への Unix ソケット・プロンプトブリッジを追加します。
- `askFallback` を配線します。

### Phase 4: events

- exec ライフサイクルに関するノード → gateway の Bridge イベントを追加します。
- エージェントプロンプト向けに `enqueueSystemEvent` へマッピングします。

### Phase 5: UI polish

- Mac アプリ: 許可リストエディタ、エージェント単位のスイッチャー、確認ポリシー UI。
- ノードバインディングの制御（任意）。

## Testing plan

- ユニットテスト: 許可リストの一致判定（glob + 大文字小文字非依存）。
- ユニットテスト: ポリシー解決の優先順位（ツールパラメータ → エージェントオーバーライド → グローバル）。
- 統合テスト: ノードランナーの deny/allow/ask フロー。
- Bridge イベントテスト: ノードイベント → システムイベントのルーティング。

## Open risks

- UI の非可用性: `askFallback` が遵守されることを確認します。
- 長時間実行コマンド: タイムアウト + 出力制限に依存します。
- マルチノードの曖昧性: ノードバインディングまたは明示的なノードパラメータがない場合はエラー。

## Related docs

- [Exec tool](/tools/exec)
- [Exec approvals](/tools/exec-approvals)
- [Nodes](/nodes)
- [Elevated mode](/tools/elevated)
