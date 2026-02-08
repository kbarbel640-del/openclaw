---
summary: 「儲存庫腳本：用途、範圍與安全注意事項」
read_when:
  - 「從儲存庫執行腳本時」
  - 「在 ./scripts 下新增或變更腳本時」
title: 「腳本」
x-i18n:
  source_path: help/scripts.md
  source_hash: efd220df28f20b33
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:14:58Z
---

# Scripts

`scripts/` 目錄包含用於本機工作流程與營運任務的輔助腳本。
當任務明確對應到某個腳本時再使用；否則請優先使用 CLI。

## 慣例

- 除非在文件或發佈檢查清單中有引用，否則腳本皆為**選用**。
- 若有提供 CLI 介面，請優先使用（例如：驗證監控使用 `openclaw models status --check`）。
- 假設腳本與主機環境相關；在新機器上執行前請先閱讀內容。

## 驗證監控腳本

驗證監控腳本的文件在此：
[/automation/auth-monitoring](/automation/auth-monitoring)

## 新增腳本時

- 保持腳本聚焦且有文件說明。
- 在相關文件中加入簡短條目（若不存在則建立一份）。
