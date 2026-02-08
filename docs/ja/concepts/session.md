---
summary: "チャットのセッション管理ルール、キー、および永続化について"
read_when:
  - セッション処理またはストレージを変更するとき
title: "セッション管理"
x-i18n:
  source_path: concepts/session.md
  source_hash: 1486759a5c2fdced
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:12:02Z
---

# セッション管理

OpenClaw は、**エージェントごとに 1 つのダイレクトチャットセッション**を主として扱います。ダイレクトチャットは `agent:<agentId>:<mainKey>`（既定は `main`）に集約され、グループ／チャンネルのチャットはそれぞれ独自のキーを持ちます。`session.mainKey` は尊重されます。

**ダイレクトメッセージ**のグルーピング方法は、`session.dmScope` で制御します。

- `main`（既定）: すべての DM が継続性のためにメインセッションを共有します。
- `per-peer`: チャンネルをまたいで送信者 id ごとに分離します。
- `per-channel-peer`: チャンネル + 送信者で分離します（マルチユーザー受信箱に推奨）。
- `per-account-channel-peer`: アカウント + チャンネル + 送信者で分離します（マルチアカウント受信箱に推奨）。
  `session.identityLinks` を使用して、プロバイダー接頭辞付きの peer id を正規化された ID にマップし、`per-peer`、`per-channel-peer`、または `per-account-channel-peer` を使用する際に、同一人物がチャンネルをまたいでも同じ DM セッションを共有できるようにします。

### セキュア DM モード（マルチユーザー構成に推奨）

> **セキュリティ警告:** エージェントが **複数の人** から DM を受信できる場合は、セキュア DM モードを有効化することを強く推奨します。有効化しない場合、すべてのユーザーが同一の会話コンテキストを共有するため、ユーザー間で個人情報が漏えいする可能性があります。

**既定設定で発生する問題の例:**

- Alice（`<SENDER_A>`）が、個人的な話題（例: 診療予約）についてエージェントにメッセージします
- Bob（`<SENDER_B>`）がエージェントに「何の話をしていたっけ？」とメッセージします
- 両方の DM が同じセッションを共有しているため、モデルが Alice の過去コンテキストを使って Bob に回答してしまう可能性があります。

**修正:** `dmScope` を設定して、ユーザーごとにセッションを分離します。

```json5
// ~/.openclaw/openclaw.json
{
  session: {
    // Secure DM mode: isolate DM context per channel + sender.
    dmScope: "per-channel-peer",
  },
}
```

**これを有効化すべきタイミング:**

- 2 人以上の送信者に対するペアリング承認がある
- 複数エントリを含む DM 許可リストを使用している
- `dmPolicy: "open"` を設定している
- 複数の電話番号またはアカウントからエージェントにメッセージできる

注記:

- 既定は継続性のため `dmScope: "main"`（すべての DM がメインセッションを共有）です。単一ユーザー構成では問題ありません。
- 同一チャンネル上のマルチアカウント受信箱では、`per-account-channel-peer` を推奨します。
- 同一人物が複数チャンネルから連絡してくる場合は、`session.identityLinks` を使用して DM セッションを 1 つの正規 ID に集約してください。
- `openclaw security audit` で DM 設定を検証できます（[security](/cli/security) を参照）。

## Gateway（ゲートウェイ）が正となる情報源です

すべてのセッション状態は **Gateway（ゲートウェイ）**（「マスター」 OpenClaw）によって所有されます。UI クライアント（macOS アプリ、WebChat など）は、ローカルファイルを読むのではなく、Gateway（ゲートウェイ）に対してセッション一覧とトークン数を問い合わせる必要があります。

- **リモートモード**では、重要なセッションストアは Mac ではなくリモートの Gateway（ゲートウェイ）ホスト上にあります。
- UI に表示されるトークン数は、Gateway（ゲートウェイ）のストアフィールド（`inputTokens`、`outputTokens`、`totalTokens`、`contextTokens`）に由来します。クライアントは JSONL トランスクリプトを解析して合計を「補正」しません。

## 状態の保存場所

- **Gateway（ゲートウェイ）ホスト上**:
  - ストアファイル: `~/.openclaw/agents/<agentId>/sessions/sessions.json`（エージェントごと）。
