---
name: etc-query
description: 查詢遠通 eTag ETC 餘額、通行費、欠費狀態。觸發詞：查 ETC、ETC 餘額、通行費查詢、eTag 狀態。支援 Guest（車號+統編）和 Member（帳號+密碼）兩種登入模式。
---

# ETC 查詢 Skill

透過瀏覽器自動化查詢遠通 eTag 會員中心。

## 登入模式

### 1. Guest 模式（車號 + 統編）
- 適用：快速查單一車輛
- 需要：車牌號碼、統一編號或身分證

### 2. Member 模式（帳號 + 密碼）
- 適用：查所有綁定車輛
- 需要：會員帳號、密碼
- 優點：一次看所有車、歷史紀錄完整

## 執行流程

### Step 1: 啟動瀏覽器
```
browser action=start profile=clawd
```

### Step 2: 進入登入頁
```
browser action=navigate targetUrl="https://member.fetc.net.tw/etagmember2/login.aspx"
```

### Step 3: 取得驗證碼截圖
```
browser action=screenshot
```
從截圖中識別驗證碼（4 位數字）。

### Step 4: 填入登入資訊

#### Guest 模式
1. 點擊「訪客登入」tab
2. 填入車牌號碼
3. 填入統編或身分證
4. 填入驗證碼
5. 點擊登入

#### Member 模式
1. 確認在「會員登入」tab
2. 填入帳號
3. 填入密碼
4. 填入驗證碼
5. 點擊登入

### Step 5: 讀取資料

登入成功後，snapshot 頁面內容：
- 車輛清單
- 各車餘額
- 欠費狀態
- 近期通行費

### Step 6: 整理報告

格式範例：
```
🎉 ETC 查詢成功！

👤 [帳號/車號]
🚗 車輛總數：X 台
━━━━━━━━━━━━━━━━━━━━━━━

📊 近 12 個月通行費：$XX,XXX
📅 本月通行費：$X,XXX
💰 9 折優惠已省：~$X,XXX

🚗 [車牌1] — 餘額 XXX 元
🚗 [車牌2] — ⚠️ 欠費通知
...
```

## 憑證位置

Member 登入憑證存於：`~/Documents/credentials/etc.json`

```json
{
  "accounts": [
    { "name": "chenhungli", "account": "chenhungli", "password": "Aa585858" },
    { "name": "ping0508", "account": "ping0508", "password": "Aa585858" }
  ]
}
```

**預設用 chenhungli**，除非指定要查 ping0508 的車。

## 注意事項

1. **驗證碼需人工識別**：從截圖中讀取 4 位數字
2. **Session 有時效**：約 10 分鐘無操作會登出
3. **錯誤處理**：驗證碼錯誤會顯示提示，需重新取得並輸入
