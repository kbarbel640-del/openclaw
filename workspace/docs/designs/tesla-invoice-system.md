# Tesla 發票系統架構設計

萃取自 `thinker-monorepo/tesla/` 和 `thinker-cafe-workspace/scenes/vigor_space/`

## 概述

Tesla 發票系統是一個自動化的充電費用憑證生成系統，包含以下核心組件：

1. **FetchScene** - 從 Tesla API 抓取充電記錄
2. **InvoiceScene** - 生成發票圖片
3. **TeslaAuthManager** - OAuth Token 管理
4. **MongoDBAccess** - 資料持久化

## 系統流程

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Tesla API  │────▶│  FetchScene  │────▶│  MongoDB    │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐     ┌─────────────┐
                    │ InvoiceScene │────▶│ 發票圖片    │
                    └──────────────┘     └─────────────┘
```

## 核心模組

### 1. TeslaAuthManager

**職責**：管理 Tesla OAuth 2.0 認證

```python
class TeslaAuthManager:
    """
    關鍵特性：
    - 線程安全的 token 管理
    - 自動 token 刷新（到期前 5 分鐘）
    - 支援環境變數或參數注入 credentials
    """
    
    _DEFAULT_TOKEN_EXPIRY_BUFFER_SECONDS = 300
    _DEFAULT_SCOPE = "openid email offline_access vehicle_device_data vehicle_cmds vehicle_charging_cmds"
    _DEFAULT_API_BASE_URL = "https://owner-api.teslamotors.com"
    _DEFAULT_OAUTH_URL = "https://auth.tesla.com/oauth2/v3/token"
```

**環境變數**：
- `TESLA_CLIENT_ID`
- `TESLA_CLIENT_SECRET`
- `TESLA_SCOPE`
- `TESLA_API_BASE_URL`
- `TESLA_OAUTH_URL`

### 2. FetchScene

**職責**：從 Tesla API 抓取充電記錄並存入 MongoDB

**流程**：
1. 透過車牌查詢 MongoDB 取得 client credentials
2. 使用 TeslaAuthManager 取得 access token
3. 呼叫 Tesla Charging History API
4. 格式化資料並存入 MongoDB（使用 upsert 防重複）

**資料格式化**：
```python
def _format_session_to_schema(session, carplate, vin):
    """
    欄位映射：
    - record_hash: MD5(vin + date + time + cost) - 唯一識別
    - carplate: 車牌
    - vin: 車輛識別碼
    - station: 充電站
    - charging_datetime: Python datetime
    - cost_twd: 總費用（台幣）
    - invoice_generated: 是否已生成發票
    - raw_data: 原始 API 回應
    """
```

### 3. InvoiceScene

**職責**：從充電記錄生成發票圖片

**圖片規格**：
- 尺寸：500 x 710 px
- 格式：PNG
- 包含：VIN、車牌、日期時間、費用明細、充電地點

**命名規則**：
```
{車牌}_特斯拉_充電費_{YYYYMMDD}_{HHMMSS}_{總費用}.png
```

### 4. InvoiceImageGenerator

**職責**：PIL-based 圖片生成

**支援類型**：
- ETC（電子收費）
- TeslaCharge（Tesla 充電）
- Parking（停車費）

**跨平台字型支援**：
- macOS: PingFang.ttc, Hiragino Sans GB
- Linux: SourceHanSansTC, wqy-zenhei
- Windows: msyh.ttc, simhei.ttf

## 資料庫設計

### accounts Collection
```javascript
{
  "carplate": "ABC-1234",
  "clientId": "tesla_client_id",
  "clientSecret": "tesla_client_secret",
  "vin": "5YJ3E1EA1NF000001",
  "etc_acc": "etag_account",
  "etc_pwd": "etag_password",
  "token": "bearer_token_for_api"
}
```

### tesla_charging_records Collection
```javascript
{
  "record_hash": "md5_hash",
  "carplate": "ABC-1234",
  "vin": "5YJ3E1EA1NF000001",
  "station": "Supercharger 台北內湖",
  "charging_date": "20250522",
  "charging_time": "14:30",
  "charging_datetime": ISODate("2025-05-22T14:30:00Z"),
  "charging_cost": 350,
  "parking_cost": 10,
  "cost_twd": 360,
  "energy_kwh": 35.5,
  "invoice_generated": false,
  "sync_time": ISODate("2025-05-22T16:00:00Z"),
  "raw_data": { /* 原始 API 回應 */ }
}
```

## CLI 入口

```bash
# 單一車牌抓取
python cli_tesla.py fetch --carplate ABC-1234

# 批次處理
python cli_tesla.py batch --all

# 生成發票
python cli_tesla.py invoice --uuid order-uuid-123
```

## 錯誤處理

- Token 過期：自動刷新
- API 限流：指數退避重試
- 網路錯誤：記錄並跳過，下次重試
- 資料格式錯誤：記錄 warning，繼續處理其他記錄

## 擴展點

1. 新增發票類型：在 `InvoiceImageGenerator` 新增 `create_xxx_invoice_image` 方法
2. 新增資料來源：實作新的 FetchScene 繼承 `TeslaSceneBase`
3. 新增輸出格式：擴展 InvoiceScene 支援 PDF 或其他格式