- トランスクリプト: `~/.openclaw/agents/<agentId>/sessions/<SessionId>.jsonl`（Telegram のトピックセッションは `.../<SessionId>-topic-<threadId>.jsonl` を使用します）。
- ストアは `sessionKey -> { sessionId, updatedAt, ... }` のマップです。エントリの削除は安全で、必要に応じて再作成されます。
- グループのエントリには、UI でセッションにラベルを付けるために `displayName`、`channel`、`subject`、`room`、および `space` が含まれる場合があります。
- セッションのエントリには、UI がセッションの由来を説明できるように、`origin` メタデータ（ラベル + ルーティングのヒント）が含まれます。
- OpenClaw は、旧来の Pi/Tau セッションフォルダを読み取りません。

## セッションの剪定

OpenClaw は既定で、LLM 呼び出しの直前に、インメモリのコンテキストから **古いツール結果**をトリミングします。  
これは JSONL 履歴を書き換えるものではありません。[/concepts/session-pruning](/concepts/session-pruning) を参照してください。

## 圧縮前のメモリフラッシュ

セッションが自動圧縮に近づくと、OpenClaw は **サイレントなメモリフラッシュ**を実行して、モデルに耐久的なメモをディスクへ書き出すよう促せます。これはワークスペースが書き込み可能な場合にのみ実行されます。[Memory](/concepts/memory) と [Compaction](/concepts/compaction) を参照してください。

## トランスポート → セッションキーのマッピング

- ダイレクトチャットは `session.dmScope`（既定は `main`）に従います。
  - `main`: `agent:<agentId>:<mainKey>`（デバイス／チャンネル間の継続性）。
    - 複数の電話番号とチャンネルが同じエージェントのメインキーにマップされることがあり、1 つの会話へのトランスポートとして機能します。
  - `per-peer`: `agent:<agentId>:dm:<peerId>`。
  - `per-channel-peer`: `agent:<agentId>:<channel>:dm:<peerId>`。
  - `per-account-channel-peer`: `agent:<agentId>:<channel>:<accountId>:dm:<peerId>`（accountId の既定は `default` です）。
  - `session.identityLinks` がプロバイダー接頭辞付きの peer id（例: `telegram:123`）に一致する場合、正規キーが `<peerId>` を置き換え、同一人物がチャンネルをまたいでセッションを共有します。
- グループチャットは状態を分離します: `agent:<agentId>:<channel>:group:<id>`（ルーム／チャンネルは `agent:<agentId>:<channel>:channel:<id>` を使用します）。
  - Telegram のフォーラムトピックは、分離のためにグループ id に `:topic:<threadId>` を追加します。
  - 旧来の `group:<id>` キーも、移行のために引き続き認識されます。
- インバウンドコンテキストは引き続き `group:<id>` を使用する場合があります。チャンネルは `Provider` から推論され、正規の `agent:<agentId>:<channel>:group:<id>` 形式に正規化されます。
- その他のソース:
  - Cron ジョブ: `cron:<job.id>`
  - Webhook: `hook:<uuid>`（フックで明示的に設定されない限り）
  - ノード実行: `node-<nodeId>`

## ライフサイクル

- リセットポリシー: セッションは期限切れになるまで再利用され、期限切れ判定は次のインバウンドメッセージで評価されます。
- 日次リセット: 既定は **Gateway（ゲートウェイ）ホストのローカル時刻で午前 4:00** です。最終更新が直近の日次リセット時刻より前であれば、そのセッションは古い状態です。
- アイドルリセット（任意）: `idleMinutes` がスライディングのアイドルウィンドウを追加します。日次とアイドルの両方が設定されている場合、**先に期限切れになる方**が新しいセッションを強制します。
- 旧来のアイドルのみ: `session.idleMinutes` を設定し、かつ `session.reset`/`resetByType` の設定がない場合、後方互換性のため OpenClaw はアイドルのみモードのままになります。
- タイプ別上書き（任意）: `resetByType` により、`dm`、`group`、および `thread` セッションのポリシーを上書きできます（thread = Slack/Discord のスレッド、Telegram のトピック、コネクタが提供する場合は Matrix のスレッド）。
- チャンネル別上書き（任意）: `resetByChannel` がチャンネルのリセットポリシーを上書きします（そのチャンネルのすべてのセッションタイプに適用され、`reset`/`resetByType` より優先されます）。
- リセットトリガー: 完全一致の `/new` または `/reset`（加えて `resetTriggers` にある追加分）により、新しいセッション id を開始し、メッセージの残りをそのまま通します。`/new <model>` は、モデルエイリアス、`provider/model`、またはプロバイダー名（あいまい一致）を受け付け、新しいセッションモデルを設定します。`/new` または `/reset` が単独で送信された場合、OpenClaw はリセット確認のため短い「hello」挨拶ターンを実行します。
- 手動リセット: ストアから特定キーを削除するか、JSONL トランスクリプトを削除します。次のメッセージで再作成されます。
- 分離された cron ジョブは、実行ごとに必ず新しい `sessionId` を発行します（アイドルでの再利用なし）。

