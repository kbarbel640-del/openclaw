---
summary: "WhatsApp グループメッセージ処理の挙動と設定（mentionPatterns はサーフェス間で共有されます）"
read_when:
  - グループメッセージのルールやメンションを変更する場合
title: "グループメッセージ"
x-i18n:
  source_path: channels/group-messages.md
  source_hash: 181a72f12f5021af
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:14:53Z
---

# グループメッセージ（WhatsApp Web チャンネル）

目的: Clawd を WhatsApp グループに参加させ、ピンされたときだけ起動し、そのスレッドを個人の ダイレクトメッセージ セッションから分離します。

注記: `agents.list[].groupChat.mentionPatterns` は現在 Telegram/Discord/Slack/iMessage でも使用されています。本ドキュメントは WhatsApp 固有の挙動に焦点を当てています。マルチエージェント構成の場合は、エージェントごとに `agents.list[].groupChat.mentionPatterns` を設定してください（または `messages.groupChat.mentionPatterns` をグローバルなフォールバックとして使用します）。

## 実装内容（2025-12-03）

- 起動モード: `mention`（デフォルト）または `always`。`mention` はピンを必要とします（実際の WhatsApp の @ メンションを `mentionedJids` 経由で、正規表現パターン、またはテキスト内のどこかにあるボットの E.164）。`always` はすべてのメッセージでエージェントを起動しますが、有意義な価値を追加できる場合のみ返信し、それ以外はサイレントトークン `NO_REPLY` を返します。デフォルトは設定（`channels.whatsapp.groups`）で指定でき、グループごとに `/activation` で上書きできます。`channels.whatsapp.groups` を設定すると、グループの許可リストとしても機能します（すべてを許可するには `"*"` を含めます）。
- グループポリシー: `channels.whatsapp.groupPolicy` は、グループメッセージを受け付けるかどうか（`open|disabled|allowlist`）を制御します。`allowlist` は `channels.whatsapp.groupAllowFrom` を使用します（フォールバック: 明示的な `channels.whatsapp.allowFrom`）。デフォルトは `allowlist`（送信者を追加するまでブロック）です。
- グループごとのセッション: セッションキーは `agent:<agentId>:whatsapp:group:<jid>` のようになります。そのため、`/verbose on` や `/think high`（単独メッセージとして送信）のようなコマンドは、そのグループにスコープされ、個人の ダイレクトメッセージ の状態には影響しません。グループスレッドではハートビートはスキップされます。
- コンテキスト注入: 実行をトリガーしなかった **保留のみ** のグループメッセージ（デフォルト 50 件）は、`[Chat messages since your last reply - for context]` の下にプレフィックスされ、トリガーとなった行は `[Current message - respond to this]` の下に配置されます。すでにセッション内にあるメッセージは再注入されません。
- 送信者の表示: 各グループバッチの末尾に `[from: Sender Name (+E164)]` が追加され、Pi が誰が発言しているかを把握できるようになりました。
- エフェメラル／一度だけ表示: テキストやメンションを抽出する前にそれらを展開するため、その中のピンもトリガーされます。
- グループ用システムプロンプト: グループセッションの最初のターン（および `/activation` がモードを変更するたび）に、`You are replying inside the WhatsApp group "<subject>". Group members: Alice (+44...), Bob (+43...), … Activation: trigger-only … Address the specific sender noted in the message context.` のような短い文言をシステムプロンプトに注入します。メタデータが利用できない場合でも、エージェントにはグループチャットであることを伝えます。

## 設定例（WhatsApp）

WhatsApp がテキスト本文から視覚的な `@` を削除する場合でも表示名ピンが機能するように、`~/.openclaw/openclaw.json` に `groupChat` ブロックを追加します。

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

- 正規表現は大文字小文字を区別しません。`@openclaw` のような表示名ピンと、`+`／スペースの有無にかかわらない生の番号をカバーします。
- WhatsApp では、誰かが連絡先をタップすると `mentionedJids` 経由で正規のメンションが送信されるため、番号フォールバックが必要になることはまれですが、有用なセーフティネットです。

### 起動コマンド（オーナーのみ）

グループチャットコマンドを使用します。

- `/activation mention`
- `/activation always`

これを変更できるのは、オーナー番号（`channels.whatsapp.allowFrom`、未設定の場合はボット自身の E.164）のみです。現在の起動モードを確認するには、グループに `/status` を単独メッセージとして送信します。

## 使用方法

1. WhatsApp アカウント（OpenClaw を実行しているもの）をグループに追加します。
2. `@openclaw …` と発言します（または番号を含めます）。`groupPolicy: "open"` を設定しない限り、許可リストに含まれる送信者のみがトリガーできます。
3. エージェントのプロンプトには、最近のグループコンテキストと、正しい相手に対応できるよう末尾の `[from: …]` マーカーが含まれます。
4. セッションレベルの指示（`/verbose on`、`/think high`、`/new` または `/reset`、`/compact`）は、そのグループのセッションにのみ適用されます。登録されるよう、単独メッセージとして送信してください。個人の ダイレクトメッセージ セッションは独立したままです。

## テスト／検証

- 手動スモーク:
  - グループで `@openclaw` のピンを送信し、送信者名に言及した返信があることを確認します。
  - 2 回目のピンを送信し、履歴ブロックが含まれ、その次のターンでクリアされることを確認します。
- ゲートウェイのログを確認します（`--verbose` で実行）。`from: <groupJid>` と `[from: …]` サフィックスを示す `inbound web message` エントリを確認します。

## 既知の考慮事項

- グループでは、ノイズの多いブロードキャストを避けるため、ハートビートは意図的にスキップされます。
- エコー抑制は結合されたバッチ文字列を使用します。メンションなしで同一のテキストを 2 回送信した場合、応答が得られるのは最初のみです。
- セッションストアのエントリは、セッションストア（デフォルトは `~/.openclaw/agents/<agentId>/sessions/sessions.json`）内で `agent:<agentId>:whatsapp:group:<jid>` として表示されます。エントリがない場合は、そのグループがまだ実行をトリガーしていないことを意味します。
- グループ内の入力中インジケーターは `agents.defaults.typingMode` に従います（デフォルト: メンションされていない場合は `message`）。
