---
summary: "WhatsApp グループメッセージ処理の挙動と設定（mentionPatterns はサーフェス間で共有されます）"
read_when:
  - グループメッセージのルールまたはメンションを変更する場合
title: "グループメッセージ"
x-i18n:
  source_path: concepts/group-messages.md
  source_hash: 181a72f12f5021af
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:04:07Z
---

# グループメッセージ（WhatsApp web チャンネル）

目的: Clawd を WhatsApp グループに参加させ、呼びかけられたときだけ起動し、そのスレッドを個人のダイレクトメッセージ セッションと分離して保持します。

注: `agents.list[].groupChat.mentionPatterns` は現在 Telegram/Discord/Slack/iMessage でも使用されます。本ドキュメントは WhatsApp 固有の挙動に焦点を当てます。マルチエージェント構成では、エージェントごとに `agents.list[].groupChat.mentionPatterns` を設定してください（または `messages.groupChat.mentionPatterns` をグローバルなフォールバックとして使用します）。

## 実装済み内容（2025-12-03）

- 起動モード: `mention`（デフォルト）または `always`。`mention` は ping を必要とします（`mentionedJids` による実際の WhatsApp の @ メンション、正規表現パターン、またはテキスト内のどこかにあるボットの E.164）。`always` はすべてのメッセージでエージェントを起動しますが、有意義な価値を追加できる場合にのみ返信すべきです。そうでない場合はサイレントトークン `NO_REPLY` を返します。デフォルトは設定（`channels.whatsapp.groups`）で指定でき、`/activation` によりグループ単位で上書きできます。`channels.whatsapp.groups` が設定されている場合、グループの許可リストとしても機能します（すべて許可するには `"*"` を含めます）。
- グループポリシー: `channels.whatsapp.groupPolicy` は、グループメッセージを受け付けるかどうか（`open|disabled|allowlist`）を制御します。`allowlist` は `channels.whatsapp.groupAllowFrom` を使用します（フォールバック: 明示的な `channels.whatsapp.allowFrom`）。デフォルトは `allowlist`（送信者を追加するまでブロック）です。
- グループ別セッション: セッションキーは `agent:<agentId>:whatsapp:group:<jid>` のようになります。これにより、`/verbose on` や `/think high`（単独メッセージとして送信）などのコマンドはそのグループにスコープされ、個人のダイレクトメッセージの状態は変更されません。ハートビートはグループスレッドではスキップされます。
- コンテキスト注入: 実行をトリガーしなかった **pending-only** のグループメッセージ（デフォルト 50 件）が `[Chat messages since your last reply - for context]` の下にプレフィックスされ、トリガー行は `[Current message - respond to this]` の下に入ります。すでにセッション内にあるメッセージは再注入されません。
- 送信者の露出: すべてのグループバッチは `[from: Sender Name (+E164)]` で終わるようになり、Pi が誰が話しているかを把握できます。
- 一時メッセージ/一度だけ表示: テキスト/メンションを抽出する前にそれらをアンラップするため、その中の ping もトリガーになります。
- グループ用システムプロンプト: グループセッションの最初のターン（および `/activation` がモードを変更するたび）に、`You are replying inside the WhatsApp group "<subject>". Group members: Alice (+44...), Bob (+43...), … Activation: trigger-only … Address the specific sender noted in the message context.` のような短い説明をシステムプロンプトへ注入します。メタデータが利用できない場合でも、グループチャットであることはエージェントに伝えます。

## 設定例（WhatsApp）

WhatsApp がテキスト本文内の視覚的な `@` を取り除く場合でも表示名 ping が機能するように、`~/.openclaw/openclaw.json` に `groupChat` ブロックを追加します:

```json5
{
  channels: {
    whatsapp: {
      groups: {
        "*": { requireMention: true },
      },
    },
  },
  agents: {
    list: [
      {
        id: "main",
        groupChat: {
          historyLimit: 50,
          mentionPatterns: ["@?openclaw", "\\+?15555550123"],
        },
      },
    ],
  },
}
```

注記:

- 正規表現は大文字小文字を区別しません。`@openclaw` のような表示名 ping と、`+`/スペースの有無を問わない生の番号をカバーします。
- WhatsApp は、誰かが連絡先をタップしたときに `mentionedJids` 経由で正規のメンションを引き続き送信します。そのため番号フォールバックが必要になることは稀ですが、有用なセーフティネットです。

### 起動コマンド（オーナーのみ）

次のグループチャットコマンドを使用します:

- `/activation mention`
- `/activation always`

変更できるのはオーナー番号のみです（`channels.whatsapp.allowFrom`、未設定時はボット自身の E.164）。現在の起動モードを確認するには、グループに `/status` を単独メッセージとして送信してください。

## 使い方

1. WhatsApp アカウント（OpenClaw を実行しているもの）をグループに追加します。
2. `@openclaw …` と言います（または番号を含めます）。`groupPolicy: "open"` を設定しない限り、許可リストに含まれる送信者のみがトリガーできます。
3. エージェントのプロンプトには最近のグループコンテキストに加え、末尾の `[from: …]` マーカーが含まれるため、適切な相手に向けて応答できます。
4. セッションレベルの指示（`/verbose on`、`/think high`、`/new` または `/reset`、`/compact`）は、そのグループのセッションにのみ適用されます。登録されるよう、単独メッセージとして送信してください。個人のダイレクトメッセージ セッションは独立したままです。

## テスト / 検証

- 手動スモーク:
  - グループで `@openclaw` の ping を送信し、送信者名を参照する返信を確認します。
  - 2 回目の ping を送信し、履歴ブロックが含まれていること、次のターンでクリアされることを確認します。
- Gateway（ゲートウェイ）ログ（`--verbose` で実行）を確認し、`from: <groupJid>` と `[from: …]` サフィックスを示す `inbound web message` エントリを確認します。

## 既知の考慮事項

- ハートビートは、ノイズの多いブロードキャストを避けるため、グループでは意図的にスキップされます。
- エコー抑制は結合されたバッチ文字列を使用します。メンションなしで同一テキストを 2 回送信した場合、応答されるのは 1 回目のみです。
- セッションストアのエントリは、セッションストア（デフォルトは `~/.openclaw/agents/<agentId>/sessions/sessions.json`）内で `agent:<agentId>:whatsapp:group:<jid>` のように表示されます。エントリがない場合は、そのグループがまだ実行をトリガーしていないことを意味します。
- グループでの入力中インジケーターは `agents.defaults.typingMode` に従います（デフォルト: メンションされていない場合は `message`）。
