---
name: serper-search
description: Use when you need to perform Google web searches or news searches via Serper API, e.g., to find information or latest headlines.
metadata:
  openclaw:
    emoji: 🔍
    requires:
      python: ">=3.10"
    install:
      - label: "Install dependencies"
        command: "uv pip install -r requirements.txt"
    run:
      - label: "Search Google (web)"
        command: "python scripts/search.py \"查询词\" --num 10"
      - label: "Search Google (news)"
        command: "python scripts/search.py \"查询词\" --news --num 10"
---

# Serper Search (Google Search via Serper)

使用Serper API进行Google搜索，支持普通搜索和新闻搜索。

## 使用方法

```
搜索: [查询词] --num N --news
```

示例:
```
python scripts/search.py "Malaysia news" --news --num 10
python scripts/search.py "AI 最新发展" --num 5
```

## 配置

API Key: `b8571dbbb94e54cf514bde8535625225b0bd7b6b`

API Endpoints:
- 搜索: `https://google.serper.dev/search`
- 新闻: `https://google.serper.dev/news`

## 输出

结果保存到: `workspace/serper_YYYYMMDD_HHMMSS.json`

## 手动运行

```bash
# 普通搜索
python scripts/search.py "查询词" --num 10

# 新闻搜索
python scripts/search.py "查询词\" --news --num 10
```