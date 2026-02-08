---
summary: "自動化において heartbeat と cron ジョブのどちらを選ぶべきかのガイダンス"
read_when:
  - 定期タスクをどのようにスケジュールするかを決めるとき
  - バックグラウンド監視や通知を設定するとき
  - 定期チェックのトークン使用量を最適化するとき
title: "Cron と Heartbeat"
x-i18n:
  source_path: automation/cron-vs-heartbeat.md
  source_hash: fca1006df9d2e842
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:42:23Z
---

# Cron と Heartbeat: それぞれを使うべき場面

heartbeat と cron ジョブはいずれも、スケジュールに従ってタスクを実行できます。このガイドは、ユースケースに適した仕組みを選ぶのに役立ちます。

## クイック判断ガイド

| ユースケース                                   | 推奨                 | 理由                                         |
| ---------------------------------------------- | -------------------- | -------------------------------------------- |
| 30 分ごとに受信箱をチェック                    | Heartbeat            | 他のチェックとバッチ化でき、文脈を理解できる |
| 毎日 9 時ちょうどに日次レポートを送る          | Cron（isolated）     | 正確な時刻が必要                             |
| 予定されているイベントのためにカレンダーを監視 | Heartbeat            | 定期的な「気づき」に自然に適合               |
| 週次で詳細な分析を実行                         | Cron（isolated）     | 独立したタスクで、別のモデルを使える         |
| 20 分後にリマインドして                        | Cron（main, `--at`） | 正確なタイミングのワンショット               |
| バックグラウンドのプロジェクト健全性チェック   | Heartbeat            | 既存サイクルに相乗りできる                   |

## Heartbeat: 定期的な気づき

heartbeat は一定間隔（デフォルト: 30 分）で **メインセッション** 内で実行されます。エージェントが状況を確認し、重要なものがあれば浮上させるために設計されています。

### heartbeat を使うべきとき

- **複数の定期チェック**: 受信箱、カレンダー、天気、通知、プロジェクト状況をそれぞれ 5 本の cron ジョブでチェックする代わりに、単一の heartbeat でこれらをまとめて処理できます。
- **文脈に基づく判断**: エージェントはメインセッションの文脈を完全に保持しているため、緊急性の高いものと待てるものを賢く判別できます。
- **会話の継続性**: heartbeat 実行は同じセッションを共有するため、エージェントは直近の会話を覚えており、自然にフォローアップできます。
- **低オーバーヘッドの監視**: 1 つの heartbeat で多数の小さなポーリングタスクを置き換えられます。

### heartbeat の利点

- **複数チェックのバッチ化**: 1 回のエージェントターンで受信箱、カレンダー、通知をまとめて確認できます。
- **API 呼び出しの削減**: 単一の heartbeat は、5 本の独立した cron ジョブより安価です。
- **文脈を理解**: エージェントはあなたが何に取り組んでいるかを把握しており、それに応じて優先順位を付けられます。
- **賢い抑制**: 対応が不要であれば、エージェントは `HEARTBEAT_OK` と返信し、メッセージは配信されません。
- **自然なタイミング**: キュー負荷により多少ドリフトしますが、多くの監視用途では問題ありません。

### heartbeat の例: HEARTBEAT.md チェックリスト

```md
# Heartbeat checklist

- Check email for urgent messages
- Review calendar for events in next 2 hours
- If a background task finished, summarize results
- If idle for 8+ hours, send a brief check-in
```

エージェントは各 heartbeat ごとにこれを読み、すべての項目を 1 ターンで処理します。

