---
summary: "WKWebView + カスタム URL スキームにより埋め込まれた、エージェント制御の Canvas パネル"
read_when:
  - macOS の Canvas パネルを実装する場合
  - ビジュアルワークスペース向けのエージェント制御を追加する場合
  - WKWebView の Canvas ロードをデバッグする場合
title: "Canvas"
x-i18n:
  source_path: platforms/mac/canvas.md
  source_hash: e39caa21542e839d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:21Z
---

# Canvas（macOS アプリ）

macOS アプリは、`WKWebView` を使用してエージェント制御の **Canvas パネル** を埋め込みます。これは、HTML/CSS/JS、A2UI、小規模なインタラクティブ UI サーフェス向けの軽量なビジュアルワークスペースです。

## Canvas の配置場所

Canvas の状態は Application Support 配下に保存されます。

- `~/Library/Application Support/OpenClaw/canvas/<session>/...`

Canvas パネルは、**カスタム URL スキーム** を介してそれらのファイルを配信します。

- `openclaw-canvas://<session>/<path>`

例:

- `openclaw-canvas://main/` → `<canvasRoot>/main/index.html`
- `openclaw-canvas://main/assets/app.css` → `<canvasRoot>/main/assets/app.css`
- `openclaw-canvas://main/widgets/todo/` → `<canvasRoot>/main/widgets/todo/index.html`

ルートに `index.html` が存在しない場合、アプリは **組み込みのスキャフォールドページ** を表示します。

## パネルの挙動

- メニューバー（またはマウスカーソル）付近にアンカーされた、ボーダーレスでリサイズ可能なパネルです。
- セッションごとにサイズと位置を記憶します。
- ローカルの Canvas ファイルが変更されると自動的に再読み込みします。
- 同時に表示される Canvas パネルは 1 つのみです（必要に応じてセッションが切り替わります）。

Canvas は、設定 → **Allow Canvas** から無効化できます。無効化されている場合、Canvas ノードのコマンドは `CANVAS_DISABLED` を返します。

## エージェント API サーフェス

Canvas は **Gateway WebSocket** を介して公開されているため、エージェントは次の操作を行えます。

- パネルの表示／非表示
- パスまたは URL へのナビゲーション
- JavaScript の評価
- スナップショット画像のキャプチャ

CLI の例:

```bash
openclaw nodes canvas present --node <id>
openclaw nodes canvas navigate --node <id> --url "/"
openclaw nodes canvas eval --node <id> --js "document.title"
openclaw nodes canvas snapshot --node <id>
```

注記:

- `canvas.navigate` は **ローカル Canvas パス**、`http(s)` の URL、および `file://` の URL を受け付けます。
- `"/"` を渡した場合、Canvas はローカルのスキャフォールド、または `index.html` を表示します。

## Canvas における A2UI

A2UI は Gateway の Canvas ホストによって提供され、Canvas パネル内にレンダリングされます。Gateway が Canvas ホストをアドバタイズすると、macOS アプリは初回オープン時に自動的に A2UI ホストページへナビゲートします。

既定の A2UI ホスト URL:

```
http://<gateway-host>:18793/__openclaw__/a2ui/
```

### A2UI コマンド（v0.8）

Canvas は現在、**A2UI v0.8** のサーバー→クライアント メッセージを受け付けます。

- `beginRendering`
- `surfaceUpdate`
- `dataModelUpdate`
- `deleteSurface`

`createSurface`（v0.9）はサポートされていません。

CLI の例:

```bash
cat > /tmp/a2ui-v0.8.jsonl <<'EOFA2'
{"surfaceUpdate":{"surfaceId":"main","components":[{"id":"root","component":{"Column":{"children":{"explicitList":["title","content"]}}}},{"id":"title","component":{"Text":{"text":{"literalString":"Canvas (A2UI v0.8)"},"usageHint":"h1"}}},{"id":"content","component":{"Text":{"text":{"literalString":"If you can read this, A2UI push works."},"usageHint":"body"}}}]}}
{"beginRendering":{"surfaceId":"main","root":"root"}}
EOFA2

openclaw nodes canvas a2ui push --jsonl /tmp/a2ui-v0.8.jsonl --node <id>
```

簡易スモークテスト:

```bash
openclaw nodes canvas a2ui push --node <id> --text "Hello from A2UI"
```

## Canvas からエージェント実行をトリガーする

Canvas はディープリンクを介して新しいエージェント実行をトリガーできます。

- `openclaw://agent?...`

例（JS）:

```js
window.location.href = "openclaw://agent?message=Review%20this%20design";
```

有効なキーが提供されない限り、アプリは確認を求めます。

## セキュリティに関する注意

- Canvas スキームはディレクトリトラバーサルをブロックします。ファイルはセッションのルート配下に存在する必要があります。
- ローカルの Canvas コンテンツはカスタム スキームを使用します（loopback サーバーは不要です）。
- 外部の `http(s)` の URL は、明示的にナビゲートされた場合にのみ許可されます。
