---
summary: "說明 OpenClaw 如何在 macOS 應用程式中，將 Apple 裝置型號識別碼對應為易讀名稱。"
read_when:
  - 更新裝置型號識別碼對應或 NOTICE／授權檔案時
  - 變更 Instances UI 顯示裝置名稱的方式時
title: "裝置型號資料庫"
x-i18n:
  source_path: reference/device-models.md
  source_hash: 1d99c2538a0d8fdd
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:27Z
---

# 裝置型號資料庫（易讀名稱）

macOS 配套應用程式會在 **Instances** UI 中顯示友善的 Apple 裝置型號名稱，方式是將 Apple 型號識別碼（例如 `iPad16,6`、`Mac16,6`）對應為人類可讀的名稱。

此對應以 JSON 形式隨附，位置為：

- `apps/macos/Sources/OpenClaw/Resources/DeviceModels/`

## 資料來源

目前我們從採用 MIT 授權的儲存庫隨附此對應資料：

- `kyle-seongwoo-jun/apple-device-identifiers`

為了確保建置具備可重現性，JSON 檔案會固定（pin）到特定的上游提交（記錄於 `apps/macos/Sources/OpenClaw/Resources/DeviceModels/NOTICE.md`）。

## 更新資料庫

1. 選擇要固定的上游提交（iOS 一個、macOS 一個）。
2. 更新 `apps/macos/Sources/OpenClaw/Resources/DeviceModels/NOTICE.md` 中的提交雜湊。
3. 重新下載固定到這些提交的 JSON 檔案：

```bash
IOS_COMMIT="<commit sha for ios-device-identifiers.json>"
MAC_COMMIT="<commit sha for mac-device-identifiers.json>"

curl -fsSL "https://raw.githubusercontent.com/kyle-seongwoo-jun/apple-device-identifiers/${IOS_COMMIT}/ios-device-identifiers.json" \
  -o apps/macos/Sources/OpenClaw/Resources/DeviceModels/ios-device-identifiers.json

curl -fsSL "https://raw.githubusercontent.com/kyle-seongwoo-jun/apple-device-identifiers/${MAC_COMMIT}/mac-device-identifiers.json" \
  -o apps/macos/Sources/OpenClaw/Resources/DeviceModels/mac-device-identifiers.json
```

4. 確認 `apps/macos/Sources/OpenClaw/Resources/DeviceModels/LICENSE.apple-device-identifiers.txt` 仍與上游一致（若上游授權變更，請替換）。
5. 驗證 macOS 應用程式可順利建置（無警告）：

```bash
swift build --package-path apps/macos
```
