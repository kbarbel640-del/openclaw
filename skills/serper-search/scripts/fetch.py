#!/usr/bin/env python3
"""
Serper Search API Client
支持普通搜索和新闻搜索
"""
import requests
import json
import sys
import os
from datetime import datetime

WORKSPACE_PATH = os.path.join(os.path.expanduser('~'), '.openclaw', 'workspace')

# API配置
SERPER_API_KEY = "b8571dbbb94e54cf514bde8535625225b0bd7b6b"
SERPER_URL = "https://google.serper.dev/search"
SERPER_NEWS_URL = "https://google.serper.dev/news"

# 备用SerpApi
SERPAPI_BACKUP_KEY = "49647fe1edddef86730e5d75c5208bd436ea7f877ccaa8a4ac1b209ef808cc5b"
SERPAPI_URL = "https://serpapi.com/search"

def serpapi_search(query, num_results=10, search_type="search"):
    """SerpApi 备用搜索"""
    params = {
        "engine": f"google_{search_type}",
        "q": query,
        "api_key": SERPAPI_BACKUP_KEY,
        "num": num_results
    }

    try:
        response = requests.get(SERPAPI_URL, params=params, timeout=15)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"SerpApi error: {e}")
        return None

def serper_search(query, num_results=10, search_type="search"):
    """Serper 主搜索"""
    url = SERPER_NEWS_URL if search_type == "news" else SERPER_URL
    headers = {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {"q": query, "num": num_results}

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=15)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Serper error: {e}, switching to backup...")
        return serpapi_search(query, num_results, search_type)

def save_results(data, query, search_type="search"):
    """保存搜索结果"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"serper_{search_type}_{timestamp}.json"
    filepath = os.path.join(WORKSPACE_PATH, filename)

    result = {
        "query": query,
        "type": search_type,
        "timestamp": datetime.now().isoformat(),
        "data": data
    }

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"Saved to: {filepath}")
    return filepath

def main():
    if len(sys.argv) < 2:
        print("Usage: python fetch.py <query> [--news] [--num N]")
        sys.exit(1)

    # 解析参数
    args = sys.argv[1:]

    # 提取查询词（不包括--news/--num）
    query_parts = []
    search_type = "search"
    num_results = 10

    i = 0
    while i < len(args):
        arg = args[i]

        if arg == "--news":
            search_type = "news"
        elif arg == "--num" and i + 1 < len(args):
            num_results = int(args[i + 1])
            i += 1  # 跳过下一个参数
        else:
            query_parts.append(arg)

        i += 1

    query = " ".join(query_parts)

    print(f"Searching: {query} ({search_type}, max {num_results})...")

    results = serper_search(query, num_results, search_type)

    if results:
        save_results(results, query, search_type)
        print(f"Success! Got results.")

        # Print preview
        if search_type == "news" and "news" in results:
            print(f"\nTop {min(3, len(results['news']))} results:")
            for i, item in enumerate(results['news'][:3], 1):
                print(f"  {i}. {item.get('title', 'N/A')[:60]}")
        elif "organic" in results:
            print(f"\nTop {min(3, len(results['organic']))} results:")
            for i, item in enumerate(results['organic'][:3], 1):
                print(f"  {i}. {item.get('title', 'N/A')[:60]}")
    else:
        print("Failed to get results")

if __name__ == '__main__':
    main()
