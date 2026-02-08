---
summary: 「OpenClaw 記錄：滾動式診斷檔案日誌 + 統一日誌隱私旗標」
read_when:
  - 擷取 macOS 日誌或調查私人資料記錄
  - 偵錯語音喚醒／工作階段生命週期問題
title: 「macOS 記錄」
x-i18n:
  source_path: platforms/mac/logging.md
  source_hash: c4c201d154915e0e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:02Z
---

# 記錄（macOS）

## 滾動式診斷檔案日誌（偵錯窗格）

OpenClaw 透過 swift-log 將 macOS 應用程式日誌送入（預設為統一日誌），並且在需要耐久擷取時，可以將本機的滾動式檔案日誌寫入磁碟。

- 詳細程度：**偵錯窗格 → Logs → App logging → Verbosity**
- 啟用：**偵錯窗格 → Logs → App logging → 「Write rolling diagnostics log (JSONL)」**
- 位置：`~/Library/Logs/OpenClaw/diagnostics.jsonl`（自動輪替；舊檔會加上 `.1`、`.2`、… 的尾碼）
- 清除：**偵錯窗格 → Logs → App logging → 「Clear」**

注意事項：

- 這項功能**預設為關閉**。僅在主動進行偵錯時啟用。
- 請將該檔案視為敏感資料；未經檢視請勿分享。

## macOS 上的統一日誌私人資料

除非子系統選擇加入 `privacy -off`，否則統一日誌會遮蔽大多數內容。依據 Peter 在 macOS 上關於〈logging privacy shenanigans〉的說明文章（2025）：https://steipete.me/posts/2025/logging-privacy-shenanigans，這由位於 `/Library/Preferences/Logging/Subsystems/` 的 plist 控制，並以子系統名稱作為索引鍵。只有新的日誌項目會套用該旗標，因此請在重現問題之前啟用。

## 為 OpenClaw 啟用（`bot.molt`）

- 先將 plist 寫入暫存檔，然後以 root 身分原子性地安裝：

```bash
cat <<'EOF' >/tmp/bot.molt.plist
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>DEFAULT-OPTIONS</key>
    <dict>
        <key>Enable-Private-Data</key>
        <true/>
    </dict>
</dict>
</plist>
EOF
sudo install -m 644 -o root -g wheel /tmp/bot.molt.plist /Library/Preferences/Logging/Subsystems/bot.molt.plist
```

- 不需要重新開機；logd 會很快注意到該檔案，但只有新的日誌行才會包含私人內容。
- 使用既有的輔助工具查看更豐富的輸出，例如：`./scripts/clawlog.sh --category WebChat --last 5m`。

## 偵錯後停用

- 移除覆寫設定：`sudo rm /Library/Preferences/Logging/Subsystems/bot.molt.plist`。
- 視需要執行 `sudo log config --reload`，以強制 logd 立即移除覆寫。
- 請記住，這個介面可能包含電話號碼與訊息內容；僅在確實需要額外細節時，才保留該 plist。
