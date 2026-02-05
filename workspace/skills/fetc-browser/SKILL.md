# FETC Browser Skill

用 Moltbot browser 工具直接查詢遠通電收（FETC）費用，不需要 Docker 或 Selenium。

## 功能

- **查詢單一車輛**：餘額、通行費、停車費記錄
- **批量查詢**：讀取 account_info 檔案，批量查所有車輛
- **自動存儲**：將資料存入 Supabase

## 帳號資料位置

```
~/Documents/fetc/.account_info
```

格式（TSV）：
```
license_plate	account_type	username_or_taxid	password
REC-0733	guest	54533616	NA
REB-7702	member	chenhungli	Aa585858
```

## Supabase 配置

```
URL: https://fgrqbbttalnpepnsozvt.supabase.co
Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...（見 .env）
Table: fees
```

## 使用方式

### 1. 查詢單一車輛（Guest 模式）

```
查 REC-0733 的 ETC 費用
```

執行步驟：
1. `browser navigate` → https://www.fetc.net.tw/
2. 關閉彈窗（如有）
3. 填寫車號、統編、驗證碼
4. 點擊查詢
5. 切換到「通行費紀錄」tab
6. 抓取資料

### 2. 查詢單一車輛（Member 模式）

```
用會員帳號查 REB-7702 的 ETC
```

執行步驟：
1. 點擊「會員登入」tab
2. 填寫帳號、密碼、驗證碼
3. 登入後選擇車輛
4. 抓取資料

### 3. 批量查詢

```
批量查詢所有車輛的 ETC 費用
```

### 4. 查詢 Supabase 已有資料

```bash
# 用腳本快速查詢（不需登入遠通）
~/clawd/scripts/fetc_query.sh REC-0335 toll 30
~/clawd/scripts/fetc_summary.sh
```

## 驗證碼處理

遠通網站有驗證碼，需要：
1. 截圖驗證碼圖片
2. 用 vision 識別（或人工輸入）
3. 填入驗證碼欄位

**技巧**：驗證碼通常是 4 位數字，截圖後 Claude 可以直接識別。

## 頁面結構筆記

### Guest 登入區（#section-3）
- 車號輸入：`textbox "請輸入欲查詢的車號"`
- 統編輸入：`textbox "車主身分證或統一編號"`
- 驗證碼輸入：`textbox "請輸入驗證碼"`
- 驗證碼圖片：旁邊的 img
- 查詢按鈕：`link "查詢"`

### Member 登入區（#section-4）
- 帳號輸入：`#smart-account-login-account`
- 密碼輸入：對應欄位
- 驗證碼：同上
- 登入按鈕：`onclick="ajaxSubmit('sForm4')"`

### 登入後頁面
- 「通行費紀錄」tab：顯示過路費明細
- 「停車費紀錄」tab：顯示停車費明細
- 「餘額紀錄」tab：顯示儲值/扣款記錄

## 資料欄位對照

| FETC 欄位 | Supabase 欄位 | 說明 |
|-----------|--------------|------|
| 日期 | occurred_at | ISO 格式 |
| 扣款/通行費金額 | fee_amount | 數字 |
| 類型 | fee_type | toll/street_parking/short_term_parking |
| 車牌 | license_plate_number | 大寫 |

## 限制

- 每次查詢需要輸入驗證碼（無法完全自動化）
- 建議每天查詢一次，避免頻繁請求
- Member 帳號可查多台車，Guest 只能查單台

## 相關腳本

- `scripts/fetc_query.sh` — 查詢 Supabase 已有資料
- `scripts/fetc_summary.sh` — 全車隊彙總

## 參考

- 原始爬蟲專案：`~/Documents/fetc/`
- Supabase Dashboard：https://supabase.com/dashboard/project/fgrqbbttalnpepnsozvt
