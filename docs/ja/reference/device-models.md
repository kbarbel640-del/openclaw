---
summary: "OpenClaw が macOS アプリでフレンドリーな名称を表示するために、Apple デバイスのモデル識別子をどのようにベンダリングしているかを説明します。"
read_when:
  - デバイスモデル識別子のマッピングや NOTICE / ライセンスファイルを更新する場合
  - Instances UI でのデバイス名の表示方法を変更する場合
title: "デバイスモデルデータベース"
x-i18n:
  source_path: reference/device-models.md
  source_hash: 1d99c2538a0d8fdd
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:43Z
---

# デバイスモデルデータベース（フレンドリー名）

macOS コンパニオンアプリは、Apple のモデル識別子（例：`iPad16,6`、`Mac16,6`）を人が読みやすい名称にマッピングすることで、**Instances** UI にフレンドリーな Apple デバイスモデル名を表示します。

このマッピングは、次の場所に JSON としてベンダリングされています。

- `apps/macos/Sources/OpenClaw/Resources/DeviceModels/`

## データソース

現在、このマッピングは MIT ライセンスの次のリポジトリからベンダリングしています。

- `kyle-seongwoo-jun/apple-device-identifiers`

ビルドの決定性を保つため、JSON ファイルは特定のアップストリームのコミットにピン留めされています（`apps/macos/Sources/OpenClaw/Resources/DeviceModels/NOTICE.md` に記録されています）。

## データベースの更新

1. ピン留めするアップストリームのコミットを選択します（iOS 用に 1 つ、macOS 用に 1 つ）。
2. `apps/macos/Sources/OpenClaw/Resources/DeviceModels/NOTICE.md` にあるコミットハッシュを更新します。
3. それらのコミットにピン留めした状態で、JSON ファイルを再ダウンロードします。

```bash
IOS_COMMIT="<commit sha for ios-device-identifiers.json>"
MAC_COMMIT="<commit sha for mac-device-identifiers.json>"

curl -fsSL "https://raw.githubusercontent.com/kyle-seongwoo-jun/apple-device-identifiers/${IOS_COMMIT}/ios-device-identifiers.json" \
  -o apps/macos/Sources/OpenClaw/Resources/DeviceModels/ios-device-identifiers.json

curl -fsSL "https://raw.githubusercontent.com/kyle-seongwoo-jun/apple-device-identifiers/${MAC_COMMIT}/mac-device-identifiers.json" \
  -o apps/macos/Sources/OpenClaw/Resources/DeviceModels/mac-device-identifiers.json
```

4. `apps/macos/Sources/OpenClaw/Resources/DeviceModels/LICENSE.apple-device-identifiers.txt` が引き続きアップストリームと一致していることを確認します（アップストリームのライセンスが変更された場合は置き換えてください）。
5. macOS アプリが警告なしでクリーンにビルドできることを確認します。

```bash
swift build --package-path apps/macos
```
