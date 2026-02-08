---
summary: "WhatsApp（web チャンネル）統合: ログイン、受信箱、返信、メディア、運用"
read_when:
  - WhatsApp/web チャンネルの挙動や受信箱ルーティングに取り組んでいる場合
title: "WhatsApp"
x-i18n:
  source_path: channels/whatsapp.md
  source_hash: 44fd88f8e2692849
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:51:55Z
---

# WhatsApp（web チャンネル）

ステータス: Baileys 経由の WhatsApp Web のみ。Gateway（ゲートウェイ）がセッション（複数可）を所有します。

## クイックセットアップ（初心者）

1. 可能であれば **別の電話番号** を使用してください（推奨）。
2. `~/.openclaw/openclaw.json` で WhatsApp を設定します。
3. `openclaw channels login` を実行して QR コード（リンク済みデバイス）をスキャンします。
4. ゲートウェイを起動します。

最小構成:

```json5
{
  channels: {
    whatsapp: {
      dmPolicy: "allowlist",
      allowFrom: ["+15551234567"],
    },
  },
}
```

## 目標

- 1 つの Gateway（ゲートウェイ）プロセスで複数の WhatsApp アカウント（マルチアカウント）。
- 決定論的ルーティング: 返信は WhatsApp に戻り、モデルのルーティングは行いません。
- モデルが引用返信を理解できるだけのコンテキストを提示します。

## 設定の書き込み

デフォルトでは、WhatsApp は `/config set|unset` によってトリガーされる設定更新の書き込みを許可されています（`commands.config: true` が必要です）。

無効化するには:

```json5
{
  channels: { whatsapp: { configWrites: false } },
}
```

## アーキテクチャ（誰が何を所有するか）

- **Gateway（ゲートウェイ）** が Baileys ソケットと受信箱ループを所有します。
- **CLI / macOS アプリ** はゲートウェイと通信し、Baileys を直接使用しません。
- 送信（アウトバウンド）には **アクティブリスナー** が必要です。そうでない場合、送信は即座に失敗します。

## 電話番号の入手（2 つのモード）

WhatsApp は認証のために実在の携帯番号を要求します。VoIP や仮想番号は通常ブロックされます。OpenClaw を WhatsApp で動かす方法は、サポートされているものとして 2 つあります。

### 専用番号（推奨）

OpenClaw 用に **別の電話番号** を使用してください。最良の UX、クリーンなルーティング、自己チャット特有の癖がありません。理想的な構成: **予備/古い Android 端末 + eSIM**。Wi‑Fi と電源につないだままにして、QR でリンクします。

**WhatsApp Business:** 同じ端末で、別の番号の WhatsApp Business を使用できます。個人用 WhatsApp を分離したい場合に最適です。WhatsApp Business をインストールし、そこで OpenClaw 用番号を登録してください。

**サンプル設定（専用番号、単一ユーザー許可リスト）:**

```json5
{
  channels: {
    whatsapp: {
      dmPolicy: "allowlist",
      allowFrom: ["+15551234567"],
    },
  },
}
```

**ペアリングモード（任意）:**
許可リストではなくペアリングにしたい場合は、`channels.whatsapp.dmPolicy` を `pairing` に設定します。不明な送信者にはペアリングコードが返され、次で承認します:
`openclaw pairing approve whatsapp <code>`

### 個人番号（フォールバック）

クイックなフォールバック: **自分の番号** で OpenClaw を実行します。連絡先にスパムしないよう、テストは自分自身へのメッセージ（WhatsApp の「Message yourself」）で行ってください。セットアップや実験中は、メインの携帯で認証コードを読む必要があることを想定してください。**自己チャットモードを有効化する必要があります。**
ウィザードが個人の WhatsApp 番号を尋ねたら、アシスタント番号ではなく、メッセージを送る側（所有者/送信者）の電話番号を入力してください。

**サンプル設定（個人番号、自己チャット）:**

```json
{
  "whatsapp": {
    "selfChatMode": true,
    "dmPolicy": "allowlist",
    "allowFrom": ["+15551234567"]
  }
}
```

自己チャットの返信は、`messages.responsePrefix` が未設定の場合、設定時はデフォルトで `[{identity.name}]`（それ以外は `[openclaw]`）になります。カスタマイズまたは無効化するには明示的に設定してください
（削除するには `""` を使用します）。

### 番号調達のヒント

