---
summary: "統合ブラウザー制御サービス + アクションコマンド"
read_when:
  - エージェント制御のブラウザー自動化を追加する場合
  - openclaw が自身の Chrome に干渉している理由をデバッグする場合
  - macOS アプリでブラウザー設定 + ライフサイクルを実装する場合
title: "ブラウザー（OpenClaw 管理）"
x-i18n:
  source_path: tools/browser.md
  source_hash: a868d040183436a1
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:13:56Z
---

# ブラウザー（openclaw-managed）

OpenClaw は、エージェントが制御する **専用の Chrome/Brave/Edge/Chromium プロファイル**を実行できます。
これは個人用ブラウザーから分離されており、Gateway（ゲートウェイ）内の小さなローカル
制御サービス（loopback のみ）を介して管理されます。

初心者向けの見方:

- これは **別の、エージェント専用ブラウザー**だと考えてください。
- `openclaw` プロファイルは、個人用ブラウザーのプロファイルには **一切**触れません。
- エージェントは、安全なレーンで **タブを開く、ページを読む、クリックする、入力する**ことができます。
- デフォルトの `chrome` プロファイルは、拡張機能リレー経由で **システムのデフォルト Chromium ブラウザー**を使用します。分離された管理ブラウザーに切り替えるには `openclaw` に変更してください。

## できること

- **openclaw** という名前の別ブラウザープロファイル（デフォルトではオレンジのアクセント）。
- 決定的なタブ制御（一覧/開く/フォーカス/閉じる）。
- エージェントのアクション（クリック/入力/ドラッグ/選択）、スナップショット、スクリーンショット、PDF。
- 任意の複数プロファイル対応（`openclaw`、`work`、`remote`、...）。

このブラウザーは日常的に使うものではありません。エージェントによる自動化と検証のための、安全で分離されたサーフェスです。

## クイックスタート

```bash
openclaw browser --browser-profile openclaw status
openclaw browser --browser-profile openclaw start
openclaw browser --browser-profile openclaw open https://example.com
openclaw browser --browser-profile openclaw snapshot
```

「Browser disabled」と表示された場合は、設定（下記参照）で有効化し、Gateway（ゲートウェイ）を再起動してください。

## プロファイル: `openclaw` vs `chrome`

- `openclaw`: 管理され、分離されたブラウザー（拡張機能不要）。
- `chrome`: **システムブラウザー**への拡張機能リレー（OpenClaw 拡張機能がタブにアタッチされている必要があります）。

デフォルトで管理モードにしたい場合は `browser.defaultProfile: "openclaw"` を設定してください。

## 設定

ブラウザー設定は `~/.openclaw/openclaw.json` にあります。

```json5
{
  browser: {
    enabled: true, // default: true
    // cdpUrl: "http://127.0.0.1:18792", // legacy single-profile override
    remoteCdpTimeoutMs: 1500, // remote CDP HTTP timeout (ms)
    remoteCdpHandshakeTimeoutMs: 3000, // remote CDP WebSocket handshake timeout (ms)
    defaultProfile: "chrome",
    color: "#FF4500",
    headless: false,
    noSandbox: false,
    attachOnly: false,
    executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    profiles: {
      openclaw: { cdpPort: 18800, color: "#FF4500" },
      work: { cdpPort: 18801, color: "#0066CC" },
      remote: { cdpUrl: "http://10.0.0.42:9222", color: "#00AA00" },
    },
  },
}
```

注記:

