---
summary: "cron と heartbeat のスケジューリングおよび配信をトラブルシューティングします"
read_when:
  - Cron が実行されなかった
  - Cron は実行されたがメッセージが配信されなかった
  - Heartbeat が無音、またはスキップされているように見える
title: "オートメーションのトラブルシューティング"
x-i18n:
  source_path: automation/troubleshooting.md
  source_hash: 10eca4a59119910f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:14:46Z
---

# オートメーションのトラブルシューティング

スケジューラおよび配信の問題については、このページを使用してください（`cron` + `heartbeat`）。

## コマンドラダー

```bash
openclaw status
openclaw gateway status
openclaw logs --follow
openclaw doctor
openclaw channels status --probe
```

次に、オートメーションのチェックを実行します。

```bash
openclaw cron status
openclaw cron list
openclaw system heartbeat last
```

## Cron が起動しない

```bash
openclaw cron status
openclaw cron list
openclaw cron runs --id <jobId> --limit 20
openclaw logs --follow
```

正常な出力は次のようになります。

- `cron status` が有効で、将来の `nextWakeAtMs` が報告されている。
- ジョブが有効で、有効なスケジュールおよびタイムゾーンを持っている。
- `cron runs` に `ok`、または明示的なスキップ理由が表示されている。

よくあるシグネチャ:

- `cron: scheduler disabled; jobs will not run automatically` → 設定または環境変数で cron が無効になっている。
- `cron: timer tick failed` → スケジューラの tick がクラッシュした。周辺のスタックやログのコンテキストを確認してください。
- 実行出力に `reason: not-due` → `--force` なしで手動実行が呼ばれ、ジョブの実行時刻がまだ到来していない。

## Cron は起動したが配信されない

```bash
openclaw cron runs --id <jobId> --limit 20
openclaw cron list
openclaw channels status --probe
openclaw logs --follow
```

正常な出力は次のようになります。

- 実行ステータスが `ok`。
- 分離されたジョブ向けに配信モード／ターゲットが設定されている。
- チャンネルのプローブが、対象チャンネルが接続されていると報告している。

よくあるシグネチャ:

- 実行は成功したが配信モードが `none` → 外部メッセージは期待されません。
- 配信ターゲットが欠落または無効（`channel`/`to`）→ 内部的には成功しても、外部送信はスキップされる場合があります。
- チャンネル認証エラー（`unauthorized`, `missing_scope`, `Forbidden`）→ チャンネルの資格情報または権限により配信がブロックされています。

## Heartbeat が抑制またはスキップされる

```bash
openclaw system heartbeat last
openclaw logs --follow
openclaw config get agents.defaults.heartbeat
openclaw channels status --probe
```

正常な出力は次のようになります。

- Heartbeat が有効で、ゼロ以外の間隔が設定されている。
- 最後の heartbeat 結果が `ran`（またはスキップ理由が理解できる状態）。

よくあるシグネチャ:

- `heartbeat skipped` と `reason=quiet-hours` → `activeHours` の外。
- `requests-in-flight` → メインレーンがビジーで、heartbeat が延期された。
- `empty-heartbeat-file` → `HEARTBEAT.md` は存在するが、実行可能な内容がない。
- `alerts-disabled` → 可視性設定により、外向きの heartbeat メッセージが抑制されている。

## タイムゾーンと activeHours の注意点

```bash
openclaw config get agents.defaults.heartbeat.activeHours
openclaw config get agents.defaults.heartbeat.activeHours.timezone
openclaw config get agents.defaults.userTimezone || echo "agents.defaults.userTimezone not set"
openclaw cron list
openclaw logs --follow
```

クイックルール:

- `Config path not found: agents.defaults.userTimezone` はキーが未設定であることを意味します。この場合、heartbeat はホストのタイムゾーン（または設定されていれば `activeHours.timezone`）にフォールバックします。
- `--tz` のない Cron は、ゲートウェイ ホストのタイムゾーンを使用します。
- Heartbeat の `activeHours` は、設定されたタイムゾーン解決（`user`, `local`、または明示的な IANA tz）を使用します。
- タイムゾーンなしの ISO タイムスタンプは、cron の `at` スケジュールでは UTC として扱われます。

よくあるシグネチャ:

- ホストのタイムゾーン変更後、ジョブが誤った壁時計時刻で実行される。
- `activeHours.timezone` が誤っているため、日中は常に heartbeat がスキップされる。

関連情報:

- [/automation/cron-jobs](/automation/cron-jobs)
- [/gateway/heartbeat](/gateway/heartbeat)
- [/automation/cron-vs-heartbeat](/automation/cron-vs-heartbeat)
- [/concepts/timezone](/concepts/timezone)
