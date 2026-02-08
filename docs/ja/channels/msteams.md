---
summary: "Microsoft Teams ボットのサポート状況、機能、および設定"
read_when:
  - MS Teams チャンネル機能に取り組んでいるとき
title: "Microsoft Teams"
x-i18n:
  source_path: channels/msteams.md
  source_hash: 2046cb8fa3dd349f
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:49:01Z
---

# Microsoft Teams（プラグイン）

> 「ここに入る者はすべての望みを捨てよ。」

更新日: 2026-01-21

ステータス: テキスト + ダイレクトメッセージ添付はサポートされています。チャンネル/グループへのファイル送信には `sharePointSiteId` + Graph 権限が必要です（[グループチャットでのファイル送信](#sending-files-in-group-chats) を参照）。投票は Adaptive Cards 経由で送信されます。

## 必要なプラグイン

Microsoft Teams はプラグインとして提供されており、コアインストールには同梱されていません。

**破壊的変更（2026.1.15）:** MS Teams はコアから分離されました。使用する場合は、プラグインをインストールする必要があります。

説明可能: コアインストールを軽量に保ち、MS Teams の依存関係を独立して更新できるようにします。

CLI 経由でインストール（npm レジストリ）:

```bash
openclaw plugins install @openclaw/msteams
```

ローカルチェックアウト（git リポジトリから実行する場合）:

```bash
openclaw plugins install ./extensions/msteams
```

configure/オンボーディングで Teams を選択し、git チェックアウトが検出されると、
OpenClaw はローカルインストールパスを自動的に提示します。

詳細: [Plugins](/plugin)

## クイックセットアップ（初心者向け）

1. Microsoft Teams プラグインをインストールします。
2. **Azure Bot**（App ID + クライアントシークレット + テナント ID）を作成します。
3. それらの資格情報で OpenClaw を設定します。
4. 公開 URL またはトンネル経由で `/api/messages`（既定はポート 3978）を公開します。
5. Teams アプリパッケージをインストールし、Gateway（ゲートウェイ）を起動します。

最小設定:

```json5
{
  channels: {
    msteams: {
      enabled: true,
      appId: "<APP_ID>",
      appPassword: "<APP_PASSWORD>",
      tenantId: "<TENANT_ID>",
      webhook: { port: 3978, path: "/api/messages" },
    },
  },
}
```

注: グループチャットは既定でブロックされています（`channels.msteams.groupPolicy: "allowlist"`）。グループ返信を許可するには、`channels.msteams.groupAllowFrom` を設定してください（または `groupPolicy: "open"` を使用して、任意のメンバーを許可（メンション必須でゲート））。

## 目標

- Teams のダイレクトメッセージ、グループチャット、またはチャンネル経由で OpenClaw と会話します。
- ルーティングを決定的に保ちます。返信は常に到着したチャンネルに戻ります。
- 安全なチャンネル動作を既定にします（設定されていない限りメンション必須）。

## 設定書き込み

既定では、Microsoft Teams は `/config set|unset` によってトリガーされる設定更新の書き込みを許可されています（`commands.config: true` が必要です）。

次で無効化します:

```json5
{
  channels: { msteams: { configWrites: false } },
}
```

## アクセス制御（ダイレクトメッセージ + グループ）

**ダイレクトメッセージアクセス**

- 既定: `channels.msteams.dmPolicy = "pairing"`。不明な送信者は承認されるまで無視されます。
- `channels.msteams.allowFrom` は AAD オブジェクト ID、UPN、または表示名を受け付けます。ウィザードは、資格情報が許す場合に Microsoft Graph 経由で名前を ID に解決します。

**グループアクセス**

- 既定: `channels.msteams.groupPolicy = "allowlist"`（`groupAllowFrom` を追加しない限りブロック）。`channels.defaults.groupPolicy` を使用して、未設定時の既定を上書きします。
- `channels.msteams.groupAllowFrom` は、グループチャット/チャンネルでトリガーできる送信者を制御します（`channels.msteams.allowFrom` にフォールバック）。
- `groupPolicy: "open"` を設定すると任意のメンバーを許可します（既定では引き続きメンション必須でゲート）。
- **チャンネルを一切許可しない**には、`channels.msteams.groupPolicy: "disabled"` を設定します。

例:

```json5
{
  channels: {
    msteams: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["user@org.com"],
    },
  },
}
```

**Teams + チャンネル許可リスト**

- `channels.msteams.teams` の下にチームとチャンネルを列挙して、グループ/チャンネル返信のスコープを制限します。
- キーはチーム ID または名前にできます。チャンネルキーは会話 ID または名前にできます。
- `groupPolicy="allowlist"` で、かつ teams 許可リストが存在する場合、列挙されたチーム/チャンネルのみが受け付けられます（メンション必須でゲート）。
- configure ウィザードは `Team/Channel` エントリを受け付け、保存します。
- 起動時に、OpenClaw はチーム/チャンネルおよびユーザー許可リストの名前を ID に解決し（Graph 権限が許す場合）
  マッピングをログに出力します。解決できないエントリは入力どおりに保持されます。

例:

```json5
{
  channels: {
    msteams: {
      groupPolicy: "allowlist",
      teams: {
        "My Team": {
          channels: {
            General: { requireMention: true },
          },
        },
      },
    },
  },
}
```

## 仕組み

1. Microsoft Teams プラグインをインストールします。
2. **Azure Bot**（App ID + シークレット + テナント ID）を作成します。
3. ボットを参照し、以下の RSC 権限を含む **Teams アプリパッケージ**を作成します。
4. チームに Teams アプリをアップロード/インストールします（またはダイレクトメッセージ用の個人スコープ）。
5. `~/.openclaw/openclaw.json`（または環境変数）で `msteams` を設定し、Gateway（ゲートウェイ）を起動します。
6. Gateway（ゲートウェイ）は既定で `/api/messages` 上の Bot Framework webhook トラフィックをリッスンします。

## Azure Bot セットアップ（前提条件）

OpenClaw を設定する前に、Azure Bot リソースを作成する必要があります。

### 手順 1: Azure Bot を作成する

1. [Create Azure Bot](https://portal.azure.com/#create/Microsoft.AzureBot) に移動します
2. **Basics** タブを次のように入力します:

   | フィールド         | 値                                                           |
   | ------------------ | ------------------------------------------------------------ |
   | **Bot handle**     | ボット名（例: `openclaw-msteams`。一意である必要があります） |
   | **Subscription**   | Azure サブスクリプションを選択します                         |
   | **Resource group** | 新規作成または既存のものを使用                               |
   | **Pricing tier**   | 開発/テストでは **Free**                                     |
   | **Type of App**    | **Single Tenant**（推奨 - 下の注記を参照）                   |
   | **Creation type**  | **Create new Microsoft App ID**                              |

> **非推奨のお知らせ:** 新規マルチテナント ボットの作成は 2025-07-31 以降非推奨になりました。新規ボットには **Single Tenant** を使用してください。

3. **Review + create** → **Create** をクリックします（待ち時間は約 1～2 分）

### 手順 2: 資格情報を取得する

1. Azure Bot リソース → **Configuration** に移動します
2. **Microsoft App ID** をコピーします → これが `appId` です
3. **Manage Password** をクリックします → App Registration に移動します
4. **Certificates & secrets** → **New client secret** → **Value** をコピーします → これが `appPassword` です
5. **Overview** に移動します → **Directory (tenant) ID** をコピーします → これが `tenantId` です

### 手順 3: Messaging Endpoint を設定する

1. Azure Bot → **Configuration**
2. **Messaging endpoint** を webhook URL に設定します:
   - 本番: `https://your-domain.com/api/messages`
   - ローカル開発: トンネルを使用します（下の [ローカル開発](#local-development-tunneling) を参照）

### 手順 4: Teams チャンネルを有効化する

1. Azure Bot → **Channels**
2. **Microsoft Teams** → Configure → Save をクリックします
3. 利用規約に同意します

## ローカル開発（トンネリング）

Teams は `localhost` に到達できません。ローカル開発ではトンネルを使用してください:

**オプション A: ngrok**

```bash
ngrok http 3978
# Copy the https URL, e.g., https://abc123.ngrok.io
# Set messaging endpoint to: https://abc123.ngrok.io/api/messages
```

**オプション B: Tailscale Funnel**

```bash
tailscale funnel 3978
# Use your Tailscale funnel URL as the messaging endpoint
```

## Teams Developer Portal（代替手段）

manifest の ZIP を手作業で作成する代わりに、[Teams Developer Portal](https://dev.teams.microsoft.com/apps) を使用できます:

1. **+ New app** をクリックします
2. 基本情報（名前、説明、開発者情報）を入力します
3. **App features** → **Bot** に移動します
4. **Enter a bot ID manually** を選択し、Azure Bot App ID を貼り付けます
5. スコープにチェックします: **Personal**、**Team**、**Group Chat**
6. **Distribute** → **Download app package** をクリックします
7. Teams で: **Apps** → **Manage your apps** → **Upload a custom app** → ZIP を選択します

これは JSON manifest を手で編集するより簡単なことが多いです。

## ボットのテスト

**オプション A: Azure Web Chat（最初に webhook を検証）**

1. Azure Portal → Azure Bot リソース → **Test in Web Chat**
2. メッセージを送信します。応答が表示されるはずです
3. これにより、Teams のセットアップ前に webhook エンドポイントが動作していることを確認できます

**オプション B: Teams（アプリインストール後）**

1. Teams アプリをインストールします（サイドロードまたは組織カタログ）
2. Teams でボットを見つけ、ダイレクトメッセージを送ります
3. Gateway（ゲートウェイ）のログで受信アクティビティを確認します

## セットアップ（最小・テキストのみ）

1. **Microsoft Teams プラグインをインストール**
   - npm から: `openclaw plugins install @openclaw/msteams`
   - ローカルチェックアウトから: `openclaw plugins install ./extensions/msteams`

2. **ボット登録**
   - Azure Bot を作成し（上記参照）、次を控えます:
     - App ID
     - クライアントシークレット（App password）
     - テナント ID（シングルテナント）

3. **Teams アプリ manifest**
   - `botId = <App ID>` を含む `bot` エントリを含めます。
   - スコープ: `personal`、`team`、`groupChat`。
   - `supportsFiles: true`（個人スコープのファイル処理に必要）。
   - RSC 権限を追加します（下記）。
   - アイコンを作成します: `outline.png`（32x32）および `color.png`（192x192）。
   - 3 つのファイルをまとめて ZIP 化します: `manifest.json`、`outline.png`、`color.png`。

4. **OpenClaw を設定**

   ```json
   {
     "msteams": {
       "enabled": true,
       "appId": "<APP_ID>",
       "appPassword": "<APP_PASSWORD>",
       "tenantId": "<TENANT_ID>",
       "webhook": { "port": 3978, "path": "/api/messages" }
     }
   }
   ```

   設定キーの代わりに環境変数を使うこともできます:
   - `MSTEAMS_APP_ID`
   - `MSTEAMS_APP_PASSWORD`
   - `MSTEAMS_TENANT_ID`

5. **ボットエンドポイント**
   - Azure Bot の Messaging Endpoint を次に設定します:
     - `https://<host>:3978/api/messages`（または選択したパス/ポート）。

6. **Gateway（ゲートウェイ）を実行**
   - プラグインがインストールされ、`msteams` 設定が資格情報付きで存在すると、Teams チャンネルは自動的に起動します。

## 履歴コンテキスト

- `channels.msteams.historyLimit` は、直近のチャンネル/グループメッセージのうち、プロンプトにラップされる件数を制御します。
- `messages.groupChat.historyLimit` にフォールバックします。無効化するには `0` を設定します（既定 50）。
- ダイレクトメッセージの履歴は `channels.msteams.dmHistoryLimit`（ユーザーターン数）で制限できます。ユーザーごとの上書き: `channels.msteams.dms["<user_id>"].historyLimit`。

## 現在の Teams RSC 権限（manifest）

これらは Teams アプリ manifest にある **既存の resourceSpecific 権限**です。アプリがインストールされたチーム/チャット内でのみ適用されます。

**チャンネル（チームスコープ）向け:**

- `ChannelMessage.Read.Group`（Application）- @mention なしで全チャンネルメッセージを受信
- `ChannelMessage.Send.Group`（Application）
- `Member.Read.Group`（Application）
- `Owner.Read.Group`（Application）
- `ChannelSettings.Read.Group`（Application）
- `TeamMember.Read.Group`（Application）
- `TeamSettings.Read.Group`（Application）

**グループチャット向け:**

- `ChatMessage.Read.Chat`（Application）- @mention なしで全グループチャットメッセージを受信

## Teams Manifest 例（編集済み）

必要フィールドを含む、最小の有効例です。ID と URL を置き換えてください。

```json
{
  "$schema": "https://developer.microsoft.com/en-us/json-schemas/teams/v1.23/MicrosoftTeams.schema.json",
  "manifestVersion": "1.23",
  "version": "1.0.0",
  "id": "00000000-0000-0000-0000-000000000000",
  "name": { "short": "OpenClaw" },
  "developer": {
    "name": "Your Org",
    "websiteUrl": "https://example.com",
    "privacyUrl": "https://example.com/privacy",
    "termsOfUseUrl": "https://example.com/terms"
  },
  "description": { "short": "OpenClaw in Teams", "full": "OpenClaw in Teams" },
  "icons": { "outline": "outline.png", "color": "color.png" },
  "accentColor": "#5B6DEF",
  "bots": [
    {
      "botId": "11111111-1111-1111-1111-111111111111",
      "scopes": ["personal", "team", "groupChat"],
      "isNotificationOnly": false,
      "supportsCalling": false,
      "supportsVideo": false,
      "supportsFiles": true
    }
  ],
  "webApplicationInfo": {
    "id": "11111111-1111-1111-1111-111111111111"
  },
  "authorization": {
    "permissions": {
      "resourceSpecific": [
        { "name": "ChannelMessage.Read.Group", "type": "Application" },
        { "name": "ChannelMessage.Send.Group", "type": "Application" },
        { "name": "Member.Read.Group", "type": "Application" },
        { "name": "Owner.Read.Group", "type": "Application" },
        { "name": "ChannelSettings.Read.Group", "type": "Application" },
        { "name": "TeamMember.Read.Group", "type": "Application" },
        { "name": "TeamSettings.Read.Group", "type": "Application" },
        { "name": "ChatMessage.Read.Chat", "type": "Application" }
      ]
    }
  }
}
```

### manifest の注意点（必須フィールド）

- `bots[].botId` は Azure Bot の App ID と一致 **しなければなりません**。
- `webApplicationInfo.id` は Azure Bot の App ID と一致 **しなければなりません**。
- `bots[].scopes` には使用予定のサーフェス（`personal`、`team`、`groupChat`）を含める必要があります。
- `bots[].supportsFiles: true` は個人スコープでのファイル処理に必要です。
- `authorization.permissions.resourceSpecific` には、チャンネルトラフィックが必要な場合にチャンネルの read/send を含める必要があります。

### 既存アプリの更新

すでにインストール済みの Teams アプリを更新するには（例: RSC 権限の追加）:

1. `manifest.json` を新しい設定で更新します
2. **`version` フィールドをインクリメント**します（例: `1.0.0` → `1.1.0`）
3. アイコンと一緒に manifest を **再 ZIP 化**します（`manifest.json`、`outline.png`、`color.png`）
4. 新しい ZIP をアップロードします:
   - **オプション A（Teams Admin Center）:** Teams Admin Center → Teams apps → Manage apps → アプリを見つける → Upload new version
   - **オプション B（サイドロード）:** Teams → Apps → Manage your apps → Upload a custom app
5. **チームチャンネル向け:** 新しい権限を有効にするため、各チームでアプリを再インストールします
6. キャッシュされたアプリメタデータを消すため、**Teams を完全に終了して再起動**します（ウィンドウを閉じるだけでは不十分）

## 機能: RSC のみ vs Graph

### **Teams RSC のみ**の場合（アプリがインストール済み、Graph API 権限なし）

動作するもの:

- チャンネルメッセージの **テキスト**内容を読み取る。
- チャンネルメッセージの **テキスト**内容を送信する。
- **個人（ダイレクトメッセージ）** のファイル添付を受信する。

動作しないもの:

- チャンネル/グループの **画像またはファイル内容**（ペイロードには HTML スタブのみが含まれる）。
- SharePoint/OneDrive に保存された添付のダウンロード。
- メッセージ履歴の読み取り（ライブ webhook イベントを超えるもの）。

### **Teams RSC + Microsoft Graph Application 権限**の場合

追加されるもの:

- ホストされた内容（メッセージに貼り付けられた画像）のダウンロード。
- SharePoint/OneDrive に保存されたファイル添付のダウンロード。
- Graph 経由でのチャンネル/チャットメッセージ履歴の読み取り。

### RSC と Graph API の比較

| 機能                       | RSC 権限                   | Graph API                           |
| -------------------------- | -------------------------- | ----------------------------------- |
| **リアルタイムメッセージ** | はい（webhook 経由）       | いいえ（ポーリングのみ）            |
| **履歴メッセージ**         | いいえ                     | はい（履歴をクエリ可能）            |
| **セットアップの複雑さ**   | アプリ manifest のみ       | 管理者の同意 + トークンフローが必要 |
| **オフラインで動作**       | いいえ（稼働中である必要） | はい（いつでもクエリ可能）          |

**結論:** RSC はリアルタイムのリスニング用で、Graph API は履歴アクセス用です。オフライン中に見逃したメッセージへ追いつくには、`ChannelMessage.Read.All` を伴う Graph API が必要です（管理者の同意が必要）。

## Graph 有効化されたメディア + 履歴（チャンネルに必須）

**チャンネル**で画像/ファイルが必要な場合、または**メッセージ履歴**を取得したい場合は、Microsoft Graph 権限を有効にして管理者の同意を付与する必要があります。

1. Entra ID（Azure AD）**App Registration** で、Microsoft Graph **Application 権限**を追加します:
   - `ChannelMessage.Read.All`（チャンネル添付 + 履歴）
   - `Chat.Read.All` または `ChatMessage.Read.All`（グループチャット）
2. テナントに対して **管理者の同意を付与**します。
3. Teams アプリの **manifest version** を更新し、再アップロードして、**Teams にアプリを再インストール**します。
4. キャッシュされたアプリメタデータを消すため、**Teams を完全に終了して再起動**します。

## 既知の制限

### Webhook タイムアウト

Teams は HTTP webhook でメッセージを配信します。処理に時間がかかりすぎる場合（例: LLM 応答が遅い）、次が発生することがあります:

- Gateway（ゲートウェイ）のタイムアウト
- Teams によるメッセージの再試行（重複の原因）
- 返信のドロップ

OpenClaw は迅速に返却し、その後 proactive に返信を送ることで対応していますが、極端に遅い応答では問題が残る可能性があります。

### 書式

Teams の Markdown は Slack や Discord より制限があります:

- 基本的な書式は動作します: **太字**、_斜体_、`code`、リンク
- 複雑な Markdown（テーブル、ネストされたリスト）は正しくレンダリングされない場合があります
- Adaptive Cards は投票および任意のカード送信に対応しています（下記参照）

## 設定

主要設定（共有チャンネルパターンは `/gateway/configuration` を参照）:

- `channels.msteams.enabled`: チャンネルの有効/無効。
- `channels.msteams.appId`、`channels.msteams.appPassword`、`channels.msteams.tenantId`: ボット資格情報。
- `channels.msteams.webhook.port`（既定 `3978`）
- `channels.msteams.webhook.path`（既定 `/api/messages`）
- `channels.msteams.dmPolicy`: `pairing | allowlist | open | disabled`（既定: pairing）
- `channels.msteams.allowFrom`: ダイレクトメッセージ用の許可リスト（AAD オブジェクト ID、UPN、または表示名）。Graph アクセスが利用可能な場合、ウィザードがセットアップ中に名前を ID に解決します。
- `channels.msteams.textChunkLimit`: 送信テキストのチャンクサイズ。
- `channels.msteams.chunkMode`: `length`（既定）または `newline` を指定して、長さでの分割の前に空行（段落境界）で分割します。
- `channels.msteams.mediaAllowHosts`: 受信添付ホストの許可リスト（既定は Microsoft/Teams ドメイン）。
- `channels.msteams.mediaAuthAllowHosts`: メディア再試行時に Authorization ヘッダーを付与するホストの許可リスト（既定は Graph + Bot Framework ホスト）。
- `channels.msteams.requireMention`: チャンネル/グループで @mention を必須にする（既定 true）。
- `channels.msteams.replyStyle`: `thread | top-level`（[返信スタイル](#reply-style-threads-vs-posts) を参照）。
- `channels.msteams.teams.<teamId>.replyStyle`: チームごとの上書き。
- `channels.msteams.teams.<teamId>.requireMention`: チームごとの上書き。
- `channels.msteams.teams.<teamId>.tools`: チャンネル上書きがない場合に使用される、チームごとの既定ツールポリシー上書き（`allow`/`deny`/`alsoAllow`）。
- `channels.msteams.teams.<teamId>.toolsBySender`: チームごとの既定の送信者別ツールポリシー上書き（`"*"` ワイルドカード対応）。
- `channels.msteams.teams.<teamId>.channels.<conversationId>.replyStyle`: チャンネルごとの上書き。
- `channels.msteams.teams.<teamId>.channels.<conversationId>.requireMention`: チャンネルごとの上書き。
- `channels.msteams.teams.<teamId>.channels.<conversationId>.tools`: チャンネルごとのツールポリシー上書き（`allow`/`deny`/`alsoAllow`）。
- `channels.msteams.teams.<teamId>.channels.<conversationId>.toolsBySender`: チャンネルごとの送信者別ツールポリシー上書き（`"*"` ワイルドカード対応）。
- `channels.msteams.sharePointSiteId`: グループチャット/チャンネルでのファイルアップロード用の SharePoint サイト ID（[グループチャットでのファイル送信](#sending-files-in-group-chats) を参照）。

## ルーティングとセッション

- セッションキーは標準のエージェント形式に従います（[/concepts/session](/concepts/session) を参照）:
  - ダイレクトメッセージはメインセッション（`agent:<agentId>:<mainKey>`）を共有します。
  - チャンネル/グループメッセージは会話 ID を使用します:
    - `agent:<agentId>:msteams:channel:<conversationId>`
    - `agent:<agentId>:msteams:group:<conversationId>`

## 返信スタイル: Threads と Posts

Teams は最近、同じ基盤データモデル上で 2 つのチャンネル UI スタイルを導入しました:

| スタイル                | 説明                                                     | 推奨 `replyStyle` |
| ----------------------- | -------------------------------------------------------- | ----------------- |
| **Posts**（クラシック） | メッセージがカードとして表示され、下にスレッド返信が付く | `thread`（既定）  |
| **Threads**（Slack 風） | メッセージが直線的に流れ、Slack に近い                   | `top-level`       |

**問題:** Teams API は、チャンネルがどちらの UI スタイルを使用しているかを公開していません。誤った `replyStyle` を使用すると:

- Threads スタイルのチャンネルで `thread` → 返信が不自然にネストして表示される
- Posts スタイルのチャンネルで `top-level` → 返信がスレッド内ではなく別のトップレベル投稿として表示される

**解決策:** チャンネルの設定に応じて、チャンネルごとに `replyStyle` を設定します:

```json
{
  "msteams": {
    "replyStyle": "thread",
    "teams": {
      "19:abc...@thread.tacv2": {
        "channels": {
          "19:xyz...@thread.tacv2": {
            "replyStyle": "top-level"
          }
        }
      }
    }
  }
}
```

## 添付と画像

**現在の制限:**

- **ダイレクトメッセージ:** 画像とファイル添付は Teams ボットのファイル API 経由で動作します。
- **チャンネル/グループ:** 添付は M365 ストレージ（SharePoint/OneDrive）に存在します。webhook ペイロードには実ファイルのバイト列ではなく HTML スタブのみが含まれます。チャンネル添付をダウンロードするには **Graph API 権限が必要**です。

Graph 権限がない場合、画像を含むチャンネルメッセージはテキストのみとして受信されます（画像内容はボットからアクセスできません）。
既定では、OpenClaw は Microsoft/Teams のホスト名からのみメディアをダウンロードします。`channels.msteams.mediaAllowHosts` で上書きできます（任意のホストを許可するには `["*"]` を使用）。
Authorization ヘッダーは `channels.msteams.mediaAuthAllowHosts` のホストにのみ付与されます（既定は Graph + Bot Framework ホスト）。このリストは厳格に保ってください（マルチテナントのサフィックスは避けてください）。

## グループチャットでのファイル送信

ボットは組み込みの FileConsentCard フローを使用して、ダイレクトメッセージでファイルを送信できます。しかし、**グループチャット/チャンネルでのファイル送信**には追加のセットアップが必要です:

| コンテキスト                    | ファイルの送信方法                                      | 必要なセットアップ                    |
| ------------------------------- | ------------------------------------------------------- | ------------------------------------- |
| **ダイレクトメッセージ**        | FileConsentCard → ユーザーが承認 → ボットがアップロード | すぐに動作します                      |
| **グループチャット/チャンネル** | SharePoint にアップロード → リンクを共有                | `sharePointSiteId` + Graph 権限が必要 |
| **画像（任意のコンテキスト）**  | Base64 エンコードでインライン                           | すぐに動作します                      |

### グループチャットに SharePoint が必要な理由

ボットには個人の OneDrive ドライブがありません（アプリケーション ID では `/me/drive` Graph API エンドポイントが動作しません）。グループチャット/チャンネルでファイルを送信するには、ボットが **SharePoint サイト**にアップロードし、共有リンクを作成します。

### セットアップ

1. Entra ID（Azure AD）→ App Registration で **Graph API 権限**を追加します:
   - `Sites.ReadWrite.All`（Application）- SharePoint へファイルをアップロード
   - `Chat.Read.All`（Application）- 任意。ユーザー別の共有リンクを有効化

2. テナントに対して **管理者の同意を付与**します。

3. SharePoint サイト ID を取得します:

   ```bash
   # Via Graph Explorer or curl with a valid token:
   curl -H "Authorization: Bearer $TOKEN" \
     "https://graph.microsoft.com/v1.0/sites/{hostname}:/{site-path}"

   # Example: for a site at "contoso.sharepoint.com/sites/BotFiles"
   curl -H "Authorization: Bearer $TOKEN" \
     "https://graph.microsoft.com/v1.0/sites/contoso.sharepoint.com:/sites/BotFiles"

   # Response includes: "id": "contoso.sharepoint.com,guid1,guid2"
   ```

4. **OpenClaw を設定します:**
   ```json5
   {
     channels: {
       msteams: {
         // ... other config ...
         sharePointSiteId: "contoso.sharepoint.com,guid1,guid2",
       },
     },
   }
   ```

### 共有動作

| 権限                                    | 共有動作                                                   |
| --------------------------------------- | ---------------------------------------------------------- |
| `Sites.ReadWrite.All` のみ              | 組織全体の共有リンク（組織内の誰でもアクセス可能）         |
| `Sites.ReadWrite.All` + `Chat.Read.All` | ユーザー別の共有リンク（チャットメンバーのみアクセス可能） |

ユーザー別共有の方が、チャット参加者のみがファイルにアクセスできるため安全です。`Chat.Read.All` 権限がない場合、ボットは組織全体共有にフォールバックします。

### フォールバック動作

| シナリオ                                                  | 結果                                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| グループチャット + ファイル + `sharePointSiteId` 設定済み | SharePoint にアップロードし、共有リンクを送信                     |
| グループチャット + ファイル + `sharePointSiteId` なし     | OneDrive アップロードを試行（失敗する場合あり）、テキストのみ送信 |
| 個人チャット + ファイル                                   | FileConsentCard フロー（SharePoint なしで動作）                   |
| 任意のコンテキスト + 画像                                 | Base64 エンコードでインライン（SharePoint なしで動作）            |

### ファイル保存場所

アップロードされたファイルは、設定した SharePoint サイトの既定ドキュメントライブラリ内の `/OpenClawShared/` フォルダーに保存されます。

## 投票（Adaptive Cards）

OpenClaw は Teams の投票を Adaptive Cards として送信します（ネイティブの Teams 投票 API はありません）。

- CLI: `openclaw message poll --channel msteams --target conversation:<id> ...`
- 投票は Gateway（ゲートウェイ）によって `~/.openclaw/msteams-polls.json` に記録されます。
- 投票を記録するには、Gateway（ゲートウェイ）がオンラインである必要があります。
- 投票はまだ結果サマリーを自動投稿しません（必要ならストアファイルを確認してください）。

## Adaptive Cards（任意）

`message` ツールまたは CLI を使用して、任意の Adaptive Card JSON を Teams のユーザーまたは会話に送信します。

`card` パラメーターは Adaptive Card JSON オブジェクトを受け付けます。`card` が提供される場合、メッセージテキストは任意です。

**エージェントツール:**

```json
{
  "action": "send",
  "channel": "msteams",
  "target": "user:<id>",
  "card": {
    "type": "AdaptiveCard",
    "version": "1.5",
    "body": [{ "type": "TextBlock", "text": "Hello!" }]
  }
}
```

**CLI:**

```bash
openclaw message send --channel msteams \
  --target "conversation:19:abc...@thread.tacv2" \
  --card '{"type":"AdaptiveCard","version":"1.5","body":[{"type":"TextBlock","text":"Hello!"}]}'
```

カードスキーマと例については [Adaptive Cards documentation](https://adaptivecards.io/) を参照してください。ターゲット形式の詳細は、下の [ターゲット形式](#target-formats) を参照してください。

## ターゲット形式

MSTeams のターゲットは、ユーザーと会話を区別するためにプレフィックスを使用します:

| ターゲット種別             | 形式                             | 例                                                  |
| -------------------------- | -------------------------------- | --------------------------------------------------- |
| ユーザー（ID 指定）        | `user:<aad-object-id>`           | `user:40a1a0ed-4ff2-4164-a219-55518990c197`         |
| ユーザー（名前指定）       | `user:<display-name>`            | `user:John Smith`（Graph API が必要）               |
| グループ/チャンネル        | `conversation:<conversation-id>` | `conversation:19:abc123...@thread.tacv2`            |
| グループ/チャンネル（raw） | `<conversation-id>`              | `19:abc123...@thread.tacv2`（`@thread` を含む場合） |

**CLI 例:**

```bash
# Send to a user by ID
openclaw message send --channel msteams --target "user:40a1a0ed-..." --message "Hello"

# Send to a user by display name (triggers Graph API lookup)
openclaw message send --channel msteams --target "user:John Smith" --message "Hello"

# Send to a group chat or channel
openclaw message send --channel msteams --target "conversation:19:abc...@thread.tacv2" --message "Hello"

# Send an Adaptive Card to a conversation
openclaw message send --channel msteams --target "conversation:19:abc...@thread.tacv2" \
  --card '{"type":"AdaptiveCard","version":"1.5","body":[{"type":"TextBlock","text":"Hello"}]}'
```

**エージェントツール例:**

```json
{
  "action": "send",
  "channel": "msteams",
  "target": "user:John Smith",
  "message": "Hello!"
}
```

```json
{
  "action": "send",
  "channel": "msteams",
  "target": "conversation:19:abc...@thread.tacv2",
  "card": {
    "type": "AdaptiveCard",
    "version": "1.5",
    "body": [{ "type": "TextBlock", "text": "Hello" }]
  }
}
```

注: `user:` プレフィックスがない場合、名前は既定でグループ/チーム解決になります。表示名で人物をターゲットする場合は、常に `user:` を使用してください。

## proactive メッセージング

- proactive メッセージは、会話参照をその時点で保存するため、ユーザーが操作した **後** にのみ可能です。
- `dmPolicy` と許可リストによるゲートについては `/gateway/configuration` を参照してください。

## チーム ID とチャンネル ID（よくある落とし穴）

Teams URL の `groupId` クエリパラメーターは、設定で使用するチーム ID では **ありません**。代わりに URL パスから ID を抽出してください:

**チーム URL:**

```
https://teams.microsoft.com/l/team/19%3ABk4j...%40thread.tacv2/conversations?groupId=...
                                    └────────────────────────────┘
                                    Team ID (URL-decode this)
```

**チャンネル URL:**

```
https://teams.microsoft.com/l/channel/19%3A15bc...%40thread.tacv2/ChannelName?groupId=...
                                      └─────────────────────────┘
                                      Channel ID (URL-decode this)
```

**設定用:**

- チーム ID = `/team/` の後のパスセグメント（URL デコード済み、例: `19:Bk4j...@thread.tacv2`）
- チャンネル ID = `/channel/` の後のパスセグメント（URL デコード済み）
- `groupId` クエリパラメーターは **無視**してください

## プライベートチャンネル

ボットのプライベートチャンネル対応は限定的です:

| 機能                              | 標準チャンネル | プライベートチャンネル     |
| --------------------------------- | -------------- | -------------------------- |
| ボットのインストール              | はい           | 限定的                     |
| リアルタイムメッセージ（webhook） | はい           | 動作しない場合あり         |
| RSC 権限                          | はい           | 挙動が異なる場合あり       |
| @mentions                         | はい           | ボットにアクセスできる場合 |
| Graph API 履歴                    | はい           | はい（権限があれば）       |

**プライベートチャンネルが動作しない場合の回避策:**

1. ボットとのやり取りには標準チャンネルを使用します
2. ダイレクトメッセージを使用します（ユーザーは常にボットへ直接メッセージできます）
3. 履歴アクセスに Graph API を使用します（`ChannelMessage.Read.All` が必要）

## トラブルシューティング

### よくある問題

- **チャンネルで画像が表示されない:** Graph 権限または管理者の同意が不足しています。Teams アプリを再インストールし、Teams を完全に終了して再度開いてください。
- **チャンネルで応答がない:** 既定でメンションが必須です。`channels.msteams.requireMention=false` を設定するか、チーム/チャンネルごとに設定してください。
- **バージョン不一致（Teams に古い manifest が表示される）:** アプリを削除して再追加し、Teams を完全に終了して更新してください。
- **webhook から 401 Unauthorized:** Azure JWT なしで手動テストした場合は想定どおりです（エンドポイントに到達できるが認証に失敗）。Azure Web Chat を使って適切にテストしてください。

### manifest アップロードエラー

- **「Icon file cannot be empty」:** manifest が参照するアイコンファイルが 0 バイトです。有効な PNG アイコンを作成してください（`outline.png` 用 32x32、`color.png` 用 192x192）。
- **「webApplicationInfo.Id already in use」:** アプリが別のチーム/チャットにまだインストールされています。先にアンインストールするか、反映まで 5～10 分待ってください。
- **アップロード時の「Something went wrong」:** 代わりに https://admin.teams.microsoft.com からアップロードし、ブラウザーの DevTools（F12）→ Network タブを開いて、レスポンスボディで実際のエラーを確認してください。
- **サイドロード失敗:** 「Upload a custom app」ではなく「Upload an app to your org's app catalog」を試してください。これはサイドロード制限を回避できることがよくあります。

### RSC 権限が動作しない

1. `webApplicationInfo.id` がボットの App ID と完全に一致していることを確認します
2. アプリを再アップロードし、チーム/チャットに再インストールします
3. 組織の管理者が RSC 権限をブロックしていないか確認します
4. 正しいスコープを使用していることを確認します: チームは `ChannelMessage.Read.Group`、グループチャットは `ChatMessage.Read.Chat`

## 参考資料

- [Create Azure Bot](https://learn.microsoft.com/en-us/azure/bot-service/bot-service-quickstart-registration) - Azure Bot セットアップガイド
- [Teams Developer Portal](https://dev.teams.microsoft.com/apps) - Teams アプリの作成/管理
- [Teams app manifest schema](https://learn.microsoft.com/en-us/microsoftteams/platform/resources/schema/manifest-schema)
- [Receive channel messages with RSC](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/channel-messages-with-rsc)
- [RSC permissions reference](https://learn.microsoft.com/en-us/microsoftteams/platform/graph-api/rsc/resource-specific-consent)
- [Teams bot file handling](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/bots-filesv4)（チャンネル/グループには Graph が必要）
- [Proactive messaging](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/send-proactive-messages)
