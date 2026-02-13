---
name: serpapi-search
description: Use when you need to perform Google web searches or news searches via SerpApi, e.g., as a backup search source or to get additional results.
metadata:
  openclaw:
    emoji: 🔎
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

# SerpApi Search (Google Search via SerpApi)

使用SerpApi进行Google搜索，支持普通搜索和新闻搜索。

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

API Key: `49647fe1edddef86730e5d75c5208bd436ea7f877ccaa8a4ac1b209ef808cc5b`

API Endpoint: `https://serpapi.com/search`

## 输出

结果保存到: `workspace/serpapi_YYYYMMDD_HHMMSS.json`

## 手动运行

```bash
# 普通搜索
python scripts/search.py "查询词" --num 10

# 新闻搜索
python scripts/search.py "查询词" --news --num 10
```