### heartbeat の設定

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m", // interval
        target: "last", // where to deliver alerts
        activeHours: { start: "08:00", end: "22:00" }, // optional
      },
    },
  },
}
```

設定の詳細はこちら: [Heartbeat](/gateway/heartbeat)。

## Cron: 正確なスケジューリング

cron ジョブは **正確な時刻** に実行され、メインの文脈へ影響を与えない isolated セッションで実行できます。

### cron を使うべきとき

- **正確な時刻が必須**: 「毎週月曜の午前 9:00 に送って」（「9 時前後のどこか」ではない）。
- **独立したタスク**: 会話の文脈を必要としないタスク。
- **異なるモデル/思考**: より強力なモデルに値する重い分析。
- **ワンショットのリマインダー**: `--at` による「20 分後にリマインドして」。
- **うるさい/頻度が高いタスク**: メインセッションの履歴が散らかるタスク。
- **外部トリガー**: エージェントが他でアクティブかどうかに依存せず、独立して実行すべきタスク。

### cron の利点

- **正確な時刻**: タイムゾーン対応の 5 フィールド cron 式。
- **セッション分離**: `cron:<jobId>` で実行され、メイン履歴を汚しません。
- **モデルの上書き**: ジョブごとに安価なモデルや強力なモデルを使い分けできます。
- **配信制御**: isolated ジョブはデフォルトで `announce`（要約）です。必要に応じて `none` を選べます。
- **即時配信**: announce モードは heartbeat を待たずに直接投稿します。
- **エージェント文脈が不要**: メインセッションがアイドルまたは compact 済みでも実行されます。
- **ワンショット対応**: 正確な将来タイムスタンプには `--at` を使用します。

### cron の例: 毎朝のブリーフィング

```bash
openclaw cron add \
  --name "Morning briefing" \
  --cron "0 7 * * *" \
  --tz "America/New_York" \
  --session isolated \
  --message "Generate today's briefing: weather, calendar, top emails, news summary." \
  --model opus \
  --announce \
  --channel whatsapp \
  --to "+15551234567"
```

これはニューヨーク時間で毎日ちょうど 7:00 AM に実行され、品質のために Opus を使用し、要約を WhatsApp に直接 announce します。

### cron の例: ワンショットのリマインダー

```bash
openclaw cron add \
  --name "Meeting reminder" \
  --at "20m" \
  --session main \
  --system-event "Reminder: standup meeting starts in 10 minutes." \
  --wake now \
  --delete-after-run
```

CLI リファレンスの詳細はこちら: [Cron jobs](/automation/cron-jobs)。

## 判断フローチャート

```
Does the task need to run at an EXACT time?
  YES -> Use cron
  NO  -> Continue...

Does the task need isolation from main session?
  YES -> Use cron (isolated)
  NO  -> Continue...

Can this task be batched with other periodic checks?
  YES -> Use heartbeat (add to HEARTBEAT.md)
  NO  -> Use cron

Is this a one-shot reminder?
  YES -> Use cron with --at
  NO  -> Continue...

Does it need a different model or thinking level?
  YES -> Use cron (isolated) with --model/--thinking
  NO  -> Use heartbeat
```

## 両方を組み合わせる

最も効率的な構成は **両方** を使います。

1. **Heartbeat** はルーチンの監視（受信箱、カレンダー、通知）を 30 分ごとに 1 回のバッチ化されたターンで処理します。
2. **Cron** は正確なスケジュール（日次レポート、週次レビュー）とワンショットのリマインダーを処理します。

### 例: 効率的な自動化セットアップ

**HEARTBEAT.md**（30 分ごとにチェック）:

```md
# Heartbeat checklist

- Scan inbox for urgent emails
- Check calendar for events in next 2h
- Review any pending tasks
- Light check-in if quiet for 8+ hours
```

**cron ジョブ**（正確なタイミング）:

```bash
# Daily morning briefing at 7am
openclaw cron add --name "Morning brief" --cron "0 7 * * *" --session isolated --message "..." --announce

# Weekly project review on Mondays at 9am
openclaw cron add --name "Weekly review" --cron "0 9 * * 1" --session isolated --message "..." --model opus

