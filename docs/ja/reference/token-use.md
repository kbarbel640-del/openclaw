---
summary: "OpenClaw がプロンプトコンテキストをどのように構築し、トークン使用量とコストをどのように報告するか"
read_when:
  - トークン使用量、コスト、またはコンテキストウィンドウを説明する場合
  - コンテキストの増加や圧縮動作をデバッグする場合
title: "トークン使用量とコスト"
x-i18n:
  source_path: reference/token-use.md
  source_hash: f8bfadb36b51830c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:14:50Z
---

# トークン使用量とコスト

OpenClaw は文字数ではなく **トークン** を追跡します。トークンはモデル固有ですが、ほとんどの OpenAI 系モデルでは、英語テキストで 1 トークンあたり平均約 4 文字です。

## システムプロンプトの構築方法

OpenClaw は実行のたびに独自のシステムプロンプトを組み立てます。これには次が含まれます。

- ツール一覧と簡単な説明
- Skills 一覧（メタデータのみ。指示は必要に応じて `read` により読み込まれます）
- 自己更新の指示
- ワークスペースおよびブートストラップファイル（新規時は `AGENTS.md`、`SOUL.md`、`TOOLS.md`、`IDENTITY.md`、`USER.md`、`HEARTBEAT.md`、`BOOTSTRAP.md`）。大きなファイルは `agents.defaults.bootstrapMaxChars` により切り詰められます（デフォルト: 20000）。
- 時刻（UTC + ユーザーのタイムゾーン）
- 返信タグとハートビートの挙動
- 実行時メタデータ（ホスト / OS / モデル / thinking）

完全な内訳は [System Prompt](/concepts/system-prompt) を参照してください。

## コンテキストウィンドウに含まれるもの

モデルが受け取るすべてのものがコンテキスト制限にカウントされます。

- システムプロンプト（上記のすべてのセクション）
- 会話履歴（ユーザー + アシスタントのメッセージ）
- ツール呼び出しとツール結果
- 添付ファイル / トランスクリプト（画像、音声、ファイル）
- 圧縮サマリーおよびプルーニングの成果物
- プロバイダーのラッパーやセーフティヘッダー（表示されませんが、カウントされます）

注入されたファイルごと、ツール、Skills、システムプロンプトサイズごとの実用的な内訳については、`/context list` または `/context detail` を使用してください。[Context](/concepts/context) も参照してください。

## 現在のトークン使用量を確認する方法

チャット内で次を使用します。

- `/status` → セッションのモデル、コンテキスト使用量、直前の応答の入力 / 出力トークン、**推定コスト**（API キー使用時のみ）を表示する **絵文字豊富なステータスカード**。
- `/usage off|tokens|full` → すべての返信に **応答ごとの使用量フッター** を追加します。
  - セッションごとに保持されます（`responseUsage` として保存）。
  - OAuth 認証では **コストは非表示**（トークンのみ）になります。
- `/usage cost` → OpenClaw セッションログからのローカルコストサマリーを表示します。

その他の表示場所:

- **TUI / Web TUI:** `/status` と `/usage` がサポートされています。
- **CLI:** `openclaw status --usage` と `openclaw channels list` は
  プロバイダーのクォータウィンドウを表示します（応答ごとのコストではありません）。

## コスト見積もり（表示される場合）

コストは、モデルの価格設定に基づいて見積もられます。

```
models.providers.<provider>.models[].cost
```

これらは `input`、`output`、`cacheRead`、および
`cacheWrite` に対する **100 万トークンあたりの USD** です。価格設定が欠けている場合、OpenClaw はトークンのみを表示します。OAuth トークンではドル建てのコストは表示されません。

## キャッシュ TTL とプルーニングの影響

プロバイダーのプロンプトキャッシュは、キャッシュ TTL の有効期間内でのみ適用されます。OpenClaw はオプションで **cache-ttl プルーニング** を実行できます。これは、キャッシュ TTL の期限切れ後にセッションをプルーニングし、その後キャッシュウィンドウをリセットして、以降のリクエストが完全な履歴を再キャッシュする代わりに、新しくキャッシュされたコンテキストを再利用できるようにします。これにより、セッションが TTL を超えてアイドル状態になった場合のキャッシュ書き込みコストを低く抑えられます。

設定は [Gateway configuration](/gateway/configuration) で行い、挙動の詳細は [Session pruning](/concepts/session-pruning) を参照してください。

ハートビートにより、アイドル期間をまたいでキャッシュを **ウォーム** に保つことができます。モデルのキャッシュ TTL が `1h` の場合、ハートビート間隔をそれよりわずかに短く設定する（例: `55m`）ことで、完全なプロンプトの再キャッシュを回避し、キャッシュ書き込みコストを削減できます。

Anthropic API の価格体系では、キャッシュ読み取りは入力トークンよりも大幅に安価である一方、キャッシュ書き込みはより高い倍率で課金されます。最新のレートおよび TTL 倍率については、Anthropic のプロンプトキャッシュ価格を参照してください。
[https://docs.anthropic.com/docs/build-with-claude/prompt-caching](https://docs.anthropic.com/docs/build-with-claude/prompt-caching)

### 例: ハートビートで 1 時間のキャッシュをウォームに保つ

```yaml
agents:
  defaults:
    model:
      primary: "anthropic/claude-opus-4-6"
    models:
      "anthropic/claude-opus-4-6":
        params:
          cacheRetention: "long"
    heartbeat:
      every: "55m"
```

## トークン圧迫を減らすためのヒント

- `/compact` を使用して長いセッションを要約します。
- ワークフロー内の大きなツール出力をトリミングします。
- スキルの説明は短く保ちます（スキル一覧はプロンプトに注入されます）。
- 冗長で探索的な作業には、より小さなモデルを優先します。

スキル一覧の正確なオーバーヘッド算出式については、[Skills](/tools/skills) を参照してください。
