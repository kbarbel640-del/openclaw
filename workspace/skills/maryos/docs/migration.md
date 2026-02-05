# MaryOS 遷移計劃

## 策略：漸進式

無極與 NPC B 並存，逐步接管功能，確認穩定後退役 NPC B。

## Phases

### Phase 1: 理解 + Skill 文檔 ✅
- [x] 閱讀 maryos 全部原始碼
- [x] 理解核心流程
- [x] 寫成 skill（SKILL.md + 配置 + prompt + 模板）
- [x] 杜甫審批結構

### Phase 2: 監聽 + 識別 Mary
- [x] 確認無極已在 LoLoTang 群（-4745247300）
- [x] 設定 autoDetect flag — 收到非 bot 訊息自動記錄 sender ID
- [ ] Mary 發訊息 → 自動捕獲 User ID → 通知杜甫確認
- [ ] 確認後寫入 config.json
- [ ] 測試：收到 Mary 訊息時記錄到 log

### Phase 3: AI 分析 + Sheets 寫入
- [ ] 用 Claude 分析 Mary 的日報（對照 prompts/analyzer.md）
- [ ] 取得 Google Sheets 寫入權限
- [ ] 實作：分析結果寫入 DailyRecords
- [ ] 與 NPC B 的記錄比對驗證

### Phase 4: 定時訊息接管
- [ ] 建立 cron：08:00 早安
- [ ] 建立 cron：21:30 晚安
- [ ] 建立 cron：月底獎金
- [ ] 測試一週，與 NPC B 輸出比對

### Phase 5: NPC B 退役
- [ ] 停用 maryos GitHub Actions
- [ ] 無極穩定運轉 7 天
- [ ] 歸檔本文件

## 風險
| 風險 | 影響 | 對策 |
|------|------|------|
| 影片 >5MB crash | 服務中斷 | 跳過下載，僅記錄 metadata |
| Sheets 寫入重複 | 獎金計算錯誤 | update-or-insert + repliedDays cap |
| 無極 session 壓縮 | 丟失 Mary 訊息上下文 | 即時寫入 Sheets，不依賴 session 記憶 |
