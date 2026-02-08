---
summary: 「外掛清單 + JSON Schema 需求（嚴格的設定驗證）」
read_when:
  - 「你正在建置 OpenClaw 外掛」
  - 「你需要發佈外掛設定結構描述，或除錯外掛驗證錯誤」
title: 「外掛清單」
x-i18n:
  source_path: plugins/manifest.md
  source_hash: 47b3e33c915f47bd
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:15Z
---

# 外掛清單（openclaw.plugin.json）

每個外掛 **必須** 在 **外掛根目錄** 提供一個 `openclaw.plugin.json` 檔案。
OpenClaw 使用此清單在 **不執行外掛程式碼** 的情況下驗證設定。
缺失或無效的清單會被視為外掛錯誤，並阻止設定驗證。

請參閱完整的外掛系統指南：[Plugins](/plugin)。

## 必要欄位

```json
{
  "id": "voice-call",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

必要金鑰：

- `id`（string）：標準化的外掛 id。
- `configSchema`（object）：外掛設定的 JSON Schema（內嵌）。

選用金鑰：

- `kind`（string）：外掛類型（例如：`"memory"`）。
- `channels`（array）：此外掛註冊的頻道 id（例如：`["matrix"]`）。
- `providers`（array）：此外掛註冊的 provider id。
- `skills`（array）：要載入的 skill 目錄（相對於外掛根目錄）。
- `name`（string）：外掛的顯示名稱。
- `description`（string）：外掛的簡短摘要。
- `uiHints`（object）：用於 UI 呈現的設定欄位標籤／提示文字／敏感旗標。
- `version`（string）：外掛版本（資訊用途）。

## JSON Schema 需求

- **每個外掛都必須提供 JSON Schema**，即使它不接受任何設定。
- 允許使用空的結構描述（例如：`{ "type": "object", "additionalProperties": false }`）。
- 結構描述會在讀取／寫入設定時驗證，而非在執行期。

## 驗證行為

- 未知的 `channels.*` 金鑰會被視為 **錯誤**，除非該頻道 id 已由某個外掛清單宣告。
- `plugins.entries.<id>`、`plugins.allow`、`plugins.deny` 與 `plugins.slots.*`
  必須參照 **可探索的** 外掛 id。未知的 id 會被視為 **錯誤**。
- 如果外掛已安裝但清單或結構描述損壞或缺失，驗證會失敗，且 Doctor 會回報外掛錯誤。
- 如果外掛設定存在但外掛被 **停用**，設定會被保留，並在 Doctor 與日誌中顯示 **警告**。

## 注意事項

- **所有外掛都必須提供清單**，包含從本機檔案系統載入的外掛。
- 執行期仍會個別載入外掛模組；清單僅用於探索 + 驗證。
- 若你的外掛相依原生模組，請文件化建置步驟，以及任何套件管理器的允許清單需求（例如，pnpm `allow-build-scripts` - `pnpm rebuild <package>`）。
