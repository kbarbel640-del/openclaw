# Daily Briefing Workflow (每日早报工作流程)

## 架构

```
定时任务 08:00
    ↓
分别调用3个独立skills获取数据:
    ├─ python skills/serper-search/scripts/search.py "Malaysia news" --news --num 10
    ├─ python skills/serper-search/scripts/search.py "finance news economy" --news --num 10
    ├─ python skills/serpapi-search/scripts/search.py "twitter trending technology" --news --num 10
    ├─ python skills/serpapi-search/scripts/search.py "twitter trending AI" --news --num 10
    ├─ python skills/serpapi-search/scripts/search.py "twitter trending finance" --news --num 10
    ├─ python skills/serpapi-search/scripts/search.py "twitter trending" --num 10
    ├─ python skills/email-fetch/scripts/fetch.py --hours 24
    └─ 获取天气 (Open-Meteo API)
    ↓
Eden 读取workspace中的JSON文件
    ↓
整理成早报发送到Telegram
```

## 独立Skills

| Skill | 路径 | 功能 | 输出 |
|-------|------|------|------|
| **serper-search** | `skills/serper-search/scripts/search.py` | 马来西亚新闻、金融新闻 | `serper_*.json` |
| **serpapi-search** | `skills/serpapi-search/scripts/search.py` | Twitter热度搜索 | `serpapi_*.json` |
| **email-fetch** | `skills/email-fetch/scripts/fetch.py` | Gmail邮件 | `emails_*.json` |

## 定时任务

### Cron Job: 每日早报 08:00
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
    "text": "触发每日早报：调用独立skills获取数据。老大，早上8点到了！🐥"
  }
}
```

## Eden执行脚本

定时任务触发后，Eden执行以下命令：

```bash
# 马来西亚新闻 (Serper)
python C:\Users\User\Desktop\openclaw\skills\serper-search\scripts\search.py "Malaysia news 今日头条" --news --num 10

# 金融新闻 (Serper)
python C:\Users\User\Desktop\openclaw\skills\serper-search\scripts\search.py "finance news economy stock market" --news --num 10

# Twitter热度 - 科技 (SerpApi)
python C:\Users\User\Desktop\openclaw\skills\serpapi-search\scripts\search.py "twitter trending technology" --num 10

# Twitter热度 - AI (SerpApi)
python C:\Users\User\Desktop\openclaw\skills\serpapi-search\scripts\search.py "twitter trending AI artificial intelligence" --num 10

# Twitter热度 - 金融 (SerpApi)
python C:\Users\User\Desktop\openclaw\skills\serpapi-search\scripts\search.py "twitter trending finance stock market" --num 10

# Twitter热度 - 全球热点 (SerpApi)
python C:\Users\User\Desktop\openclaw\skills\serpapi-search\scripts\search.py "trending now breaking news" --num 10

# 邮件获取
python C:\Users\User\Desktop\openclaw\skills\email-fetch\scripts\fetch.py --hours 24 --limit 10
```

## 天气获取

使用Open-Meteo API直接调用：
- URL: `https://api.open-meteo.com/v1/forecast?latitude=3.1390&longitude=101.6869&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=Asia/Kuala_Lumpur`

## API配置

### Serper API
- **Key**: `b8571dbbb94e54cf514bde8535625225b0bd7b6b`
- **用途**: 马来西亚新闻、金融新闻
- **Endpoint**: `https://google.serper.dev/news`

### SerpApi (备用)
- **Key**: `49647fe1edddef86730e5d75c5208bd436ea7f877ccaa8a4ac1b209ef808cc5b`
- **用途**: Twitter热度搜索
- **Endpoint**: `https://serpapi.com/search`

### Open-Meteo (天气)
- **用途**: 吉隆坡天气
- **免费使用，无需API Key**

## 输出文件

| 文件格式 | 示例 |
|----------|------|
| 邮件 | `emails_20260204_060000.json` |
| Serper新闻 | `serper_news_20260204_060000.json` |
| SerpApi搜索 | `serpapi_search_20260204_060000.json` |

## 早报内容

1. 🌤️ 天气 (吉隆坡)
2. 📰 马来西亚热门新闻 (Serper, 10条)
3. 📰 金融/经济新闻 (Serper, 10条)
4. 🐦 X(Twitter)热度 (SerpApi, 分4个类别搜索)
   - 科技趋势
   - AI人工智能
   - 金融股市
   - 全球热点
5. 📧 昨日重要邮件 (Top 10)
6. 📅 今日行程 (待接入)

## 邮件配置

- **Gmail**: ✅ `wongjunman1@gmail.com`
- **Outlook**: ❌ IMAP已禁用，建议转发到Gmail

配置文件: `workspace/email_config.json`

## 测试命令

```bash
# 测试Serper搜索
python C:\Users\User\Desktop\openclaw\skills\serper-search\scripts\search.py "Malaysia news" --news --num 5

# 测试SerpApi Twitter搜索
python C:\Users\User\Desktop\openclaw\skills\serpapi-search\scripts\search.py "twitter trending AI" --num 5

# 测试邮件获取
python C:\Users\User\Desktop\openclaw\skills\email-fetch\scripts\fetch.py --hours 24 --limit 5

# 查看输出文件
dir C:\Users\User\.openclaw\workspace\*.json
```

## 更新日志

- 2026-02-04: 架构完成
  - 3个独立skills创建
  - Twitter热度用SerpApi搜索
  - Eden负责整合并发送