- 自国の携帯キャリアの **ローカル eSIM**（最も信頼性が高い）
  - オーストリア: [hot.at](https://www.hot.at)
  - 英国: [giffgaff](https://www.giffgaff.com) — 無料 SIM、契約不要
- **プリペイド SIM** — 安価で、認証用に SMS を 1 通受信できれば十分です

**避ける:** TextNow、Google Voice、ほとんどの「無料 SMS」サービス — WhatsApp はこれらを積極的にブロックします。

**ヒント:** 必要なのは認証 SMS を 1 通受け取ることだけです。その後は、WhatsApp Web セッションは `creds.json` を通じて維持されます。

## Twilio を使わない理由

- 初期の OpenClaw ビルドは Twilio の WhatsApp Business 統合をサポートしていました。
- WhatsApp Business 番号はパーソナルアシスタントには不向きです。
- Meta は 24 時間の返信ウィンドウを強制します。直近 24 時間に返信していない場合、ビジネス番号は新規メッセージを開始できません。
- 大量送信や「おしゃべり」な利用は、ビジネスアカウントがパーソナルアシスタントのメッセージを何十通も送る用途を想定していないため、積極的なブロックを引き起こします。
- 結果: 配信が不安定でブロックが頻発するため、サポートを削除しました。

## ログイン + 認証情報

- ログインコマンド: `openclaw channels login`（リンク済みデバイスでの QR）。
- マルチアカウントログイン: `openclaw channels login --account <id>`（`<id>` = `accountId`）。
- デフォルトアカウント（`--account` を省略した場合）: `default` があればそれ、なければ設定済みアカウント id（ソート順）の先頭。
- 認証情報は `~/.openclaw/credentials/whatsapp/<accountId>/creds.json` に保存されます。
- バックアップコピーは `creds.json.bak`（破損時に復元）。
- レガシー互換: 古いインストールでは Baileys ファイルを直接 `~/.openclaw/credentials/` に保存していました。
- ログアウト: `openclaw channels logout`（または `--account <id>`）で WhatsApp の認証状態を削除します（共有の `oauth.json` は保持）。
- ログアウト済みソケット => 再リンクを指示するエラーになります。

## 受信フロー（ダイレクトメッセージ + グループ）

- WhatsApp イベントは `messages.upsert`（Baileys）から来ます。
- テスト/再起動でイベントハンドラが蓄積しないよう、シャットダウン時に受信箱リスナーはデタッチされます。
- ステータス/ブロードキャストのチャットは無視されます。
- ダイレクトチャットは E.164、グループはグループ JID を使用します。
- **ダイレクトメッセージポリシー**: `channels.whatsapp.dmPolicy` がダイレクトチャットのアクセスを制御します（デフォルト: `pairing`）。
  - ペアリング: 不明な送信者にはペアリングコードを返します（`openclaw pairing approve whatsapp <code>` で承認。コードは 1 時間で期限切れ）。
  - オープン: `channels.whatsapp.allowFrom` に `"*"` を含める必要があります。
  - リンク済みの WhatsApp 番号は暗黙に信頼されるため、自己メッセージは `channels.whatsapp.dmPolicy` と `channels.whatsapp.allowFrom` のチェックをスキップします。

### 個人番号モード（フォールバック）

OpenClaw を **個人の WhatsApp 番号** で実行する場合は、`channels.whatsapp.selfChatMode` を有効にしてください（上記のサンプル参照）。

挙動:

- アウトバウンドのダイレクトメッセージはペアリング返信を決してトリガーしません（連絡先へのスパム防止）。
- 受信した不明な送信者は引き続き `channels.whatsapp.dmPolicy` に従います。
- 自己チャットモード（allowFrom に自分の番号を含める）では自動既読送信を回避し、メンション JID を無視します。
- 自己チャット以外のダイレクトメッセージには既読が送信されます。

## 既読（Read receipts）

デフォルトでは、ゲートウェイは受理した受信 WhatsApp メッセージを既読（青いチェック）にします。

グローバルに無効化:

```json5
{
  channels: { whatsapp: { sendReadReceipts: false } },
}
```

アカウントごとに無効化:

```json5
{
  channels: {
    whatsapp: {
      accounts: {
        personal: { sendReadReceipts: false },
      },
    },
  },
}
```

注記:

- 自己チャットモードでは常に既読をスキップします。

## WhatsApp FAQ: メッセージ送信 + ペアリング

**WhatsApp をリンクすると OpenClaw がランダムな連絡先にメッセージしますか?**  
いいえ。デフォルトのダイレクトメッセージポリシーは **ペアリング** のため、不明な送信者はペアリングコードのみを受け取り、そのメッセージは **処理されません**。OpenClaw が返信するのは、受信したチャット、または（agent/CLI で）明示的にトリガーした送信のみです。

**WhatsApp のペアリングはどのように機能しますか?**  
ペアリングは、不明な送信者に対するダイレクトメッセージのゲートです:

- 新規送信者からの最初のダイレクトメッセージには短いコードが返されます（メッセージは処理されません）。
- 次で承認します: `openclaw pairing approve whatsapp <code>`（一覧は `openclaw pairing list whatsapp`）。
- コードは 1 時間で期限切れになります。保留中リクエストはチャンネルあたり 3 件までです。

**1 つの WhatsApp 番号で、複数人が別々の OpenClaw インスタンスを使えますか?**  
はい。`bindings` で送信者ごとに別のエージェントへルーティングできます（peer `kind: "dm"`、送信者 E.164 は `+15551234567` のような形式）。返信は **同じ WhatsApp アカウント** から行われ、ダイレクトチャットは各エージェントのメインセッションに集約されるため、**1 人につき 1 エージェント** を使用してください。ダイレクトメッセージのアクセス制御（`dmPolicy`/`allowFrom`）は WhatsApp アカウントごとにグローバルです。[Multi-Agent Routing](/concepts/multi-agent) を参照してください。

**なぜウィザードで電話番号を尋ねるのですか?**  
ウィザードはそれを使って、あなた自身のダイレクトメッセージが許可されるよう **許可リスト/オーナー** を設定します。自動送信には使用されません。個人の WhatsApp 番号で実行する場合は同じ番号を使い、`channels.whatsapp.selfChatMode` を有効にしてください。

## メッセージ正規化（モデルが見るもの）

- `Body` はエンベロープ付きの現在のメッセージ本文です。
- 引用返信のコンテキストは **常に追記** されます:
  ```
  [Replying to +1555 id:ABC123]
  <quoted text or <media:...>>
  [/Replying]
  ```
- 返信メタデータも設定されます:
  - `ReplyToId` = stanzaId
  - `ReplyToBody` = 引用本文またはメディアのプレースホルダー
  - `ReplyToSender` = 判明している場合は E.164
- メディアのみの受信メッセージはプレースホルダーを使用します:
  - `<media:image|video|audio|document|sticker>`

## グループ

- グループは `agent:<agentId>:whatsapp:group:<jid>` セッションにマップされます。
- グループポリシー: `channels.whatsapp.groupPolicy = open|disabled|allowlist`（デフォルト `allowlist`）。
- 有効化モード:
  - `mention`（デフォルト）: @メンションまたは正規表現一致が必要です。
  - `always`: 常にトリガーされます。
- `/activation mention|always` はオーナー専用で、単独メッセージとして送信する必要があります。
- オーナー = `channels.whatsapp.allowFrom`（未設定の場合は self の E.164）。
- **履歴注入**（保留中のみ）:
  - 最近の _未処理_ メッセージ（デフォルト 50 件）は次の下に挿入されます:
    `[Chat messages since your last reply - for context]`（すでにセッション内にあるメッセージは再注入されません）
  - 現在のメッセージは次の下:
    `[Current message - respond to this]`
  - 送信者サフィックスを付与: `[from: Name (+E164)]`
- グループメタデータは 5 分間キャッシュされます（件名 + 参加者）。

## 返信配信（スレッディング）

- WhatsApp Web は標準メッセージを送信します（現在のゲートウェイでは引用返信のスレッディングはありません）。
- 返信タグはこのチャンネルでは無視されます。

## 受領リアクション（受信時の自動リアクション）

WhatsApp は、ボットが返信を生成する前に、受信メッセージへ即座に絵文字リアクションを自動送信できます。これにより、メッセージが受領されたことをユーザーへ即時フィードバックできます。

**設定:**

```json
{
  "whatsapp": {
    "ackReaction": {
      "emoji": "👀",
      "direct": true,
      "group": "mentions"
    }
  }
}
```

**オプション:**

- `emoji`（string）: 受領に使用する絵文字（例: 「👀」「✅」「📨」）。空または省略 = 機能無効。
- `direct`（boolean、デフォルト: `true`）: ダイレクト/ダイレクトメッセージのチャットでリアクションを送信します。
- `group`（string、デフォルト: `"mentions"`）: グループチャットの挙動:
  - `"always"`: すべてのグループメッセージにリアクション（@メンションなしでも）
  - `"mentions"`: ボットが @メンションされた場合のみリアクション
  - `"never"`: グループではリアクションしない

**アカウントごとの上書き:**

```json
{
  "whatsapp": {
    "accounts": {
      "work": {
        "ackReaction": {
          "emoji": "✅",
          "direct": false,
          "group": "always"
        }
      }
    }
  }
}
```

**挙動メモ:**

- リアクションは、タイピングインジケーターやボット返信より前に、メッセージ受領 **直後** に送信されます。
- `requireMention: false`（有効化: 常時）のグループでは、`group: "mentions"` は（@メンションだけでなく）すべてのメッセージにリアクションします。
- Fire-and-forget: リアクション失敗はログに記録されますが、ボットの返信を妨げません。
- グループのリアクションには参加者 JID が自動的に含まれます。
- WhatsApp は `messages.ackReaction` を無視します。代わりに `channels.whatsapp.ackReaction` を使用してください。

## エージェントツール（リアクション）

- ツール: `whatsapp` を `react` アクション（`chatJid`、`messageId`、`emoji`、任意で `remove`）で使用します。
- 任意: `participant`（グループ送信者）、`fromMe`（自分のメッセージへのリアクション）、`accountId`（マルチアカウント）。
- リアクション削除のセマンティクス: [/tools/reactions](/tools/reactions) を参照してください。
- ツールのゲーティング: `channels.whatsapp.actions.reactions`（デフォルト: 有効）。

## 制限

- アウトバウンドテキストは `channels.whatsapp.textChunkLimit` にチャンク化されます（デフォルト 4000）。
- 任意の改行チャンク化: `channels.whatsapp.chunkMode="newline"` を設定すると、長さによるチャンク化の前に空行（段落境界）で分割します。
- 受信メディア保存は `channels.whatsapp.mediaMaxMb` で上限が設定されます（デフォルト 50 MB）。
- アウトバウンドのメディア項目は `agents.defaults.mediaMaxMb` で上限が設定されます（デフォルト 5 MB）。

## アウトバウンド送信（テキスト + メディア）

- アクティブな web リスナーを使用します。ゲートウェイが動作していない場合はエラーになります。
- テキストチャンク化: メッセージあたり最大 4k（`channels.whatsapp.textChunkLimit`、任意で `channels.whatsapp.chunkMode` で設定可能）。
- メディア:
  - 画像/動画/音声/ドキュメントをサポートします。
  - 音声は PTT として送信されます。`audio/ogg` => `audio/ogg; codecs=opus`。
  - キャプションは最初のメディア項目にのみ付与されます。
  - メディア取得は HTTP(S) とローカルパスをサポートします。
  - アニメ GIF: WhatsApp はインラインループのために `gifPlayback: true` を持つ MP4 を期待します。
    - CLI: `openclaw message send --media <mp4> --gif-playback`
    - Gateway（ゲートウェイ）: `send` の params に `gifPlayback: true` を含めます

## ボイスノート（PTT 音声）

WhatsApp は音声を **ボイスノート**（PTT バブル）として送信します。

- 最良の結果: OGG/Opus。OpenClaw は `audio/ogg` を `audio/ogg; codecs=opus` に書き換えます。
- `[[audio_as_voice]]` は WhatsApp では無視されます（音声はすでにボイスノートとして送られます）。

## メディア制限 + 最適化

- デフォルトのアウトバウンド上限: 5 MB（メディア項目あたり）。
- 上書き: `agents.defaults.mediaMaxMb`。
- 画像は上限以下になるよう JPEG に自動最適化されます（リサイズ + 品質スイープ）。
- サイズ超過メディア => エラー。メディア返信はテキスト警告にフォールバックします。

## ハートビート

- **Gateway（ゲートウェイ）ハートビート** は接続ヘルスをログ出力します（`web.heartbeatSeconds`、デフォルト 60 秒）。
- **エージェントハートビート** はエージェントごとに `agents.list[].heartbeat`、またはグローバルに
  `agents.defaults.heartbeat` で設定できます（エージェントごとのエントリがない場合のフォールバック）。
  - 設定されたハートビートプロンプト（デフォルト: `Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.`）+ `HEARTBEAT_OK` のスキップ挙動を使用します。
  - 配信先はデフォルトで最後に使用したチャンネル（または設定済みターゲット）です。

## 再接続の挙動

- バックオフポリシー: `web.reconnect`:
  - `initialMs`、`maxMs`、`factor`、`jitter`、`maxAttempts`。
- maxAttempts に到達すると web モニタリングは停止します（劣化状態）。
- ログアウト済み => 停止し、再リンクが必要です。

## 設定クイックマップ

- `channels.whatsapp.dmPolicy`（ダイレクトメッセージポリシー: pairing/allowlist/open/disabled）。
- `channels.whatsapp.selfChatMode`（同一端末セットアップ; ボットは個人の WhatsApp 番号を使用します）。
- `channels.whatsapp.allowFrom`（ダイレクトメッセージ許可リスト）。WhatsApp は E.164 電話番号を使用します（ユーザー名はありません）。
- `channels.whatsapp.mediaMaxMb`（受信メディア保存上限）。
- `channels.whatsapp.ackReaction`（受信時の自動リアクション: `{emoji, direct, group}`）。
- `channels.whatsapp.accounts.<accountId>.*`（アカウントごとの設定 + 任意で `authDir`）。
- `channels.whatsapp.accounts.<accountId>.mediaMaxMb`（アカウントごとの受信メディア上限）。
- `channels.whatsapp.accounts.<accountId>.ackReaction`（アカウントごとの受領リアクション上書き）。
- `channels.whatsapp.groupAllowFrom`（グループ送信者許可リスト）。
- `channels.whatsapp.groupPolicy`（グループポリシー）。
- `channels.whatsapp.historyLimit` / `channels.whatsapp.accounts.<accountId>.historyLimit`（グループ履歴コンテキスト; `0` で無効化）。
- `channels.whatsapp.dmHistoryLimit`（ユーザーターン単位のダイレクトメッセージ履歴上限）。ユーザーごとの上書き: `channels.whatsapp.dms["<phone>"].historyLimit`。
- `channels.whatsapp.groups`（グループ許可リスト + メンションゲーティングのデフォルト; 全許可には `"*"` を使用）
- `channels.whatsapp.actions.reactions`（WhatsApp ツールリアクションのゲート）。
- `agents.list[].groupChat.mentionPatterns`（または `messages.groupChat.mentionPatterns`）
- `messages.groupChat.historyLimit`
- `channels.whatsapp.messagePrefix`（受信プレフィックス; アカウントごと: `channels.whatsapp.accounts.<accountId>.messagePrefix`; 非推奨: `messages.messagePrefix`）
- `messages.responsePrefix`（送信プレフィックス）
- `agents.defaults.mediaMaxMb`
- `agents.defaults.heartbeat.every`
- `agents.defaults.heartbeat.model`（任意の上書き）
- `agents.defaults.heartbeat.target`
- `agents.defaults.heartbeat.to`
- `agents.defaults.heartbeat.session`
- `agents.list[].heartbeat.*`（エージェントごとの上書き）
- `session.*`（scope, idle, store, mainKey）
- `web.enabled`（false の場合にチャンネル起動を無効化）
- `web.heartbeatSeconds`
- `web.reconnect.*`

## ログ + トラブルシューティング

- サブシステム: `whatsapp/inbound`、`whatsapp/outbound`、`web-heartbeat`、`web-reconnect`。
- ログファイル: `/tmp/openclaw/openclaw-YYYY-MM-DD.log`（設定可能）。
- トラブルシューティングガイド: [Gateway troubleshooting](/gateway/troubleshooting)。

## トラブルシューティング（クイック）

**未リンク / QR ログインが必要**

- 症状: `channels status` が `linked: false` を表示する、または「Not linked」と警告します。
- 対処: ゲートウェイホストで `openclaw channels login` を実行し、QR をスキャンします（WhatsApp → Settings → Linked Devices）。

**リンク済みだが切断 / 再接続ループ**

- 症状: `channels status` が `running, disconnected` を表示する、または「Linked but disconnected」と警告します。
- 対処: `openclaw doctor`（またはゲートウェイを再起動）。解消しない場合は `channels login` で再リンクし、`openclaw logs --follow` を確認してください。

**Bun ランタイム**

- Bun は **推奨されません**。WhatsApp（Baileys）と Telegram は Bun 上で不安定です。
  ゲートウェイは **Node** で実行してください。（Getting Started のランタイム注記を参照。）
