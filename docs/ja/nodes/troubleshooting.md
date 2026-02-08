---
summary: "ノードのペアリング、フォアグラウンド要件、権限、ツール失敗のトラブルシューティング"
read_when:
  - ノードは接続されているが、camera/canvas/screen/exec ツールが失敗する場合
  - ノードのペアリングと承認のメンタルモデルを理解する必要がある場合
title: "ノードのトラブルシューティング"
x-i18n:
  source_path: nodes/troubleshooting.md
  source_hash: 5c40d298c9feaf8e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:14:45Z
---

# ノードのトラブルシューティング

ステータス上ではノードが表示されているが、ノードツールが失敗する場合は、このページを使用してください。

## コマンドラダー

```bash
openclaw status
openclaw gateway status
openclaw logs --follow
openclaw doctor
openclaw channels status --probe
```

次に、ノード固有のチェックを実行します。

```bash
openclaw nodes status
openclaw nodes describe --node <idOrNameOrIp>
openclaw approvals get --node <idOrNameOrIp>
```

正常なシグナル:

- ノードが接続され、ロール `node` に対してペアリングされています。
- `nodes describe` に、呼び出している機能が含まれています。
- Exec 承認が、期待されるモード／許可リストを示しています。

## フォアグラウンド要件

`canvas.*`、`camera.*`、および `screen.*` は、iOS / Android ノードではフォアグラウンド専用です。

クイックチェックと修正:

```bash
openclaw nodes describe --node <idOrNameOrIp>
openclaw nodes canvas snapshot --node <idOrNameOrIp>
openclaw logs --follow
```

`NODE_BACKGROUND_UNAVAILABLE` が表示される場合は、ノードアプリをフォアグラウンドに戻して再試行してください。

## 権限マトリクス

| 機能                         | iOS                                    | Android                                                  | macOS ノードアプリ                     | 典型的な失敗コード             |
| ---------------------------- | -------------------------------------- | -------------------------------------------------------- | -------------------------------------- | ------------------------------ |
| `camera.snap`、`camera.clip` | カメラ（クリップ音声用にマイクを含む） | カメラ（クリップ音声用にマイクを含む）                   | カメラ（クリップ音声用にマイクを含む） | `*_PERMISSION_REQUIRED`        |
| `screen.record`              | 画面収録（マイクは任意）               | 画面キャプチャのプロンプト（マイクは任意）               | 画面収録                               | `*_PERMISSION_REQUIRED`        |
| `location.get`               | 使用中または常に許可（モードに依存）   | モードに基づくフォアグラウンド／バックグラウンド位置情報 | 位置情報の権限                         | `LOCATION_PERMISSION_REQUIRED` |
| `system.run`                 | 該当なし（ノードホストのパス）         | 該当なし（ノードホストのパス）                           | Exec 承認が必要                        | `SYSTEM_RUN_DENIED`            |

## ペアリングと承認の違い

これらは異なるゲートです。

1. **デバイスのペアリング**: このノードはゲートウェイに接続できますか？
2. **Exec 承認**: このノードは特定のシェルコマンドを実行できますか？

クイックチェック:

```bash
openclaw devices list
openclaw nodes status
openclaw approvals get --node <idOrNameOrIp>
openclaw approvals allowlist add --node <idOrNameOrIp> "/usr/bin/uname"
```

ペアリングが欠けている場合は、まずノードデバイスを承認してください。  
ペアリングに問題がないが `system.run` が失敗する場合は、Exec 承認／許可リストを修正してください。

## 一般的なノードエラーコード

- `NODE_BACKGROUND_UNAVAILABLE` → アプリがバックグラウンドにあります。フォアグラウンドに戻してください。
- `CAMERA_DISABLED` → ノード設定でカメラのトグルが無効になっています。
- `*_PERMISSION_REQUIRED` → OS 権限が不足している、または拒否されています。
- `LOCATION_DISABLED` → 位置情報モードがオフです。
- `LOCATION_PERMISSION_REQUIRED` → 要求された位置情報モードが許可されていません。
- `LOCATION_BACKGROUND_UNAVAILABLE` → アプリがバックグラウンドにあり、「使用中のみ」権限しか存在しません。
- `SYSTEM_RUN_DENIED: approval required` → Exec リクエストに明示的な承認が必要です。
- `SYSTEM_RUN_DENIED: allowlist miss` → 許可リストモードによりコマンドがブロックされています。

## 迅速な復旧ループ

```bash
openclaw nodes status
openclaw nodes describe --node <idOrNameOrIp>
openclaw approvals get --node <idOrNameOrIp>
openclaw logs --follow
```

それでも解決しない場合:

- デバイスのペアリングを再承認します。
- ノードアプリを再度開きます（フォアグラウンド）。
- OS 権限を再付与します。
- Exec 承認ポリシーを再作成／調整します。

関連情報:

- [/nodes/index](/nodes/index)
- [/nodes/camera](/nodes/camera)
- [/nodes/location-command](/nodes/location-command)
- [/tools/exec-approvals](/tools/exec-approvals)
- [/gateway/pairing](/gateway/pairing)