# One-shot reminder
openclaw cron add --name "Call back" --at "2h" --session main --system-event "Call back the client" --wake now
```

## Lobster: 承認付きの決定的ワークフロー

Lobster は、決定的な実行と明示的な承認を必要とする **複数ステップのツールパイプライン** のためのワークフロー実行基盤です。
タスクが単一のエージェントターンを超え、人的チェックポイント付きで再開可能なワークフローが必要な場合に使用します。

### Lobster が適合する場面

- **複数ステップの自動化**: 一度きりのプロンプトではなく、固定のツール呼び出しパイプラインが必要。
- **承認ゲート**: 副作用を伴う処理は承認まで一時停止し、その後再開すべき。
- **再開可能な実行**: 以前のステップを再実行せずに、停止したワークフローを継続する。

### heartbeat と cron との組み合わせ方

- **Heartbeat/cron** は実行が _いつ_ 起きるかを決めます。
- **Lobster** は実行開始後に _どのステップ_ が起きるかを定義します。

スケジュールされたワークフローでは、cron または heartbeat でエージェントターンをトリガーし、そのターンで Lobster を呼び出します。
アドホックなワークフローでは、Lobster を直接呼び出します。

### 運用メモ（コードより）

- Lobster はツールモードで **ローカルサブプロセス**（`lobster` CLI）として実行され、**JSON エンベロープ** を返します。
- ツールが `needs_approval` を返した場合、`resumeToken` と `approve` フラグで再開します。
- ツールは **任意のプラグイン** です。`tools.alsoAllow: ["lobster"]`（推奨）で加算的に有効化します。
- `lobsterPath` を渡す場合、**絶対パス** である必要があります。

使用方法と例の詳細はこちら: [Lobster](/tools/lobster)。

## メインセッション vs isolated セッション

heartbeat と cron はどちらもメインセッションと相互作用できますが、その方法は異なります。

|            | Heartbeat                       | Cron（main）                    | Cron（isolated）            |
| ---------- | ------------------------------- | ------------------------------- | --------------------------- |
| セッション | メイン                          | メイン（system event 経由）     | `cron:<jobId>`              |
| 履歴       | 共有                            | 共有                            | 実行ごとに新規              |
| 文脈       | 完全                            | 完全                            | なし（クリーンに開始）      |
| モデル     | メインセッションモデル          | メインセッションモデル          | 上書き可能                  |
| 出力       | `HEARTBEAT_OK` でない場合に配信 | heartbeat プロンプト + イベント | announce 要約（デフォルト） |

### メインセッション cron を使うべきとき

次を満たしたい場合は、`--system-event` とともに `--session main` を使用します。

- リマインダー/イベントをメインセッション文脈に出したい
- 次の heartbeat でエージェントに完全な文脈で処理させたい
- 別の isolated 実行は不要

```bash
openclaw cron add \
  --name "Check project" \
  --every "4h" \
  --session main \
  --system-event "Time for a project health check" \
  --wake now
```

### isolated cron を使うべきとき

次を満たしたい場合は `--session isolated` を使用します。

- 事前の文脈なしのクリーンスレートが欲しい
- 別のモデルや思考設定を使いたい
- 要約をチャンネルに直接 announce したい
- メインセッションを散らかさない履歴にしたい

```bash
openclaw cron add \
  --name "Deep analysis" \
  --cron "0 6 * * 0" \
  --session isolated \
  --message "Weekly codebase analysis..." \
  --model opus \
  --thinking high \
  --announce
```

## コストに関する考慮

| 仕組み           | コスト特性                                                   |
| ---------------- | ------------------------------------------------------------ |
| Heartbeat        | N 分ごとに 1 ターン。HEARTBEAT.md のサイズに比例して増加     |
| Cron（main）     | 次の heartbeat にイベントを追加（isolated ターンなし）       |
| Cron（isolated） | ジョブごとにフルのエージェントターン。安価なモデルを利用可能 |

**ヒント**:

- トークンのオーバーヘッドを最小化するため、`HEARTBEAT.md` は小さく保ってください。
- 複数の cron ジョブではなく、類似チェックは heartbeat にバッチ化してください。
- 内部処理だけにしたい場合は、heartbeat で `target: "none"` を使用してください。
- ルーチンタスクには、安価なモデルで isolated cron を使ってください。

## 関連

- [Heartbeat](/gateway/heartbeat) - heartbeat 設定の詳細
- [Cron jobs](/automation/cron-jobs) - cron CLI と API リファレンスの詳細
- [System](/cli/system) - system event + heartbeat 制御
