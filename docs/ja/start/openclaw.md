---
summary: "安全上の注意を含む、OpenClaw をパーソナルアシスタントとして実行するためのエンドツーエンドガイド"
read_when:
  - 新しいアシスタントインスタンスをオンボーディングする場合
  - 安全性/権限の影響を見直す場合
title: "パーソナルアシスタントのセットアップ"
x-i18n:
  source_path: start/openclaw.md
  source_hash: 55cd0c67e5e3b28e
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:11:13Z
---

# OpenClaw でパーソナルアシスタントを構築する

OpenClaw は **Pi** エージェント向けの WhatsApp + Telegram + Discord + iMessage ゲートウェイです。プラグインで Mattermost を追加できます。このガイドは「パーソナルアシスタント」セットアップです。常時稼働のエージェントとして振る舞う、専用の WhatsApp 番号を 1 つ用意します。

## ⚠️ 安全第一

あなたはエージェントを次のような立場に置くことになります。

- （Pi のツール設定によっては）あなたのマシン上でコマンドを実行する
- ワークスペース内のファイルを読み書きする
- WhatsApp/Telegram/Discord/Mattermost（プラグイン）経由で外部へメッセージを送信する

保守的に始めてください。

- 常に `channels.whatsapp.allowFrom` を設定してください（個人の Mac をインターネットに公開した状態で運用しないでください）。
- アシスタント用に専用の WhatsApp 番号を使用してください。
- ハートビートは現在、デフォルトで 30 分ごとです。`agents.defaults.heartbeat.every: "0m"` を設定して、セットアップを信頼できるようになるまで無効化してください。

## 前提条件

- OpenClaw をインストールしてオンボード済みであること — まだの場合は [Getting Started](/start/getting-started) を参照してください
- アシスタント用の 2 つ目の電話番号（SIM/eSIM/プリペイド）

## 2 台の電話を使うセットアップ（推奨）

狙いはこれです。

```
Your Phone (personal)          Second Phone (assistant)
┌─────────────────┐           ┌─────────────────┐
│  Your WhatsApp  │  ──────▶  │  Assistant WA   │
│  +1-555-YOU     │  message  │  +1-555-ASSIST  │
└─────────────────┘           └────────┬────────┘
                                       │ linked via QR
                                       ▼
                              ┌─────────────────┐
                              │  Your Mac       │
                              │  (openclaw)      │
                              │    Pi agent     │
                              └─────────────────┘
```

個人の WhatsApp を OpenClaw にリンクすると、あなた宛てのすべてのメッセージが「エージェント入力」になります。これは多くの場合、望ましい挙動ではありません。

## 5 分クイックスタート

1. WhatsApp Web をペアリングします（QR が表示されるので、アシスタント用の電話でスキャンします）。

```bash
openclaw channels login
```

2. Gateway（ゲートウェイ）を起動します（起動したままにします）。

```bash
openclaw gateway --port 18789
```

3. `~/.openclaw/openclaw.json` に最小構成を入れます。

```json5
{
  channels: { whatsapp: { allowFrom: ["+15555550123"] } },
}
```

次に、許可リストに入れているあなたの電話から、アシスタント番号へメッセージを送ってください。

オンボーディングが完了すると、ダッシュボードを自動で開き、クリーン（トークンなし）のリンクを表示します。認証を求められた場合は、`gateway.auth.token` のトークンを Control UI 設定に貼り付けてください。後で開き直すには `openclaw dashboard` を使用します。

## エージェントにワークスペースを与える（AGENTS）

OpenClaw は、ワークスペースディレクトリから運用手順と「メモリ」を読み取ります。

デフォルトでは、OpenClaw はエージェントのワークスペースとして `~/.openclaw/workspace` を使用し、セットアップ時/最初のエージェント実行時に（スターターの `AGENTS.md`、`SOUL.md`、`TOOLS.md`、`IDENTITY.md`、`USER.md` とともに）自動作成します。`BOOTSTRAP.md` はワークスペースが完全に新規の場合にのみ作成されます（削除した後に復活すべきではありません）。

ヒント: このフォルダは OpenClaw の「記憶」として扱い、git リポジトリ（理想的にはプライベート）にしてください。そうすることで、`AGENTS.md` + メモリファイルがバックアップされます。git がインストールされている場合、真新しいワークスペースは自動で初期化されます。

```bash
openclaw setup
```

ワークスペースの完全なレイアウト + バックアップガイド: [Agent workspace](/concepts/agent-workspace)
メモリのワークフロー: [Memory](/concepts/memory)

任意: `agents.defaults.workspace` で別のワークスペースを選べます（`~` をサポートします）。