- ブラウザー制御サービスは、`gateway.port` から派生したポートで loopback にバインドします（デフォルト: `18791`。gateway + 2 です）。リレーは次のポート（`18792`）を使用します。
- Gateway（ゲートウェイ）ポート（`gateway.port` または `OPENCLAW_GATEWAY_PORT`）を上書きした場合、派生したブラウザーポートは同じ「ファミリー」に収まるようにシフトします。
- `cdpUrl` は未設定の場合、リレーポートがデフォルトになります。
- `remoteCdpTimeoutMs` はリモート（non-loopback）CDP 到達性チェックに適用されます。
- `remoteCdpHandshakeTimeoutMs` はリモート CDP WebSocket 到達性チェックに適用されます。
- `attachOnly: true` は「ローカルブラウザーは起動しない。すでに実行中の場合のみアタッチする」を意味します。
- `color` + プロファイルごとの `color` により、どのプロファイルがアクティブか分かるようにブラウザー UI をティントします。
- デフォルトのプロファイルは `chrome`（拡張機能リレー）です。管理ブラウザーには `defaultProfile: "openclaw"` を使用してください。
- 自動検出順: Chromium ベースのシステム既定ブラウザー。そうでなければ Chrome → Brave → Edge → Chromium → Chrome Canary。
- ローカルの `openclaw` プロファイルは `cdpPort`/`cdpUrl` を自動割り当てします。これらはリモート CDP の場合にのみ設定してください。

## Brave（または別の Chromium ベースのブラウザー）を使用する

**システムのデフォルト**ブラウザーが Chromium ベース（Chrome/Brave/Edge など）の場合、OpenClaw は自動的にそれを使用します。自動検出を上書きするには `browser.executablePath` を設定してください:

CLI の例:

```bash
openclaw config set browser.executablePath "/usr/bin/google-chrome"
```

```json5
// macOS
{
  browser: {
    executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
  }
}

// Windows
{
  browser: {
    executablePath: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"
  }
}

// Linux
{
  browser: {
    executablePath: "/usr/bin/brave-browser"
  }
}
```

## ローカル vs リモート制御

- **ローカル制御（デフォルト）:** Gateway（ゲートウェイ）が loopback 制御サービスを起動し、ローカルブラウザーを起動できます。
- **リモート制御（node host）:** ブラウザーがあるマシンで node host を実行します。Gateway（ゲートウェイ）はブラウザー操作をそれにプロキシします。
- **リモート CDP:** `browser.profiles.<name>.cdpUrl`（または `browser.cdpUrl`）を設定して、リモートの Chromium ベースブラウザーにアタッチします。この場合、OpenClaw はローカルブラウザーを起動しません。

リモート CDP URL には認証を含められます:

- クエリトークン（例: `https://provider.example?token=<token>`）
- HTTP Basic 認証（例: `https://user:pass@provider.example`）

OpenClaw は、`/json/*` エンドポイントを呼び出す際および CDP WebSocket に接続する際に、認証情報を保持します。トークンは設定ファイルにコミットするのではなく、環境変数またはシークレットマネージャーを優先してください。

## Node ブラウザープロキシ（ゼロ設定デフォルト）

ブラウザーがあるマシンで **node host** を実行すると、OpenClaw は追加のブラウザー設定なしで、そのノードへブラウザーツール呼び出しを自動ルーティングできます。これはリモート Gateway（ゲートウェイ）におけるデフォルト経路です。

注記:

- node host は、ローカルのブラウザー制御サーバーを **プロキシコマンド**として公開します。
- プロファイルはノード自身の `browser.profiles` 設定（ローカルと同じ）から取得されます。
- 不要であれば無効化できます:
  - ノード側: `nodeHost.browserProxy.enabled=false`
  - ゲートウェイ側: `gateway.nodes.browser.mode="off"`

## Browserless（ホスト型リモート CDP）

