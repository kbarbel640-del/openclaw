# 每日早报执行计划 (Execution Plan)

## 定时任务配置

### Cron Job: 每日早报
```json
{
  "id": "08e236b4-61f3-4737-b868-3e1f0b7ad7ea",
  "name": "每日早报 8AM",
  "schedule": {
    "kind": "cron",
    "expr": "30 0 * * *",
    "tz": "Asia/Kuala_Lumpur"
  },
  "payload": {
    "kind": "systemEvent",
    "text": "触发每日早报：马来西亚新闻、金融经济、X热度、今日行程、天气、昨日重要邮件。老大，早上8点到了！🐥"
  }
}
```

---

## 执行流程 (Execution Flow)

### 08:00 触发时刻

1. **Cron发送系统事件**
   - 触发关键词匹配: "每日早报"
   - Eden识别并执行 `briefing.py`

2. **邮件抓取** ✅ (已完成)
   - 连接Gmail IMAP (imap.gmail.com:993)
   - 连接Outlook IMAP (outlook.office365.com:993) - 待修复
   - 获取过去24小时邮件 (Top 10)
   - 保存到 `workspace/recent_emails_YYYY-MM-DD.json`

3. **新闻抓取** ✅ (已完成 - 使用Serper)
   - 马来西亚热门新闻 - Serper `/news`
   - 金融/经济新闻 - Serper `/news`
   - 保存到 `workspace/news_search_results.json`

4. **X(Twitter)热度** (待实现)
   - 使用Serper搜索 Twitter 热词
   - 搜索词: "technology trends", "AI artificial intelligence", "financial markets"

5. **天气** ✅ (已完成)
   - 获取吉隆坡天气
   - 使用 Open-Meteo API (免费)

6. **行程** (待实现)
   - Google Calendar
   - 需要OAuth设置

7. **生成早报** ✅
   - 整合所有模块
   - 保存到 `workspace/daily_briefing_YYYY-MM-DD.md`

8. **发送到Telegram** (待实现)
   - 使用message工具发送
   - 格式化为Telegram Markdown

---

## 当前状态 (Current Status)

| 模块 | 状态 | 说明 |
|------|------|------|
| ✅ 邮件抓取 | **完成** | Gmail正常，Outlook需诊断 |
| ✅ 马来西亚新闻 | **完成** | Serper实时数据 (10条) |
| ✅ 金融/经济新闻 | **完成** | Serper实时数据 (10条) |
| ⏳ X(Twitter)热度 | 待实现 | 可用Serper搜索 |
| ✅ 天气 | **完成** | Open-Meteo免费API (正常工作) |
| ⏳ 行程 | 待实现 | 需要Google Calendar OAuth |
| ⏳ Telegram发送 | 待实现 | 需要集成message工具 |

---

## API配置

### Serper API (新闻搜索)

- **端点**: `https://google.serper.dev/news`
- **API Key**: 已配置在 `briefing.py`
- **限制**: 每月2,500次免费请求

### Open-Meteo API (天气)

- **端点**: `https://api.open-meteo.com/v1/forecast`
- **位置**: 吉隆坡 (3.1390, 101.6869)
- **限制**: 无需API Key，免费使用

---

## 文件结构

```
skills/daily-briefing/
├── SKILL.md                 # 技能文档
├── EXECUTION_PLAN.md        # 执行计划 (本文件)
├── briefing.py              # 主程序
├── serper_news.py           # Serper新闻抓取 (独立)
├── outlook_diagnostic.py    # Outlook诊断工具
└── news_fetcher.py          # 旧版新闻抓取 (已废弃)

workspace/
├── email_config.json        # 邮件配置
├── news_search_results.json # 搜索结果缓存
├── daily_briefing_YYYY-MM-DD.md     # 早报输出
├── recent_emails_YYYY-MM-DD.json    # 邮件数据
└── briefing_data_YYYY-MM-DD.json    # 完整数据
```

---

## Outlook修复步骤

**诊断工具已创建:** `outlook_diagnostic.py`

**运行:**
```bash
python C:\Users\User\Desktop\openclaw\skills\daily-briefing\outlook_diagnostic.py
```

**常见问题:**
1. LOGIN failed - App Password错误或未创建
2. 需要确认IMAP已启用:
   - https://outlook.live.com/mail/options/mail/accounts/popimap
3. 重新创建App Password:
   - https://account.microsoft.com/security
   - 高级安全选项 → 应用密码

---

## 调试命令

```bash
# 手动运行早报
python C:\Users\User\Desktop\openclaw\skills\daily-briefing\briefing.py

# 查看输出
cat C:\Users\User\.openclaw\workspace\daily_briefing_*.md

# 测试新闻抓取
python C:\Users\User\Desktop\openclaw\skills\daily-briefing\serper_news.py

# Outlook诊断
python C:\Users\User\Desktop\openclaw\skills\daily-briefing\outlook_diagnostic.py

# 查看定时任务
openclaw cron list
```

---

## 下一步优先级

### 优先级 1 - Outlook修复
- 运行诊断工具
- 找到正确的IMAP配置
- 更新 `email_config.json`

### 优先级 2 - X热度
- 使用Serper搜索Twitter热词
- 添加到早报模板

### 优先级 3 - Telegram发送
- 集成OpenClaw message工具
- 格式化输出为Telegram Markdown
- 测试发送

### 优先级 4 - Calendar
- 配置Google Calendar OAuth
- 或考虑其他日历方案
