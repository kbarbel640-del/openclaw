---
summary: "Exec 承認、許可リスト、およびサンドボックス脱出プロンプト"
read_when:
  - Exec 承認または許可リストを設定する場合
  - macOS アプリで Exec 承認 UX を実装する場合
  - サンドボックス脱出プロンプトとその影響をレビューする場合
title: "Exec 承認"
x-i18n:
  source_path: tools/exec-approvals.md
  source_hash: 97736427752eb905
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:12:51Z
---

# Exec 承認

Exec 承認は、サンドボックス化されたエージェントが実ホスト上でコマンドを実行できるようにするための **コンパニオンアプリ / ノードホストのガードレール** です
（`gateway` または `node`）。安全インターロックのようなものだと考えてください。ポリシー + 許可リスト +（任意の）ユーザー承認のすべてが一致した場合にのみコマンドが許可されます。
Exec 承認は、ツールポリシーおよび elevated のゲーティングに **追加** されます（ただし elevated が `full` に設定されている場合は承認がスキップされます）。
有効なポリシーは `tools.exec.*` と承認デフォルトのうち **より厳しい** 方です。承認フィールドが省略された場合は `tools.exec` の値が使用されます。

コンパニオンアプリ UI が **利用できない** 場合、プロンプトが必要なリクエストは
**ask fallback**（デフォルト: deny）によって解決されます。

## 適用範囲

Exec 承認は実行ホスト上でローカルに強制されます。

- **Gateway ホスト** → ゲートウェイマシン上の `openclaw` プロセス
- **ノードホスト** → ノードランナー（macOS コンパニオンアプリまたはヘッドレスノードホスト）

macOS の分割:

- **ノードホストサービス** が local IPC 経由で `system.run` を **macOS アプリ** に転送します。
- **macOS アプリ** が承認を強制し、UI コンテキストでコマンドを実行します。

## 設定と保存先

承認は実行ホスト上のローカル JSON ファイルに保存されます。

`~/.openclaw/exec-approvals.json`

スキーマ例:

```json
{
  "version": 1,
  "socket": {
    "path": "~/.openclaw/exec-approvals.sock",
    "token": "base64url-token"
  },
  "defaults": {
    "security": "deny",
    "ask": "on-miss",
    "askFallback": "deny",
    "autoAllowSkills": false
  },
  "agents": {
    "main": {
      "security": "allowlist",
      "ask": "on-miss",
      "askFallback": "deny",
      "autoAllowSkills": true,
      "allowlist": [
        {
          "id": "B0C8C0B3-2C2D-4F8A-9A3C-5A4B3C2D1E0F",
          "pattern": "~/Projects/**/bin/rg",
          "lastUsedAt": 1737150000000,
          "lastUsedCommand": "rg -n TODO",
          "lastResolvedPath": "/Users/user/Projects/.../bin/rg"
        }
      ]
    }
  }
}
```

## ポリシーのつまみ

### セキュリティ（`exec.security`）

- **deny**: すべてのホスト exec リクエストをブロックします。
- **allowlist**: 許可リストに登録されたコマンドのみ許可します。
- **full**: すべてを許可します（elevated と同等）。

### Ask（`exec.ask`）

- **off**: プロンプトを表示しません。
- **on-miss**: 許可リストに一致しない場合のみプロンプトを表示します。
- **always**: すべてのコマンドでプロンプトを表示します。

### Ask fallback（`askFallback`）

プロンプトが必要だが到達可能な UI がない場合、fallback が決定します。

- **deny**: ブロックします。
- **allowlist**: 許可リストに一致する場合のみ許可します。
- **full**: 許可します。

## 許可リスト（エージェント単位）

許可リストは **エージェント単位** です。複数のエージェントが存在する場合、macOS アプリで編集対象のエージェントを切り替えます。パターンは **大文字小文字を区別しない glob マッチ** です。
パターンは **バイナリパス** に解決される必要があります（basename のみのエントリは無視されます）。
レガシー `agents.default` エントリはロード時に `agents.main` に移行されます。

例:

- `~/Projects/**/bin/bird`
- `~/.local/bin/*`
- `/opt/homebrew/bin/rg`

各許可リストエントリは以下を追跡します。

- **id** UI の同一性に使用される安定 UUID（任意）
- **last used** タイムスタンプ
- **last used command**
- **last resolved path**

## Skill CLI の自動許可

**Auto-allow skill CLIs** が有効な場合、既知の Skills によって参照される実行ファイルは、ノード（macOS ノードまたはヘッドレスノードホスト）上で許可リスト済みとして扱われます。これは Gateway RPC 経由の `skills.bins` を使用して skill bin リストを取得します。厳密に手動の許可リストにしたい場合は、これを無効にしてください。

## Safe bins（stdin のみ）

`tools.exec.safeBins` は、明示的な許可リストエントリがなくても allowlist モードで実行できる **stdin のみ** のバイナリ（例: `jq`）の小さなリストを定義します。Safe bins は位置引数のファイル引数とパスのようなトークンを拒否するため、入力ストリームに対してのみ動作できます。
シェルの連結やリダイレクトは、allowlist モードでは自動許可されません。

