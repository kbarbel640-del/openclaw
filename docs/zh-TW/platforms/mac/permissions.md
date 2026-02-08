---
summary: 「macOS 權限持久性（TCC）與簽署需求」
read_when:
  - 「偵錯 macOS 權限提示缺失或卡住」
  - 「封裝或簽署 macOS 應用程式」
  - 「變更套件識別碼或應用程式安裝路徑」
title: 「macOS 權限」
x-i18n:
  source_path: platforms/mac/permissions.md
  source_hash: d012589c0583dd0b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:07Z
---

# macOS 權限（TCC）

macOS 的權限授與相當脆弱。TCC 會將權限授與關聯到
應用程式的程式碼簽章、套件識別碼，以及磁碟上的路徑。只要其中任何一項改變，
macOS 就會將該應用程式視為全新，並可能移除或隱藏提示。

## 穩定權限的需求

- 相同路徑：從固定位置執行應用程式（對於 OpenClaw，`dist/OpenClaw.app`）。
- 相同套件識別碼：變更套件 ID 會建立新的權限身分。
- 已簽署的應用程式：未簽署或臨時（ad-hoc）簽署的建置不會保留權限。
- 一致的簽章：使用正式的 Apple Development 或 Developer ID 憑證，
  以確保跨重建時簽章保持穩定。

臨時（ad-hoc）簽章每次建置都會產生新的身分。macOS 會忘記先前的授與，
而提示可能會完全消失，直到清除過期項目為止。

## 提示消失時的復原檢查清單

1. 結束應用程式。
2. 在「系統設定 -> 隱私權與安全性」中移除該應用程式項目。
3. 從相同路徑重新啟動應用程式並重新授與權限。
4. 若提示仍未出現，使用 `tccutil` 重設 TCC 項目後再試一次。
5. 有些權限只有在完整重新啟動 macOS 之後才會再次出現。

重設範例（請依需要替換套件 ID）：

```bash
sudo tccutil reset Accessibility bot.molt.mac
sudo tccutil reset ScreenCapture bot.molt.mac
sudo tccutil reset AppleEvents
```

若正在測試權限，請務必使用正式憑證進行簽署。臨時（ad-hoc）
建置僅適合用於不重視權限的快速本機執行。
