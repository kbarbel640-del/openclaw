---
summary: "エージェント利用向けのカメラキャプチャ（iOS ノード + macOS アプリ）：写真（jpg）および短い動画クリップ（mp4）"
read_when:
  - iOS ノードまたは macOS におけるカメラキャプチャの追加または変更時
  - エージェントからアクセス可能な MEDIA 一時ファイルのワークフロー拡張時
title: "カメラキャプチャ"
x-i18n:
  source_path: nodes/camera.md
  source_hash: b4d5f5ecbab6f705
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:15Z
---

# カメラキャプチャ（エージェント）

OpenClaw は、エージェントのワークフロー向けに **カメラキャプチャ** をサポートしています。

- **iOS ノード**（Gateway（ゲートウェイ）経由でペアリング）：`node.invoke` を介して **写真**（`jpg`）または **短い動画クリップ**（`mp4`、オプションで音声付き）をキャプチャします。
- **Android ノード**（Gateway（ゲートウェイ）経由でペアリング）：`node.invoke` を介して **写真**（`jpg`）または **短い動画クリップ**（`mp4`、オプションで音声付き）をキャプチャします。
- **macOS アプリ**（Gateway（ゲートウェイ）経由のノード）：`node.invoke` を介して **写真**（`jpg`）または **短い動画クリップ**（`mp4`、オプションで音声付き）をキャプチャします。

すべてのカメラアクセスは **ユーザー制御の設定** によって制限されます。

## iOS ノード

### ユーザー設定（デフォルト有効）

- iOS 設定タブ → **カメラ** → **カメラを許可**（`camera.enabled`）
  - デフォルト：**オン**（キーが存在しない場合は有効として扱われます）。
  - オフの場合：`camera.*` コマンドは `CAMERA_DISABLED` を返します。

### コマンド（Gateway（ゲートウェイ）経由 `node.invoke`）

- `camera.list`
  - レスポンスペイロード：
    - `devices`：`{ id, name, position, deviceType }` の配列

- `camera.snap`
  - パラメータ：
    - `facing`：`front|back`（デフォルト：`front`）
    - `maxWidth`：number（任意；iOS ノードではデフォルト `1600`）
    - `quality`：`0..1`（任意；デフォルト `0.9`）
    - `format`：現在は `jpg`
    - `delayMs`：number（任意；デフォルト `0`）
    - `deviceId`：string（任意；`camera.list` 由来）
  - レスポンスペイロード：
    - `format: "jpg"`
    - `base64: "<...>"`
    - `width`、`height`
  - ペイロードガード：写真は base64 ペイロードが 5 MB 未満になるよう再圧縮されます。

- `camera.clip`
  - パラメータ：
    - `facing`：`front|back`（デフォルト：`front`）
    - `durationMs`：number（デフォルト `3000`、最大 `60000` にクランプ）
    - `includeAudio`：boolean（デフォルト `true`）
    - `format`：現在は `mp4`
    - `deviceId`：string（任意；`camera.list` 由来）
  - レスポンスペイロード：
    - `format: "mp4"`
    - `base64: "<...>"`
    - `durationMs`
    - `hasAudio`

### フォアグラウンド要件

`canvas.*` と同様に、iOS ノードは **フォアグラウンド** でのみ `camera.*` コマンドを許可します。バックグラウンドでの呼び出しは `NODE_BACKGROUND_UNAVAILABLE` を返します。

### CLI ヘルパー（一時ファイル + MEDIA）

添付を取得する最も簡単な方法は CLI ヘルパーを使用することです。デコードされたメディアを一時ファイルに書き込み、`MEDIA:<path>` を出力します。

例：

```bash
openclaw nodes camera snap --node <id>               # default: both front + back (2 MEDIA lines)
openclaw nodes camera snap --node <id> --facing front
openclaw nodes camera clip --node <id> --duration 3000
openclaw nodes camera clip --node <id> --no-audio
```

注意事項：

- `nodes camera snap` は、エージェントに両方のビューを提供するため、デフォルトで **両方** の向きになります。
- 出力ファイルは、独自のラッパーを構築しない限り、OS の一時ディレクトリ内の一時ファイルです。

## Android ノード

### ユーザー設定（デフォルト有効）

- Android 設定シート → **カメラ** → **カメラを許可**（`camera.enabled`）
  - デフォルト：**オン**（キーが存在しない場合は有効として扱われます）。
  - オフの場合：`camera.*` コマンドは `CAMERA_DISABLED` を返します。

### 権限

- Android ではランタイム権限が必要です：
  - `CAMERA`：`camera.snap` および `camera.clip` の両方に必要です。
  - `RECORD_AUDIO`：`includeAudio=true` の場合に `camera.clip` に必要です。

権限が不足している場合、可能であればアプリがプロンプトを表示します。拒否された場合、`camera.*` のリクエストは
`*_PERMISSION_REQUIRED` エラーで失敗します。

### フォアグラウンド要件

`canvas.*` と同様に、Android ノードは **フォアグラウンド** でのみ `camera.*` コマンドを許可します。バックグラウンドでの呼び出しは `NODE_BACKGROUND_UNAVAILABLE` を返します。

### ペイロードガード

写真は base64 ペイロードが 5 MB 未満になるよう再圧縮されます。

## macOS アプリ

### ユーザー設定（デフォルト無効）

macOS コンパニオンアプリにはチェックボックスがあります。

- **設定 → 一般 → カメラを許可**（`openclaw.cameraEnabled`）
  - デフォルト：**オフ**
  - オフの場合：カメラリクエストは「Camera disabled by user」を返します。

### CLI ヘルパー（ノード呼び出し）

メインの `openclaw` CLI を使用して、macOS ノード上のカメラコマンドを呼び出します。

例：

```bash
openclaw nodes camera list --node <id>            # list camera ids
openclaw nodes camera snap --node <id>            # prints MEDIA:<path>
openclaw nodes camera snap --node <id> --max-width 1280
openclaw nodes camera snap --node <id> --delay-ms 2000
openclaw nodes camera snap --node <id> --device-id <id>
openclaw nodes camera clip --node <id> --duration 10s          # prints MEDIA:<path>
openclaw nodes camera clip --node <id> --duration-ms 3000      # prints MEDIA:<path> (legacy flag)
openclaw nodes camera clip --node <id> --device-id <id>
openclaw nodes camera clip --node <id> --no-audio
```

注意事項：

- `openclaw nodes camera snap` は、上書きされない限りデフォルトで `maxWidth=1600` になります。
- macOS では、`camera.snap` はウォームアップ／露出の安定後に `delayMs`（デフォルト 2000 ms）待機してからキャプチャします。
- 写真のペイロードは、base64 が 5 MB 未満になるよう再圧縮されます。

## 安全性 + 実用上の制限

- カメラおよびマイクへのアクセスは、通常の OS 権限プロンプトを表示します（Info.plist に使用目的文字列が必要です）。
- 動画クリップは、ノードのペイロードが過大にならないよう（base64 のオーバーヘッド + メッセージ制限）、上限（現在は `<= 60s`）が設定されています。

## macOS 画面動画（OS レベル）

_画面_ 動画（カメラではありません）については、macOS コンパニオンを使用してください。

```bash
openclaw nodes screen record --node <id> --duration 10s --fps 15   # prints MEDIA:<path>
```

注意事項：

- macOS の **画面収録** 権限（TCC）が必要です。
