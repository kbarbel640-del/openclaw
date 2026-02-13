---
name: daily-briefing
description: Use when you need to generate the daily morning briefing for the老大, aggregating news, emails, Twitter trends, and weather.
metadata:
  openclaw:
    emoji: 📰
    requires:
      python: ">=3.10"
    install:
      - label: "Ensure dependencies"
        command: "uv pip install -r requirements.txt"
    run:
      - label: "Run briefing generator"
        command: "python scripts/briefing.py"
---

# Daily Briefing (Eden协调模式)

老大每天的早报由Eden调用独立skills获取数据后整理发送。

## 架构

```
定时任务 (08:00 GMT+8)
    ↓
Eden执行多个skills获取数据
    ↓
整理成早报发送到Telegram
```

## 独立Skills

| Skill | 功能 | API | 命令 |
|-------|------|-----|------|
| **serper-search** | 马来西亚新闻、金融新闻 | Serper | `python skills/serper-search/scripts/search.py "查询" --news --num N` |
| **serpapi-search** | Twitter热度搜索 | SerpApi | `python skills/serpapi-search/scripts/search.py "twitter trending X" --num N` |
| **email-fetch** | 邮件获取 | IMAP | `python skills/email-fetch/scripts/fetch.py --hours 24` |

## 早报内容

| 模块 | 数据源 | Skill |
|------|--------|-------|
| 🌤️ 天气 | Open-Meteo | 直接API调用 |
| 📰 马来西亚新闻 | Serper | serper-search |
| 📰 金融/经济新闻 | Serper | serper-search |
| 🐦 X(Twitter)热度 | SerpApi | serpapi-search (搜索twitter trending) |
| 📧 邮件 | IMAP | email-fetch |
| 📅 行程 | (待接入) | - |

## Twitter热度搜索

使用SerpApi搜索以下类别：
- 科技趋势: `twitter trending technology`
- AI人工智能: `twitter trending AI`
- 金融股市: `twitter trending finance`
- 全球热点: `trending now breaking news`

## 定时任务

| 任务 | 时间 | Job ID |
|------|------|--------|
| 每日早报 | 08:00 GMT+8 | 08e236b4-61f3-4737-b868-3e1f0b7ad7ea |
| 每周一安全检查 | 周一 00:00 GMT+8 | e005cb60-6dbb-4382-a2bb-fddbb4d0156d |

## API配置

| API | Key | 用途 |
|-----|-----|------|
| Serper | `b8571dbbb94e54cf514bde8535625225b0bd7b6b` | 新闻 |
| SerpApi | `49647fe1edddef86730e5d75c5208bd436ea7f877ccaa8a4ac1b209ef808cc5b` | Twitter热度 |
| Open-Meteo | 免费 | 天气 |

## 测试

```bash
# Serper搜索
python C:\Users\User\Desktop\openclaw\skills\serper-search\scripts\search.py "Malaysia news" --news --num 5

# SerpApi Twitter搜索
python C:\Users\User\Desktop\openclaw\skills\serpapi-search\scripts\search.py "twitter trending AI" --num 5

# 邮件获取
python C:\Users\User\Desktop\openclaw\skills\email-fetch\scripts\fetch.py --hours 24 --limit 5
```

## 相关文档

- `WORKFLOW.md` - 详细工作流程
- `skills/serper-search/SKILL.md` - Serper搜索文档
- `skills/serpapi-search/SKILL.md` - SerpApi搜索文档
- `skills/email-fetch/SKILL.md` - 邮件获取文档
```