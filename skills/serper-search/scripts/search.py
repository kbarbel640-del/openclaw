#!/usr/bin/env python3
"""
Serper Search API Client
只使用Serper API
"""
import requests
import json
import sys
import os
from datetime import datetime

WORKSPACE_PATH = os.path.join(os.path.expanduser('~'), '.openclaw', 'workspace')

# Serper API配置
SERPER_API_KEY = "b8571dbbb94e54cf514bde8535625225b0bd7b6b"
SERPER_SEARCH_URL = "https://google.serper.dev/search"
SERPER_NEWS_URL = "https://google.serper.dev/news"

def serper_search(query, num_results=10, search_type="search"):
    """Serper搜索"""
    url = SERPER_NEWS_URL if search_type == "news" else SERPER_SEARCH_URL
    headers = {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {"q": query, "num": num_results}

    response = requests.post(url, headers=headers, json=payload, timeout=15)
    response.raise_for_status()
    return response.json()

def save_results(data, query, search_type="search"):
    """保存结果"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"serper_{search_type}_{timestamp}.json"
    filepath = os.path.join(WORKSPACE_PATH, filename)

    result = {
        "source": "serper",
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
            num_results = int(float(sys.argv[i + 2]))
        else:
            query_parts.append(arg)

    query = " ".join(query_parts)

    print(f"Serper Search: {query} ({search_type}, num={num_results})")

    try:
        results = serper_search(query, num_results, search_type)
        filepath = save_results(results, query, search_type)
        print(f"✅ Saved to: {filepath}")

        # 预览
        if search_type == "news" and "news" in results:
            print(f"\nTop {min(3, len(results['news']))} results:")
            for i, item in enumerate(results['news'][:3], 1):
                print(f"  {i}. {item.get('title', 'N/A')[:60]}")

    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
