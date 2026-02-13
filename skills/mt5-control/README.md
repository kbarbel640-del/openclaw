# MT5 Control Skill

通过Python API控制MetaTrader 5终端，实现自动交易、账户管理、市场数据查询等功能。

## 📦 安装依赖

```bash
pip install MetaTrader5 pandas pytz
```

## 🚀 快速开始

### 1. 启动MT5终端

MT5必须运行才能通过API操作：

```bash
# Windows
"C:\Program Files\MetaTrader 5\terminal64.exe"

# 或使用批处理脚本
cd C:\Users\User\Desktop\openclaw\skills\mt5-control
mt5-control.bat start
```

### 2. 检查账户状态

```bash
python scripts/account_status.py

# 或使用批处理
mt5-control.bat status
```

输出示例：
```
📊 MT5 Account Status
============================================================
🏦 Server:    MetaQuotes-Demo
👤 Login:     12345678
💱 Currency:  USD
💵 Balance:   10,000.00
💎 Equity:    10,250.50
📊 Margin:    250.00
🆓 Free:      9,750.00
📈 Level:     4100.20%
💰 Profit:    +250.50

📝 Open Positions (2)
============================================================
🟢 BUY  EURUSD     | Vol:   0.10 | @ 1.08950 | P/L: ✅ +150.50
🔴 SELL GBPUSD     | Vol:   0.05 | @ 1.27000 | P/L: ✅ +100.00
------------------------------------------------------------
✅ Total Floating P/L: +250.50 USD
```

### 3. 下单交易

```bash
# 基础用法: python quick_trade.py SYMBOL TYPE VOLUME
python scripts/quick_trade.py EURUSD BUY 0.01

# 带止损止盈
python scripts/quick_trade.py EURUSD SELL 0.1 1.1000 1.0900

# 带备注
python scripts/quick_trade.py XAUUSD BUY 0.05 NONE NONE "买入黄金"

# 使用批处理
mt5-control.bat trade EURUSD BUY 0.01
```

### 4. 平仓

```bash
# 查看所有持仓并选择平仓
python scripts/close_positions.py

# 平掉指定持仓
python scripts/close_positions.py 12345678

# 全部平仓
python scripts/close_positions.py --all

# 平掉指定货币对的所有持仓
python scripts/close_positions.py --symbol EURUSD
```

### 5. 获取市场数据

```bash
# 基础用法: python market_data.py SYMBOL [TIMEFRAME] [COUNT]
python scripts/market_data.py EURUSD H1 100

# 支持时间周期: M1, M5, M15, M30, H1, H4, D1, W1, MN1
python scripts/market_data.py XAUUSD M5 50

# 保存到CSV
python scripts/market_data.py EURUSD D1 365 --csv
```

输出示例：
```
📊 EURUSD Current Price
============================================================
🟢 Ask:  1.08952
🔴 Bid:  1.08949
📏 Spread: 0.3 pips
📦 Volume: 1,250

📊 EURUSD H1 Data (Last 100 bars)
============================================================
Time                 Open        High        Low         Close       Volume   
--------------------------------------------------------------------------------
2026-02-04 05:00:00  1.08915     1.08980     1.08900     1.08950     1,250    
2026-02-04 06:00:00  1.08950     1.09020     1.08930     1.08990     980      
2026-02-04 07:00:00  1.08990     1.09050     1.08960     1.09010     1,100    
2026-02-04 08:00:00  1.09010     1.09080     1.08995     1.09030     1,320    
2026-02-04 09:00:00  1.09030     1.09090     1.09010     1.09052     1,500    

📈 Statistics:
  High (period):  1.09500
  Low (period):   1.08500
  Close (latest): 1.09052
  Range:          0.01000
  Trend (10 bars): 🟢 Bullish ▲ (+0.35%)
```

## ⚠️ 重要提示

1. **MT5必须运行**: Python API需要MT5终端处于登录状态
2. **先测试**: 建议先在模拟账户测试
3. **错误检查**: 所有脚本都有错误处理，失败时会显示原因
4. **止损止盈**: 建议设置止损来控制风险

## 📁 文件说明

| 文件 | 说明 |
|------|------|
| `SKILL.md` | 完整技能文档 |
| `scripts/account_status.py` | 账户状态检查 |
| `scripts/quick_trade.py` | 快速下单脚本 |
| `scripts/close_positions.py` | 平仓脚本 |
| `scripts/market_data.py` | 市场数据获取 |
| `mt5-control.bat` | Windows快速启动器 |

## 🔧 常见错误

| 错误 | 原因 | 解决方法 |
|------|------|----------|
| MT5 initialize failed | MT5未运行 | 启动terminal64.exe |
| Symbol not found | 货币对未添加 | 在MT5中添加该货币对 |
| Trade disabled | 交易未启用 | 工具→选项→启用交易 |
| Invalid volume | 手数不符合要求 | 检查经纪商最小/最大手数 |

## 📊 支持的时间周期

- `M1` - 1分钟
- `M5` - 5分钟
- `M15` - 15分钟
- `M30` - 30分钟
- `H1` - 1小时
- `H4` - 4小时
- `D1` - 日线
- `W1` - 周线
- `MN1` - 月线

---

由Eden 🐥 创建 - 量化交易专用
