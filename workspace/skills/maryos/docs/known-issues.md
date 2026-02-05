# 已知問題

## 🔴 活躍問題

### KI-001: 影片 >5MB 導致故障
- **嚴重度**：高
- **描述**：Mary 發影片超過 5MB 時，Telegram Bot API 無法下載，Moltbot 處理流程 crash
- **影響**：session 可能中斷
- **對策**：檢測影片大小，>5MB 跳過下載，僅記錄 metadata
- **狀態**：待實作

### KI-002: Google Sheet 重複記錄
- **嚴重度**：高
- **描述**：DailyRecords 同一天有多筆記錄，導致 repliedDays 膨脹（如 69/30）
- **影響**：獎金計算錯誤（如 NT$2519 而非 ~NT$1000）
- **根因**：日期格式不一致 or 寫入未檢查已存在
- **對策**：
  1. 計算時 `Math.min(repliedDays, 30)`
  2. 寫入前檢查當日是否已有記錄
  3. 清理現有重複資料
- **狀態**：已診斷，待修復

## 🟡 注意事項

### KI-003: 時區混亂
- **描述**：系統涉及三個時區（UTC / Asia/Taipei / Asia/Manila）
- **對策**：統一用 Asia/Taipei，Telegram timestamp +8 轉換
- **狀態**：需在遷移時統一處理

## ✅ 已解決

（暫無）
