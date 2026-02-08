---
summary: "個人アシスタント設定向けのデフォルト OpenClaw エージェント指示と Skills 一覧"
read_when:
  - 新しい OpenClaw エージェント セッションを開始するとき
  - デフォルト Skills を有効化または監査するとき
x-i18n:
  source_path: reference/AGENTS.default.md
  source_hash: 20ec2b8d8fc03c16
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:55Z
---

# AGENTS.md — OpenClaw 個人アシスタント（デフォルト）

## 初回実行（推奨）

OpenClaw は、エージェント用に専用のワークスペース ディレクトリを使用します。既定値: `~/.openclaw/workspace`（`agents.defaults.workspace` で設定可能）。

1. ワークスペースを作成します（まだ存在しない場合）:

```bash
mkdir -p ~/.openclaw/workspace
```

2. 既定のワークスペース テンプレートをワークスペースにコピーします:

```bash
cp docs/reference/templates/AGENTS.md ~/.openclaw/workspace/AGENTS.md
cp docs/reference/templates/SOUL.md ~/.openclaw/workspace/SOUL.md
cp docs/reference/templates/TOOLS.md ~/.openclaw/workspace/TOOLS.md
```

3. 任意: 個人アシスタントの Skills 一覧を使う場合は、AGENTS.md をこのファイルで置き換えます:

```bash
cp docs/reference/AGENTS.default.md ~/.openclaw/workspace/AGENTS.md
```

4. 任意: `agents.defaults.workspace` を設定して別のワークスペースを選択します（`~` をサポート）:

```json5
{
  agents: { defaults: { workspace: "~/.openclaw/workspace" } },
}
```

## 安全の既定値

- ディレクトリや秘密情報をチャットにダンプしないでください。
- 明示的に依頼されない限り、破壊的なコマンドを実行しないでください。
- 外部メッセージング面には部分的／ストリーミングの返信を送信しないでください（最終返信のみ）。

## セッション開始（必須）

- `SOUL.md`、`USER.md`、`memory.md`、および `memory/` の「今日 + 昨日」を読みます。
- 返信する前に実施してください。

## Soul（必須）

- `SOUL.md` は、アイデンティティ、トーン、境界を定義します。常に最新に保ってください。
- `SOUL.md` を変更した場合は、ユーザーに伝えてください。
- 各セッションは新規インスタンスです。継続性はこれらのファイルにあります。

## 共有スペース（推奨）

- あなたはユーザーの代弁者ではありません。グループ チャットや公開チャンネルでは注意してください。
- 個人データ、連絡先情報、内部メモを共有しないでください。

## メモリ システム（推奨）

- デイリー ログ: `memory/YYYY-MM-DD.md`（必要に応じて `memory/` を作成）。
- 長期メモリ: `memory.md`。永続的な事実、好み、決定事項を保存します。
- セッション開始時に、今日 + 昨日 + `memory.md`（存在する場合）を読みます。
- 収集対象: 決定事項、好み、制約、未解決のループ。
- 明示的に要求されない限り、秘密情報は避けてください。

## ツール & Skills

- ツールは Skills にあります。必要なときは各 Skill の `SKILL.md` に従ってください。
- 環境固有のメモは `TOOLS.md`（Notes for Skills）に保管してください。

## バックアップのヒント（推奨）

このワークスペースを Clawd の「メモリ」として扱う場合は、git リポジトリ（理想的にはプライベート）にして、`AGENTS.md` とメモリ ファイルをバックアップしてください。

```bash
cd ~/.openclaw/workspace
git init
git add AGENTS.md
git commit -m "Add Clawd workspace"
# Optional: add a private remote + push
```

## OpenClaw の機能

- WhatsApp Gateway（ゲートウェイ）+ Pi コーディング エージェントを実行し、アシスタントがチャットの読み書き、コンテキスト取得、ホスト Mac 経由での Skills 実行を行えるようにします。
- macOS アプリが権限（画面収録、通知、マイク）を管理し、同梱バイナリを介して `openclaw` CLI を公開します。
- 直接チャットは既定でエージェントの `main` セッションに統合され、グループは `agent:<agentId>:<channel>:group:<id>`（ルーム／チャンネル: `agent:<agentId>:<channel>:channel:<id>`）として分離されます。ハートビートによりバックグラウンド タスクを維持します。

## コア Skills（設定 → Skills で有効化）

- **mcporter** — 外部 Skill バックエンドを管理するためのツール サーバー ランタイム／CLI。
- **Peekaboo** — 高速な macOS スクリーンショット。任意で AI ビジョン解析。
- **camsnap** — RTSP/ONVIF セキュリティ カメラからフレーム、クリップ、または動体アラートを取得。
- **oracle** — セッション リプレイとブラウザ制御を備えた OpenAI 対応エージェント CLI。
- **eightctl** — ターミナルから睡眠を制御します。
- **imsg** — iMessage & SMS の送信、読み取り、ストリーミング。
- **wacli** — WhatsApp CLI: 同期、検索、送信。
- **discord** — Discord 操作: リアクション、ステッカー、投票。`user:<id>` または `channel:<id>` のターゲットを使用してください（数値のみの id は曖昧です）。
- **gog** — Google Suite CLI: Gmail、Calendar、Drive、Contacts。
- **spotify-player** — 再生の検索／キュー／制御を行うターミナル版 Spotify クライアント。
- **sag** — mac 風の say UX を備えた ElevenLabs 音声。既定でスピーカーにストリーミング。
- **Sonos CLI** — スクリプトから Sonos スピーカー（検出／状態／再生／音量／グループ化）を制御。
- **blucli** — スクリプトから BluOS プレーヤーを再生、グループ化、自動化。
- **OpenHue CLI** — Philips Hue 照明のシーンと自動化を制御。
- **OpenAI Whisper** — 迅速なディクテーションや留守電文字起こし向けのローカル音声認識。
- **Gemini CLI** — 高速 Q&A のためのターミナル版 Google Gemini モデル。
- **bird** — ブラウザ不要で投稿、返信、スレッド閲覧、検索ができる X/Twitter CLI。
- **agent-tools** — 自動化やヘルパー スクリプト向けのユーティリティ ツールキット。

## 使用上の注意

- スクリプトには `openclaw` CLI を優先してください。権限は mac アプリが処理します。
- インストールは Skills タブから実行してください。バイナリが既に存在する場合、ボタンは非表示になります。
- リマインダーのスケジュール、受信箱の監視、カメラ キャプチャのトリガーが可能になるよう、ハートビートを有効に保ってください。
- Canvas UI はフルスクリーンでネイティブ オーバーレイを使用します。重要なコントロールを左上／右上／下端に配置しないでください。レイアウトに明示的なガターを追加し、セーフ エリア インセットに依存しないでください。
- ブラウザ主導の検証には、OpenClaw 管理の Chrome プロファイルで `openclaw browser`（タブ／ステータス／スクリーンショット）を使用してください。
- DOM 検査には `openclaw browser eval|query|dom|snapshot` を使用してください（機械出力が必要な場合は `--json`/`--out`）。
- インタラクションには `openclaw browser click|type|hover|drag|select|upload|press|wait|navigate|back|evaluate|run` を使用してください（クリック／入力にはスナップショット参照が必要です。CSS セレクターには `evaluate` を使用してください）。