シェルの連結（`&&`、`||`、`;`）は、トップレベルの各セグメントが許可リスト（safe bins または skill の自動許可を含む）を満たす場合に許可されます。リダイレクトは allowlist モードでは引き続き未サポートです。
コマンド置換（`$()` / バッククォート）は、二重引用符の内側を含め、許可リスト解析中に拒否されます。リテラルな `$()` テキストが必要な場合は単一引用符を使用してください。

デフォルトの safe bins: `jq`、`grep`、`cut`、`sort`、`uniq`、`head`、`tail`、`tr`、`wc`。

## Control UI 編集

デフォルト、エージェント単位の上書き、および許可リストを編集するには **Control UI → Nodes → Exec approvals** カードを使用します。スコープ（Defaults またはエージェント）を選択し、ポリシーを調整し、許可リストパターンを追加/削除してから **Save** を押します。UI はパターンごとに **last used** メタデータを表示するため、リストを整理して保つことができます。

ターゲットセレクターで **Gateway**（ローカル承認）または **Node** を選択します。ノードは `system.execApprovals.get/set`（macOS アプリまたはヘッドレスノードホスト）をアドバタイズする必要があります。
ノードがまだ exec 承認をアドバタイズしていない場合は、そのローカルの
`~/.openclaw/exec-approvals.json` を直接編集してください。

CLI: `openclaw approvals` はゲートウェイまたはノードの編集をサポートします（[Approvals CLI](/cli/approvals) を参照）。

## 承認フロー

プロンプトが必要な場合、ゲートウェイはオペレータークライアントに `exec.approval.requested` をブロードキャストします。
Control UI と macOS アプリは `exec.approval.resolve` によりこれを解決し、その後ゲートウェイが
承認済みリクエストをノードホストに転送します。

承認が必要な場合、exec ツールは承認 id を返して直ちに戻ります。その id を使って、後続のシステムイベント（`Exec finished` / `Exec denied`）と相関付けてください。タイムアウトまでに決定が届かなければ、そのリクエストは承認タイムアウトとして扱われ、拒否理由として表面化します。

確認ダイアログには以下が含まれます。

- command + args
- cwd
- agent id
- 解決された実行ファイルパス
- ホスト + ポリシーのメタデータ

アクション:

- **Allow once** → 今すぐ実行
- **Always allow** → 許可リストに追加して実行
- **Deny** → ブロック

## チャットチャンネルへの承認転送

exec 承認プロンプトを任意のチャットチャンネル（プラグインチャンネルを含む）に転送し、`/approve` で承認できます。これは通常のアウトバウンド配信パイプラインを使用します。

設定:

```json5
{
  approvals: {
    exec: {
      enabled: true,
      mode: "session", // "session" | "targets" | "both"
      agentFilter: ["main"],
      sessionFilter: ["discord"], // substring or regex
      targets: [
        { channel: "slack", to: "U12345678" },
        { channel: "telegram", to: "123456789" },
      ],
    },
  },
}
```

チャットで返信:

```
/approve <id> allow-once
/approve <id> allow-always
/approve <id> deny
```

### macOS IPC フロー

```
Gateway -> Node Service (WS)
                 |  IPC (UDS + token + HMAC + TTL)
                 v
             Mac App (UI + approvals + system.run)
```

セキュリティノート:

- Unix ソケットモードは `0600`、トークンは `exec-approvals.json` に保存されます。
- 同一 UID のピアチェック。
- チャレンジ/レスポンス（nonce + HMAC トークン + リクエストハッシュ）+ 短い TTL。

## システムイベント

exec のライフサイクルはシステムメッセージとして表示されます。

- `Exec running`（コマンドが実行中通知のしきい値を超えた場合のみ）
- `Exec finished`
- `Exec denied`

これらはノードがイベントを報告した後、エージェントのセッションに投稿されます。
Gateway ホストの exec 承認は、コマンド完了時（および任意で、しきい値を超えて長時間実行している場合）に同じライフサイクルイベントを送出します。
承認ゲート付き exec は、相関付けを容易にするため、これらのメッセージで承認 id を `runId` として再利用します。

## 影響

- **full** は強力です。可能な限り許可リストを優先してください。
- **ask** は迅速な承認を可能にしつつ、状況把握を維持できます。
- エージェント単位の許可リストにより、あるエージェントの承認が他に漏れません。
- 承認は **認可された送信者** からのホスト exec リクエストにのみ適用されます。未認可の送信者は `/exec` を発行できません。
- `/exec security=full` は認可されたオペレーター向けのセッションレベルの利便機能であり、設計上、承認をスキップします。
  ホスト exec を強制的にブロックするには、承認セキュリティを `deny` に設定するか、ツールポリシーで `exec` ツールを deny してください。

関連:

- [Exec tool](/tools/exec)
- [Elevated mode](/tools/elevated)
- [Skills](/tools/skills)
