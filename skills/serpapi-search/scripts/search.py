#!/usr/bin/env python3
"""
SerpApi Search Client
只使用SerpApi
"""
import requests
import json
import sys
import os
from datetime import datetime

WORKSPACE_PATH = os.path.join(os.path.expanduser('~'), '.openclaw', 'workspace')

# SerpApi配置
SERPAPI_KEY = "49647fe1edddef86730e5d75c5208bd436ea7f877ccaa8a4ac1b209ef808cc5b"
SERPAPI_URL = "https://serpapi.com/search"

def serpapi_search(query, num_results=10, search_type="search"):
    """SerpApi搜索"""
    params = {
        "engine": "google",
        "q": query,
        "api_key": SERPAPI_KEY,
        "num": num_results
    }
    # 新闻搜索使用google_news引擎
    if search_type == "news":
        params["engine"] = "google_news"

    response = requests.get(SERPAPI_URL, params=params, timeout=15)
    response.raise_for_status()
    return response.json()

def save_results(data, query, search_type="search"):
    """保存结果"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"serpapi_{search_type}_{timestamp}.json"
    filepath = os.path.join(WORKSPACE_PATH, filename)

    result = {
        "source": "serpapi",
        "query": query,
        "type": search_type,
        "timestamp": datetime.now().isoformat(),
        "data": data
    }

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    return filepath

def main():
    if len(sys.argv) < 2:
        print("Usage: python search.py <query> [--news] [--num N]")
        sys.exit(1)

    # 解析参数
    query_parts = []
    search_type = "search"
    num_results = 10

    for i, arg in enumerate(sys.argv[1:]):
        if arg == "--news":
            search_type = "news"
        elif arg == "--num" and i + 1 < len(sys.argv) - 1:
            num_results = int(sys.argv[i + 2])
        else:
            query_parts.append(arg)

    query = " ".join(query_parts)

    print(f"SerpApi Search: {query} ({search_type}, num={num_results})")

    try:
        results = serpapi_search(query, num_results, search_type)
        filepath = save_results(results, query, search_type)
        print(f"✅ Saved to: {filepath}")

        # 预览
        if search_type == "news" and "news_results" in results:
            print(f"\nTop {min(3, len(results['news_results']))} results:")
            for i, item in enumerate(results['news_results'][:3], 1):
                print(f"  {i}. {item.get('title', 'N/A')[:60]}")
        elif "organic_results" in results:
            print(f"\nTop {min(3, len(results['organic_results']))} results:")
            for i, item in enumerate(results['organic_results'][:3], 1):
                print(f"  {i}. {item.get('title', 'N/A')[:60]}")

    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
