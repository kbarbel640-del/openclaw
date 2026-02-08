---
summary: "OpenClaw のログ記録: ローリング診断ファイルログ + 統合ログのプライバシーフラグ"
read_when:
  - macOS のログを取得する場合、または個人データのログ記録を調査する場合
  - 音声ウェイク／セッションのライフサイクル問題をデバッグする場合
title: "macOS のログ記録"
x-i18n:
  source_path: platforms/mac/logging.md
  source_hash: c4c201d154915e0e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:22Z
---

# Logging (macOS)

## ローリング診断ファイルログ（Debug ペイン）

OpenClaw は macOS アプリのログを swift-log（既定では統合ログ）経由で出力し、耐久的な取得が必要な場合には、ローカルでローテーションするファイルログをディスクに書き出せます。

- 冗長度: **Debug pane → Logs → App logging → Verbosity**
- 有効化: **Debug pane → Logs → App logging → 「Write rolling diagnostics log (JSONL)」**
- 保存先: `~/Library/Logs/OpenClaw/diagnostics.jsonl`（自動的にローテーションされ、古いファイルには `.1`、`.2`、… の接尾辞が付きます）
- クリア: **Debug pane → Logs → App logging → 「Clear」**

注意事項:

- 既定では **無効** です。アクティブにデバッグしている間のみ有効にしてください。
- ファイルは機微情報として扱ってください。レビューなしで共有しないでください。

## macOS における統合ログのプライベートデータ

統合ログは、サブシステムが `privacy -off` にオプトインしない限り、ほとんどのペイロードをマスクします。Peter による macOS の [logging privacy shenanigans](https://steipete.me/posts/2025/logging-privacy-shenanigans)（2025 年）の解説によると、これはサブシステム名をキーとする `/Library/Preferences/Logging/Subsystems/` 内の plist によって制御されます。新規のログエントリのみがこのフラグを反映するため、問題を再現する前に有効化してください。

## OpenClaw 向けに有効化（`bot.molt`）

- まず plist を一時ファイルに書き込み、その後 root としてアトミックにインストールします:

```bash
cat <<'EOF' >/tmp/bot.molt.plist
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>DEFAULT-OPTIONS</key>
    <dict>
        <key>Enable-Private-Data</key>
        <true/>
    </dict>
</dict>
</plist>
EOF
sudo install -m 644 -o root -g wheel /tmp/bot.molt.plist /Library/Preferences/Logging/Subsystems/bot.molt.plist
```

- 再起動は不要です。logd はすぐにファイルを認識しますが、プライベートなペイロードが含まれるのは新しいログ行のみです。
- 既存のヘルパーを使って、より詳細な出力を表示できます。例: `./scripts/clawlog.sh --category WebChat --last 5m`。

## デバッグ後に無効化

- オーバーライドを削除します: `sudo rm /Library/Preferences/Logging/Subsystems/bot.molt.plist`。
- 必要に応じて `sudo log config --reload` を実行し、logd に即座にオーバーライドを破棄させます。
- このサーフェスには電話番号やメッセージ本文が含まれる可能性があります。追加の詳細が必要な間のみ plist を保持してください。