```json5
{
  agent: {
    workspace: "~/.openclaw/workspace",
  },
}
```

リポジトリから独自のワークスペースファイルをすでに配布している場合は、ブートストラップファイル作成を完全に無効化できます。

```json5
{
  agent: {
    skipBootstrap: true,
  },
}
```

## 「アシスタント」にするための設定

OpenClaw は良いアシスタント設定をデフォルトで備えていますが、通常は次を調整したくなるはずです。

- `SOUL.md` のペルソナ/指示
- （必要なら）思考のデフォルト
- （信頼できるようになったら）ハートビート

例:

```json5
{
  logging: { level: "info" },
  agent: {
    model: "anthropic/claude-opus-4-6",
    workspace: "~/.openclaw/workspace",
    thinkingDefault: "high",
    timeoutSeconds: 1800,
    // Start with 0; enable later.
    heartbeat: { every: "0m" },
  },
  channels: {
    whatsapp: {
      allowFrom: ["+15555550123"],
      groups: {
        "*": { requireMention: true },
      },
    },
  },
  routing: {
    groupChat: {
      mentionPatterns: ["@openclaw", "openclaw"],
    },
  },
  session: {
    scope: "per-sender",
    resetTriggers: ["/new", "/reset"],
    reset: {
      mode: "daily",
      atHour: 4,
      idleMinutes: 10080,
    },
  },
}
```

## セッションとメモリ

- セッションファイル: `~/.openclaw/agents/<agentId>/sessions/{{SessionId}}.jsonl`
- セッションメタデータ（トークン使用量、最後のルートなど）: `~/.openclaw/agents/<agentId>/sessions/sessions.json`（レガシー: `~/.openclaw/sessions/sessions.json`）
- `/new` または `/reset` で、そのチャットの新しいセッションを開始します（`resetTriggers` で設定可能）。単独で送信すると、エージェントはリセット確認のための短い挨拶を返します。
- `/compact [instructions]` はセッションコンテキストを圧縮し、残りのコンテキスト予算を報告します。

## ハートビート（プロアクティブモード）

デフォルトでは、OpenClaw は 30 分ごとに次のプロンプトでハートビートを実行します。
`Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.`
無効化するには `agents.defaults.heartbeat.every: "0m"` を設定します。

- `HEARTBEAT.md` が存在しても実質的に空（空行と `# Heading` のような Markdown 見出し בלבד）の場合、OpenClaw は API 呼び出しを節約するためにハートビート実行をスキップします。
- ファイルが存在しない場合でも、ハートビートは実行され、モデルが何をするかを判断します。
- エージェントが `HEARTBEAT_OK`（任意で短いパディング付き。`agents.defaults.heartbeat.ackMaxChars` を参照）で返信した場合、OpenClaw はそのハートビートの外部配信を抑制します。
- ハートビートはエージェントの 1 ターンをフルに実行します — 間隔を短くするとより多くのトークンを消費します。

```json5
{
  agent: {
    heartbeat: { every: "30m" },
  },
}
```

## メディアの送受信

受信した添付ファイル（画像/音声/ドキュメント）は、テンプレート経由でコマンドに渡せます。

- `{{MediaPath}}`（ローカルの一時ファイルパス）
- `{{MediaUrl}}`（擬似 URL）
- `{{Transcript}}`（音声の文字起こしが有効な場合）

エージェントから送信する添付ファイル: 単独の行に `MEDIA:<path-or-url>` を含めます（スペースなし）。例:

```
Here’s the screenshot.
MEDIA:https://example.com/screenshot.png
```

OpenClaw はこれらを抽出し、テキストと一緒にメディアとして送信します。

## 運用チェックリスト

```bash
openclaw status          # local status (creds, sessions, queued events)
openclaw status --all    # full diagnosis (read-only, pasteable)
openclaw status --deep   # adds gateway health probes (Telegram + Discord)
openclaw health --json   # gateway health snapshot (WS)
```

ログは `/tmp/openclaw/` 配下にあります（デフォルト: `openclaw-YYYY-MM-DD.log`）。

## 次のステップ

- WebChat: [WebChat](/web/webchat)
- Gateway（ゲートウェイ）運用: [Gateway runbook](/gateway)
- Cron + 起動: [Cron jobs](/automation/cron-jobs)
- macOS メニューバーのコンパニオン: [OpenClaw macOS app](/platforms/macos)
- iOS ノードアプリ: [iOS app](/platforms/ios)
- Android ノードアプリ: [Android app](/platforms/android)
- Windows の状況: [Windows (WSL2)](/platforms/windows)
- Linux の状況: [Linux app](/platforms/linux)
- セキュリティ: [Security](/gateway/security)
