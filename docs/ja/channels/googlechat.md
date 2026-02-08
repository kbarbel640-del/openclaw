---
summary: "Google Chat アプリのサポート状況、機能、および設定"
read_when:
  - Google Chat チャンネル機能に取り組んでいるとき
title: "Google Chat"
x-i18n:
  source_path: channels/googlechat.md
  source_hash: 3b2bb116cdd12614
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:43:55Z
---

# Google Chat（Chat API）

ステータス: Google Chat API Webhook（HTTP のみ）経由で、ダイレクトメッセージ + スペースに対応（準備完了）。

## クイックセットアップ（初心者）

1. Google Cloud プロジェクトを作成し、**Google Chat API** を有効化します。
   - 次へ移動します: [Google Chat API Credentials](https://console.cloud.google.com/apis/api/chat.googleapis.com/credentials)
   - まだ有効化されていない場合は、API を有効化します。
2. **サービスアカウント** を作成します:
   - **認証情報を作成** > **サービス アカウント** を押します。
   - 好きな名前を付けます（例: `openclaw-chat`）。
   - 権限は空のままにします（**続行** を押します）。
   - アクセス権を持つプリンシパルは空のままにします（**完了** を押します）。
3. **JSON キー** を作成してダウンロードします:
   - サービスアカウントの一覧で、作成したばかりのものをクリックします。
   - **鍵** タブへ移動します。
   - **鍵を追加** > **新しい鍵を作成** をクリックします。
   - **JSON** を選択して **作成** を押します。
4. ダウンロードした JSON ファイルを Gateway（ゲートウェイ）ホストに保存します（例: `~/.openclaw/googlechat-service-account.json`）。
5. [Google Cloud Console Chat Configuration](https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat) で Google Chat アプリを作成します:
   - **アプリケーション情報** を入力します:
     - **アプリ名**:（例: `OpenClaw`）
     - **アバター URL**:（例: `https://openclaw.ai/logo.png`）
     - **説明**:（例: `Personal AI Assistant`）
   - **インタラクティブ機能** を有効化します。
   - **機能** の下で、**スペースとグループ会話に参加** にチェックします。
   - **接続設定** の下で、**HTTP エンドポイント URL** を選択します。
   - **トリガー** の下で、**すべてのトリガーに共通の HTTP エンドポイント URL を使用** を選択し、Gateway（ゲートウェイ）の公開 URL の末尾に `/googlechat` を付けたものを設定します。
     - _ヒント: `openclaw status` を実行して、Gateway（ゲートウェイ）の公開 URL を見つけてください。_
   - **公開設定** の下で、**この Chat アプリを &lt;Your Domain&gt; 内の特定のユーザーとグループに利用可能にする** にチェックします。
   - テキストボックスにメールアドレス（例: `user@example.com`）を入力します。
   - 下部の **保存** をクリックします。
6. **アプリのステータスを有効化** します:
   - 保存後、**ページを更新** します。
   - **アプリのステータス** セクションを探します（通常、保存後に上部または下部付近に表示されます）。
   - ステータスを **公開 - ユーザーが利用可能** に変更します。
   - もう一度 **保存** をクリックします。
7. OpenClaw を、サービスアカウントのパス + Webhook オーディエンスで設定します:
   - Env: `GOOGLE_CHAT_SERVICE_ACCOUNT_FILE=/path/to/service-account.json`
   - または config: `channels.googlechat.serviceAccountFile: "/path/to/service-account.json"`。
8. Webhook オーディエンスタイプ + 値（Chat アプリ設定と一致）を設定します。
9. Gateway（ゲートウェイ）を起動します。Google Chat は Webhook パスへ POST します。

## Google Chat に追加

Gateway（ゲートウェイ）が稼働していて、公開設定リストにメールアドレスが追加されている場合:

1. [Google Chat](https://chat.google.com/) に移動します。
2. **ダイレクトメッセージ** の横にある **+**（プラス）アイコンをクリックします。
3. 検索バー（通常、人を追加する場所）に、Google Cloud Console で設定した **アプリ名** を入力します。
   - **注**: このボットはプライベートアプリのため、「Marketplace」の参照リストには表示されません。名前で検索する必要があります。
4. 結果からボットを選択します。
5. **追加** または **チャット** をクリックして 1:1 の会話を開始します。
6. 「Hello」を送信してアシスタントを起動します。

## 公開 URL（Webhook のみ）

Google Chat Webhook には公開された HTTPS エンドポイントが必要です。セキュリティのため、インターネットに公開するのは **`/googlechat` パスのみ** にしてください。OpenClaw ダッシュボードやその他の機微なエンドポイントは、プライベートネットワーク上に置いてください。

### オプション A: Tailscale Funnel（推奨）

プライベートダッシュボードには Tailscale Serve、公開 Webhook パスには Funnel を使用します。これにより `/` をプライベートに保ちつつ、`/googlechat` のみを公開します。

1. **Gateway（ゲートウェイ）がどのアドレスにバインドされているか確認します:**

   ```bash
   ss -tlnp | grep 18789
   ```

   IP アドレス（例: `127.0.0.1`、`0.0.0.0`、または `100.x.x.x` のような Tailscale IP）をメモします。

2. **ダッシュボードを tailnet のみに公開します（ポート 8443）:**

   ```bash
   # If bound to localhost (127.0.0.1 or 0.0.0.0):
   tailscale serve --bg --https 8443 http://127.0.0.1:18789

   # If bound to Tailscale IP only (e.g., 100.106.161.80):
   tailscale serve --bg --https 8443 http://100.106.161.80:18789
   ```

3. **Webhook パスのみを公開します:**

   ```bash
   # If bound to localhost (127.0.0.1 or 0.0.0.0):
   tailscale funnel --bg --set-path /googlechat http://127.0.0.1:18789/googlechat

   # If bound to Tailscale IP only (e.g., 100.106.161.80):
   tailscale funnel --bg --set-path /googlechat http://100.106.161.80:18789/googlechat
   ```

4. **Funnel アクセス用にノードを承認します:**
   プロンプトが表示された場合、出力に表示される承認 URL にアクセスして、tailnet ポリシーでこのノードの Funnel を有効化します。

5. **設定を検証します:**
   ```bash
   tailscale serve status
   tailscale funnel status
   ```

公開 Webhook URL は次のとおりです:
`https://<node-name>.<tailnet>.ts.net/googlechat`

プライベートダッシュボードは tailnet のみのままです:
`https://<node-name>.<tailnet>.ts.net:8443/`

Google Chat アプリ設定では、公開 URL（`:8443` なし）を使用してください。

> 注: この設定は再起動後も保持されます。後で削除するには、`tailscale funnel reset` と `tailscale serve reset` を実行します。

### オプション B: リバースプロキシ（Caddy）

Caddy のようなリバースプロキシを使う場合は、特定のパスのみをプロキシしてください:

```caddy
your-domain.com {
    reverse_proxy /googlechat* localhost:18789
}
```

この設定では、`your-domain.com/` へのリクエストは無視されるか 404 を返し、`your-domain.com/googlechat` は安全に OpenClaw へルーティングされます。

### オプション C: Cloudflare Tunnel

トンネルの ingress ルールを設定し、Webhook パスのみをルーティングします:

- **Path**: `/googlechat` -> `http://localhost:18789/googlechat`
- **Default Rule**: HTTP 404（Not Found）

## 仕組み

1. Google Chat は Gateway（ゲートウェイ）に Webhook の POST を送信します。各リクエストには `Authorization: Bearer <token>` ヘッダーが含まれます。
2. OpenClaw は、設定された `audienceType` + `audience` に対してトークンを検証します:
   - `audienceType: "app-url"` → オーディエンスは HTTPS の Webhook URL です。
   - `audienceType: "project-number"` → オーディエンスは Cloud プロジェクト番号です。
3. メッセージはスペースごとにルーティングされます:
   - ダイレクトメッセージはセッションキー `agent:<agentId>:googlechat:dm:<spaceId>` を使用します。
   - スペースはセッションキー `agent:<agentId>:googlechat:group:<spaceId>` を使用します。
4. ダイレクトメッセージのアクセスは、デフォルトでペアリングです。不明な送信者はペアリングコードを受け取り、次で承認します:
   - `openclaw pairing approve googlechat <code>`
5. グループスペースは、デフォルトで @ メンションが必要です。メンション検出にアプリのユーザー名が必要な場合は `botUser` を使用してください。

## ターゲット

配信および許可リストには、これらの識別子を使用します:

- ダイレクトメッセージ: `users/<userId>` または `users/<email>`（メールアドレスも受け付けます）。
- スペース: `spaces/<spaceId>`。

## 設定の要点

```json5
{
  channels: {
    googlechat: {
      enabled: true,
      serviceAccountFile: "/path/to/service-account.json",
      audienceType: "app-url",
      audience: "https://gateway.example.com/googlechat",
      webhookPath: "/googlechat",
      botUser: "users/1234567890", // optional; helps mention detection
      dm: {
        policy: "pairing",
        allowFrom: ["users/1234567890", "name@example.com"],
      },
      groupPolicy: "allowlist",
      groups: {
        "spaces/AAAA": {
          allow: true,
          requireMention: true,
          users: ["users/1234567890"],
          systemPrompt: "Short answers only.",
        },
      },
      actions: { reactions: true },
      typingIndicator: "message",
      mediaMaxMb: 20,
    },
  },
}
```

注記:

- サービスアカウント認証情報は、`serviceAccount`（JSON 文字列）でインライン指定することもできます。
- `webhookPath` が設定されていない場合、デフォルトの Webhook パスは `/googlechat` です。
- `actions.reactions` が有効な場合、リアクションは `reactions` ツールおよび `channels action` で利用できます。
- `typingIndicator` は `none`、`message`（デフォルト）、`reaction`（リアクションにはユーザー OAuth が必要）をサポートします。
- 添付ファイルは Chat API 経由でダウンロードされ、メディアパイプラインに保存されます（サイズは `mediaMaxMb` により上限設定されます）。

## トラブルシューティング

### 405 Method Not Allowed

Google Cloud Logs Explorer に次のようなエラーが表示される場合:

```
status code: 405, reason phrase: HTTP error response: HTTP/1.1 405 Method Not Allowed
```

これは Webhook ハンドラーが登録されていないことを意味します。よくある原因:

1. **チャンネルが未設定**: 設定に `channels.googlechat` セクションがありません。次で確認します:

   ```bash
   openclaw config get channels.googlechat
   ```

   「Config path not found」と返る場合、設定を追加してください（[設定の要点](#config-highlights) を参照）。

2. **プラグインが無効**: プラグイン状態を確認します:

   ```bash
   openclaw plugins list | grep googlechat
   ```

   「disabled」と表示される場合、設定に `plugins.entries.googlechat.enabled: true` を追加してください。

3. **Gateway（ゲートウェイ）を再起動していない**: 設定を追加した後、Gateway（ゲートウェイ）を再起動します:
   ```bash
   openclaw gateway restart
   ```

チャンネルが稼働していることを確認します:

```bash
openclaw channels status
# Should show: Google Chat default: enabled, configured, ...
```

### その他の問題

- 認証エラーまたはオーディエンス設定の不足については、`openclaw channels status --probe` を確認してください。
- メッセージが届かない場合は、Chat アプリの Webhook URL + イベント購読を確認してください。
- メンションゲートが返信をブロックする場合、`botUser` をアプリのユーザーリソース名に設定し、`requireMention` を確認してください。
- テストメッセージを送信しながら `openclaw logs --follow` を使用して、リクエストが Gateway（ゲートウェイ）に到達しているか確認してください。

関連ドキュメント:

- [Gateway configuration](/gateway/configuration)
- [Security](/gateway/security)
- [Reactions](/tools/reactions)