[Browserless](https://browserless.io) は、CDP エンドポイントを HTTPS 経由で公開するホスト型 Chromium サービスです。OpenClaw のブラウザープロファイルを Browserless のリージョンエンドポイントに向け、API キーで認証できます。

例:

```json5
{
  browser: {
    enabled: true,
    defaultProfile: "browserless",
    remoteCdpTimeoutMs: 2000,
    remoteCdpHandshakeTimeoutMs: 4000,
    profiles: {
      browserless: {
        cdpUrl: "https://production-sfo.browserless.io?token=<BROWSERLESS_API_KEY>",
        color: "#00AA00",
      },
    },
  },
}
```

注記:

- `<BROWSERLESS_API_KEY>` を実際の Browserless トークンに置き換えてください。
- Browserless アカウントに一致するリージョンエンドポイントを選択してください（詳細は Browserless のドキュメント参照）。

## セキュリティ

重要な考え方:

- ブラウザー制御は loopback のみです。アクセスは Gateway（ゲートウェイ）の認証またはノードのペアリングを通じて流れます。
- Gateway（ゲートウェイ）と node host はプライベートネットワーク（Tailscale）上に置き、公開を避けてください。
- リモート CDP の URL/トークンはシークレットとして扱い、環境変数またはシークレットマネージャーを優先してください。

リモート CDP のヒント:

- 可能であれば HTTPS エンドポイントと短命トークンを優先してください。
- 長命トークンを設定ファイルに直接埋め込むのは避けてください。

## プロファイル（マルチブラウザー）

OpenClaw は、複数の名前付きプロファイル（ルーティング設定）をサポートします。プロファイルは次のいずれかです:

- **openclaw-managed**: 専用の Chromium ベースブラウザーインスタンス（独自のユーザーデータディレクトリ + CDP ポート）
- **remote**: 明示的な CDP URL（別の場所で動作する Chromium ベースブラウザー）
- **extension relay**: ローカルリレー + Chrome 拡張機能を介して既存の Chrome タブを使用

デフォルト:

- `openclaw` プロファイルは、存在しなければ自動作成されます。
- `chrome` プロファイルは、Chrome 拡張機能リレー用に組み込み（デフォルトで `http://127.0.0.1:18792` を指します）。
- ローカル CDP ポートは、デフォルトで **18800–18899** から割り当てられます。
- プロファイルを削除すると、そのローカルデータディレクトリはゴミ箱に移動します。

すべての制御エンドポイントは `?profile=<name>` を受け付けます。CLI は `--browser-profile` を使用します。

## Chrome 拡張機能リレー（既存の Chrome を使用）

OpenClaw は、ローカル CDP リレー + Chrome 拡張機能により、**既存の Chrome タブ**（別の「openclaw」Chrome インスタンスなし）も操作できます。

完全ガイド: [Chrome extension](/tools/chrome-extension)

フロー:

- Gateway（ゲートウェイ）がローカル（同一マシン）で動作するか、ブラウザーのあるマシンで node host が動作します。
- ローカルの **リレーサーバー**が loopback の `cdpUrl`（デフォルト: `http://127.0.0.1:18792`）で待ち受けます。
- タブ上で **OpenClaw Browser Relay** 拡張機能アイコンをクリックしてアタッチします（自動アタッチはしません）。
- エージェントは適切なプロファイルを選択して、通常の `browser` ツール経由でそのタブを制御します。

Gateway（ゲートウェイ）が別マシンで動作する場合は、ブラウザーのあるマシンで node host を実行し、Gateway（ゲートウェイ）がブラウザー操作をプロキシできるようにしてください。

### サンドボックス化されたセッション

エージェントセッションがサンドボックス化されている場合、`browser` ツールはデフォルトで `target="sandbox"`（サンドボックスブラウザー）になる可能性があります。
Chrome 拡張機能リレーのテイクオーバーにはホストブラウザー制御が必要なため、次のいずれかにしてください:

- セッションをサンドボックス化せずに実行する、または
- `agents.defaults.sandbox.browser.allowHostControl: true` を設定し、ツール呼び出し時に `target="host"` を使用する。

### セットアップ

1. 拡張機能を読み込む（dev/unpacked）:

```bash
openclaw browser extension install
```

- Chrome → `chrome://extensions` → 「Developer mode」を有効化
- 「Load unpacked」→ `openclaw browser extension path` が出力したディレクトリを選択
- 拡張機能をピン留めし、制御したいタブでクリックします（バッジに `ON` が表示されます）。

2. 使用する:

- CLI: `openclaw browser --browser-profile chrome tabs`
- エージェントツール: `browser` に `profile="chrome"` を付けて使用

任意: 別の名前やリレーポートを使いたい場合は、独自のプロファイルを作成します:

```bash
openclaw browser create-profile \
  --name my-chrome \
  --driver extension \
  --cdp-url http://127.0.0.1:18792 \
  --color "#00AA00"
```

注記:

- このモードは、多くの操作（スクリーンショット/スナップショット/アクション）で Playwright-on-CDP に依存します。
- デタッチするには、拡張機能アイコンをもう一度クリックします。

## 分離の保証

- **専用ユーザーデータディレクトリ**: 個人用ブラウザープロファイルには一切触れません。
- **専用ポート**: 開発ワークフローとの衝突を防ぐため、`9222` を回避します。
- **決定的なタブ制御**: 「最後のタブ」ではなく `targetId` によってタブをターゲットします。

## ブラウザー選択

ローカル起動時、OpenClaw は最初に利用可能なものを選択します:

1. Chrome
2. Brave
3. Edge
4. Chromium
5. Chrome Canary

`browser.executablePath` で上書きできます。

プラットフォーム:

- macOS: `/Applications` と `~/Applications` を確認します。
- Linux: `google-chrome`、`brave`、`microsoft-edge`、`chromium` などを探します。
- Windows: 一般的なインストール場所を確認します。

## Control API（任意）

ローカル統合向けに、Gateway（ゲートウェイ）は小さな loopback HTTP API を公開します:

- Status/start/stop: `GET /`、`POST /start`、`POST /stop`
- Tabs: `GET /tabs`、`POST /tabs/open`、`POST /tabs/focus`、`DELETE /tabs/:targetId`
- Snapshot/screenshot: `GET /snapshot`、`POST /screenshot`
- Actions: `POST /navigate`、`POST /act`
- Hooks: `POST /hooks/file-chooser`、`POST /hooks/dialog`
- Downloads: `POST /download`、`POST /wait/download`
- Debugging: `GET /console`、`POST /pdf`
- Debugging: `GET /errors`、`GET /requests`、`POST /trace/start`、`POST /trace/stop`、`POST /highlight`
- Network: `POST /response/body`
- State: `GET /cookies`、`POST /cookies/set`、`POST /cookies/clear`
- State: `GET /storage/:kind`、`POST /storage/:kind/set`、`POST /storage/:kind/clear`
- Settings: `POST /set/offline`、`POST /set/headers`、`POST /set/credentials`、`POST /set/geolocation`、`POST /set/media`、`POST /set/timezone`、`POST /set/locale`、`POST /set/device`

すべてのエンドポイントは `?profile=<name>` を受け付けます。

### Playwright 要件

一部機能（navigate/act/AI snapshot/role snapshot、要素スクリーンショット、PDF）には
Playwright が必要です。Playwright がインストールされていない場合、それらのエンドポイントは明確な 501
エラーを返します。ARIA スナップショットと基本的なスクリーンショットは openclaw-managed Chrome でも動作します。
Chrome 拡張機能リレーのドライバーでは、ARIA スナップショットとスクリーンショットに Playwright が必要です。

`Playwright is not available in this gateway build` が表示される場合は、完全な
Playwright パッケージ（`playwright-core` ではありません）をインストールして gateway を再起動するか、ブラウザー対応で OpenClaw を再インストールしてください。

#### Docker の Playwright インストール

Gateway（ゲートウェイ）を Docker で実行している場合、`npx playwright` は避けてください（npm のオーバーライド衝突）。
代わりに同梱の CLI を使用してください:

```bash
docker compose run --rm openclaw-cli \
  node /app/node_modules/playwright-core/cli.js install chromium
```

ブラウザーダウンロードを永続化するには、`PLAYWRIGHT_BROWSERS_PATH`（例:
`/home/node/.cache/ms-playwright`）を設定し、`/home/node` が
`OPENCLAW_HOME_VOLUME` または bind mount によって永続化されるようにしてください。[Docker](/install/docker) を参照してください。

## 仕組み（内部）

高レベルのフロー:

- 小さな **制御サーバー**が HTTP リクエストを受け付けます。
- **CDP** を介して Chromium ベースのブラウザー（Chrome/Brave/Edge/Chromium）に接続します。
- 高度なアクション（クリック/入力/スナップショット/PDF）には、CDP の上に **Playwright** を使用します。
- Playwright がない場合、非 Playwright 操作のみが利用可能です。

この設計により、エージェントは安定した決定的なインターフェース上に保たれつつ、ローカル/リモートのブラウザーやプロファイルを切り替えられます。

## CLI クイックリファレンス

すべてのコマンドは、特定プロファイルを指定するために `--browser-profile <name>` を受け付けます。
また、すべてのコマンドは機械可読出力（安定したペイロード）のために `--json` も受け付けます。

基本:

- `openclaw browser status`
- `openclaw browser start`
- `openclaw browser stop`
- `openclaw browser tabs`
- `openclaw browser tab`
- `openclaw browser tab new`
- `openclaw browser tab select 2`
- `openclaw browser tab close 2`
- `openclaw browser open https://example.com`
- `openclaw browser focus abcd1234`
- `openclaw browser close abcd1234`

検査:

- `openclaw browser screenshot`
- `openclaw browser screenshot --full-page`
- `openclaw browser screenshot --ref 12`
- `openclaw browser screenshot --ref e12`
- `openclaw browser snapshot`
- `openclaw browser snapshot --format aria --limit 200`
- `openclaw browser snapshot --interactive --compact --depth 6`
- `openclaw browser snapshot --efficient`
- `openclaw browser snapshot --labels`
- `openclaw browser snapshot --selector "#main" --interactive`
- `openclaw browser snapshot --frame "iframe#main" --interactive`
- `openclaw browser console --level error`
- `openclaw browser errors --clear`
- `openclaw browser requests --filter api --clear`
- `openclaw browser pdf`
- `openclaw browser responsebody "**/api" --max-chars 5000`

アクション:

- `openclaw browser navigate https://example.com`
- `openclaw browser resize 1280 720`
- `openclaw browser click 12 --double`
- `openclaw browser click e12 --double`
- `openclaw browser type 23 "hello" --submit`
- `openclaw browser press Enter`
- `openclaw browser hover 44`
- `openclaw browser scrollintoview e12`
- `openclaw browser drag 10 11`
- `openclaw browser select 9 OptionA OptionB`
- `openclaw browser download e12 /tmp/report.pdf`
- `openclaw browser waitfordownload /tmp/report.pdf`
- `openclaw browser upload /tmp/file.pdf`
- `openclaw browser fill --fields '[{"ref":"1","type":"text","value":"Ada"}]'`
- `openclaw browser dialog --accept`
- `openclaw browser wait --text "Done"`
- `openclaw browser wait "#main" --url "**/dash" --load networkidle --fn "window.ready===true"`
- `openclaw browser evaluate --fn '(el) => el.textContent' --ref 7`
- `openclaw browser highlight e12`
- `openclaw browser trace start`
- `openclaw browser trace stop`

状態:

- `openclaw browser cookies`
- `openclaw browser cookies set session abc123 --url "https://example.com"`
- `openclaw browser cookies clear`
- `openclaw browser storage local get`
- `openclaw browser storage local set theme dark`
- `openclaw browser storage session clear`
- `openclaw browser set offline on`
- `openclaw browser set headers --json '{"X-Debug":"1"}'`
- `openclaw browser set credentials user pass`
- `openclaw browser set credentials --clear`
- `openclaw browser set geo 37.7749 -122.4194 --origin "https://example.com"`
- `openclaw browser set geo --clear`
- `openclaw browser set media dark`
- `openclaw browser set timezone America/New_York`
- `openclaw browser set locale en-US`
- `openclaw browser set device "iPhone 14"`

注記:

- `upload` と `dialog` は **arming** 呼び出しです。chooser/dialog をトリガーするクリック/押下の前に実行してください。
- `upload` は、`--input-ref` または `--element` 経由でファイル入力を直接設定することもできます。
- `snapshot`:
  - `--format ai`（Playwright がインストールされている場合のデフォルト）: 数値参照（`aria-ref="<n>"`）付きの AI スナップショットを返します。
  - `--format aria`: アクセシビリティツリーを返します（参照なし。検査のみ）。
  - `--efficient`（または `--mode efficient`）: コンパクトな role スナップショットのプリセット（interactive + compact + depth + 低い maxChars）。
  - 設定デフォルト（tool/CLI のみ）: 呼び出し側がモードを渡さない場合に効率的なスナップショットを使うには `browser.snapshotDefaults.mode: "efficient"` を設定します（[Gateway configuration](/gateway/configuration#browser-openclaw-managed-browser) を参照）。
  - Role スナップショットオプション（`--interactive`、`--compact`、`--depth`、`--selector`）は、`ref=e12` のような参照付きの role ベーススナップショットを強制します。
  - `--frame "<iframe selector>"` は role スナップショットを iframe にスコープします（`e12` のような role 参照と組み合わせます）。
  - `--interactive` は、インタラクティブ要素のフラットで選びやすいリストを出力します（アクション駆動に最適）。
  - `--labels` は、参照ラベルをオーバーレイしたビューポートのみのスクリーンショットを追加します（`MEDIA:<path>` を出力します）。
- `click`/`type`/etc には、`snapshot` からの `ref`（数値の `12` または role 参照の `e12`）が必要です。
  CSS セレクターは意図的にアクションではサポートされていません。

## スナップショットと参照

OpenClaw は 2 種類の「スナップショット」スタイルをサポートします:

- **AI スナップショット（数値参照）**: `openclaw browser snapshot`（デフォルト。`--format ai`）
  - 出力: 数値参照を含むテキストスナップショット。
  - アクション: `openclaw browser click 12`、`openclaw browser type 23 "hello"`。
  - 内部的には、参照は Playwright の `aria-ref` により解決されます。

- **Role スナップショット（`e12` のような role 参照）**: `openclaw browser snapshot --interactive`（または `--compact`、`--depth`、`--selector`、`--frame`）
  - 出力: `[ref=e12]`（および任意の `[nth=1]`）を持つ role ベースのリスト/ツリー。
  - アクション: `openclaw browser click e12`、`openclaw browser highlight e12`。
  - 内部的には、参照は `getByRole(...)` により解決されます（重複には `nth()` を追加）。
  - `--labels` を追加すると、`e12` ラベルをオーバーレイしたビューポートスクリーンショットを含められます。

参照の挙動:

- 参照は **ナビゲーションを跨いで安定しません**。失敗した場合は `snapshot` を再実行し、新しい参照を使用してください。
- Role スナップショットが `--frame` 付きで取得された場合、次の role スナップショットまで role 参照はその iframe にスコープされます。

## Wait のパワーアップ

時間/テキスト以外も待機できます:

- URL を待機（Playwright のグロブをサポート）:
  - `openclaw browser wait --url "**/dash"`
- ロード状態を待機:
  - `openclaw browser wait --load networkidle`
- JS 述語を待機:
  - `openclaw browser wait --fn "window.ready===true"`
- セレクターが可視になるのを待機:
  - `openclaw browser wait "#main"`

これらは組み合わせ可能です:

```bash
openclaw browser wait "#main" \
  --url "**/dash" \
  --load networkidle \
  --fn "window.ready===true" \
  --timeout-ms 15000
```

## デバッグの流れ

アクションが失敗した場合（例: 「not visible」「strict mode violation」「covered」）:

1. `openclaw browser snapshot --interactive`
2. `click <ref>` / `type <ref>` を使用（インタラクティブモードでは role 参照を優先）
3. それでも失敗する場合: `openclaw browser highlight <ref>` で Playwright が何をターゲットしているか確認
4. ページの挙動が不自然な場合:
   - `openclaw browser errors --clear`
   - `openclaw browser requests --filter api --clear`
5. 深いデバッグ: トレースを記録:
   - `openclaw browser trace start`
   - 問題を再現
   - `openclaw browser trace stop`（`TRACE:<path>` を出力）

## JSON 出力

`--json` はスクリプトおよび構造化ツール向けです。

例:

```bash
openclaw browser status --json
openclaw browser snapshot --interactive --json
openclaw browser requests --filter api --json
openclaw browser cookies --json
```

JSON の role スナップショットには `refs` に加えて、小さな `stats` ブロック（lines/chars/refs/interactive）が含まれ、ツールがペイロードのサイズと密度を推論できるようになります。

## 状態と環境のノブ

これらは「サイトを X のように振る舞わせる」ワークフローで有用です:

- Cookies: `cookies`、`cookies set`、`cookies clear`
- Storage: `storage local|session get|set|clear`
- Offline: `set offline on|off`
- Headers: `set headers --json '{"X-Debug":"1"}'`（または `--clear`）
- HTTP basic auth: `set credentials user pass`（または `--clear`）
- Geolocation: `set geo <lat> <lon> --origin "https://example.com"`（または `--clear`）
- Media: `set media dark|light|no-preference|none`
- Timezone / locale: `set timezone ...`、`set locale ...`
- Device / viewport:
  - `set device "iPhone 14"`（Playwright のデバイスプリセット）
  - `set viewport 1280 720`

## セキュリティとプライバシー

- openclaw のブラウザープロファイルにはログイン済みセッションが含まれる可能性があるため、機密として扱ってください。
- `browser act kind=evaluate` / `openclaw browser evaluate` および `wait --fn` はページコンテキストで任意の JavaScript を実行します。プロンプトインジェクションにより誘導される可能性があります。不要であれば `browser.evaluateEnabled=false` で無効化してください。
- ログインやアンチボットの注意点（X/Twitter など）については、[Browser login + X/Twitter posting](/tools/browser-login) を参照してください。
- Gateway（ゲートウェイ）/node host をプライベートに保ってください（loopback または tailnet のみ）。
- リモート CDP エンドポイントは強力です。トンネルし、保護してください。

## トラブルシューティング

Linux 固有の問題（特に snap Chromium）については、
[Browser troubleshooting](/tools/browser-linux-troubleshooting) を参照してください。

## エージェントツール + 制御の仕組み

エージェントがブラウザー自動化に使うツールは **1 つ**です:

- `browser` — status/start/stop/tabs/open/focus/close/snapshot/screenshot/navigate/act

対応関係:

- `browser snapshot` は安定した UI ツリー（AI または ARIA）を返します。
- `browser act` は、スナップショットの `ref` ID を使ってクリック/入力/ドラッグ/選択を行います。
- `browser screenshot` はピクセルをキャプチャします（全ページまたは要素）。
- `browser` は次を受け付けます:
  - 名前付きブラウザープロファイル（openclaw、chrome、または remote CDP）を選ぶための `profile`。
  - ブラウザーが存在する場所を選ぶ `target`（`sandbox` | `host` | `node`）。
  - サンドボックス化されたセッションでは、`target: "host"` に `agents.defaults.sandbox.browser.allowHostControl=true` が必要です。
  - `target` が省略された場合: サンドボックス化セッションはデフォルトで `sandbox`、非サンドボックスセッションはデフォルトで `host` になります。
  - ブラウザー対応のノードが接続されている場合、`target="host"` または `target="node"` でピン留めしない限り、ツールはそれに自動ルーティングする可能性があります。

これにより、エージェントは決定的になり、壊れやすいセレクターを回避できます。
