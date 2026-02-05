# LINE Automation Skill

透過 PyAutoGUI 操控 LINE Desktop 發送訊息。

## 前提條件

- LINE Desktop 必須開啟
- macOS 必須授權 Accessibility（系統偏好設定 → 隱私與安全性 → 輔助使用）
- 螢幕必須開著（不能 headless）

## 路徑

```
~/Documents/LINE_pyautogui/
```

## 使用方式

### CLI（推薦）

```bash
cd ~/Documents/LINE_pyautogui
source venv/bin/activate

# 開啟 LINE
line-cli open

# 發送訊息
line-cli send "聯繫人名稱" "訊息內容"

# 讀取最後一則訊息
line-cli read
line-cli read --recipient "聯繫人名稱"
```

### Python

```python
from line_pyautogui.line_automation import LINEAutomation

line = LINEAutomation()
line.open_line()
line.send_message("聯繫人名稱", "訊息內容")
```

## 快速指令

發送訊息到 LINE（一行）：

```bash
cd ~/Documents/LINE_pyautogui && source venv/bin/activate && line-cli send "聯繫人名稱" "訊息內容"
```

## 常見聯繫人

| 名稱 | 備註 |
|------|------|
| 杜甫 | 自己（測試用） |
| （待補充） | |

## 注意事項

1. 發送前確保 LINE 視窗可見
2. 發送期間不要動滑鼠/鍵盤
3. 中文用剪貼板貼上，不用 typewrite
4. 如果卡住，按 Esc 可能有幫助

## 除錯

加 `--debug` 看詳細日誌：

```bash
line-cli --debug send "聯繫人" "測試"
```

日誌會寫到 `line_automation_debug.log`。