## 送信ポリシー（任意）

個別の id を列挙せずに、特定のセッションタイプの配信をブロックします。

```json5
{
  session: {
    sendPolicy: {
      rules: [
        { action: "deny", match: { channel: "discord", chatType: "group" } },
        { action: "deny", match: { keyPrefix: "cron:" } },
      ],
      default: "allow",
    },
  },
}
```

ランタイム上書き（オーナーのみ）:

- `/send on` → このセッションを許可
- `/send off` → このセッションを拒否
- `/send inherit` → 上書きをクリアして設定ルールを使用
  これらは単独メッセージとして送信し、確実に登録されるようにしてください。

## 設定（任意のリネーム例）

```json5
// ~/.openclaw/openclaw.json
{
  session: {
    scope: "per-sender", // keep group keys separate
    dmScope: "main", // DM continuity (set per-channel-peer/per-account-channel-peer for shared inboxes)
    identityLinks: {
      alice: ["telegram:123456789", "discord:987654321012345678"],
    },
    reset: {
      // Defaults: mode=daily, atHour=4 (gateway host local time).
      // If you also set idleMinutes, whichever expires first wins.
      mode: "daily",
      atHour: 4,
      idleMinutes: 120,
    },
    resetByType: {
      thread: { mode: "daily", atHour: 4 },
      dm: { mode: "idle", idleMinutes: 240 },
      group: { mode: "idle", idleMinutes: 120 },
    },
    resetByChannel: {
      discord: { mode: "idle", idleMinutes: 10080 },
    },
    resetTriggers: ["/new", "/reset"],
    store: "~/.openclaw/agents/{agentId}/sessions/sessions.json",
    mainKey: "main",
  },
}
```

## 検査

- `openclaw status` — ストアパスと最近のセッションを表示します。
- `openclaw sessions --json` — 全エントリをダンプします（`--active <minutes>` でフィルタできます）。
- `openclaw gateway call sessions.list --params '{}'` — 実行中の Gateway（ゲートウェイ）からセッションを取得します（リモート Gateway（ゲートウェイ）アクセスには `--url`/`--token` を使用します）。
- チャットで `/status` を単独メッセージとして送信すると、エージェントが到達可能かどうか、セッションコンテキストがどれだけ使用されているか、現在の thinking/verbose トグル、および WhatsApp web の認証情報が最後に更新された時刻（再リンクが必要かどうかの判別に有用）を確認できます。
- `/context list` または `/context detail` を送信すると、システムプロンプトと注入されたワークスペースファイル（および最大のコンテキスト寄与要因）に何が含まれているかを確認できます。
- `/stop` を単独メッセージとして送信すると、現在の実行を中断し、そのセッションのキュー済みフォローアップをクリアし、そこから派生したサブエージェント実行を停止します（返信には停止件数が含まれます）。
- `/compact`（任意の指示）を単独メッセージとして送信すると、古いコンテキストを要約してウィンドウスペースを解放できます。[/concepts/compaction](/concepts/compaction) を参照してください。
- JSONL トランスクリプトは、全ターンをレビューするために直接開けます。

## ヒント

- プライマリキーは 1:1 トラフィック専用にし、グループは独自のキーを維持させてください。
- クリーンアップを自動化する場合、他のコンテキストを保持するために、ストア全体ではなく個別のキーを削除してください。

## セッション起点メタデータ

各セッションエントリは、（ベストエフォートで）由来を `origin` に記録します。

- `label`: 人間向けラベル（会話ラベル + グループ件名／チャンネルから解決）
- `provider`: 正規化されたチャンネル id（拡張を含む）
- `from`/`to`: インバウンドエンベロープからの生のルーティング id
- `accountId`: プロバイダーのアカウント id（マルチアカウント時）
- `threadId`: チャンネルがサポートする場合のスレッド／トピック id
  起点フィールドは、ダイレクトメッセージ、チャンネル、およびグループに対して埋められます。コネクタが配信ルーティングのみを更新する場合（例: DM メインセッションを新鮮に保つため）は、それでもインバウンドコンテキストを提供し、セッションが説明用メタデータを保持できるようにすべきです。拡張は、インバウンドコンテキストで `ConversationLabel`、`GroupSubject`、`GroupChannel`、`GroupSpace`、および `SenderName` を送信し、`recordSessionMetaFromInbound` を呼び出す（または同一のコンテキストを `updateLastRoute` に渡す）ことでこれを実現できます。
