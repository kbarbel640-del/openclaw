# Error Recovery Hook

自動檢測 EBADF 錯誤並觸發 Gateway 自癒。

## 功能

1. 監聽錯誤事件
2. 檢測 EBADF / spawn 錯誤
3. 自動執行 `launchctl kickstart -k`
4. 發送 Telegram 通知

## 防抖機制

- 1 分鐘內不重複觸發
- 避免錯誤風暴

## 已知限制

- Gateway restart 後，現有 session 可能需要 `/restart` 重連
- 這是 session state 問題，非 gateway 問題

## 事件訂閱

```javascript
handler.events = [
  'tool.error',
  'tool.exec.error',
  'exec.error',
  'error',
  'agent.error'
];
```

## 通知格式

```
🔧 Error Recovery Hook
檢測到 EBADF 錯誤，正在執行 kickstart...

✅ Error Recovery Hook
Kickstart 完成
⚠️ 注意：現有 session 可能需要 /restart 重連
```
