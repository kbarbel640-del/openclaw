#!/usr/bin/env python3
"""
News Fetcher using Serper API
"""
import requests
import json
import os

WORKSPACE_PATH = os.path.join(os.path.expanduser('~'), '.openclaw', 'workspace')
SERPER_API_KEY = "b8571dbbb94e54cf514bde8535625225b0bd7b6b"
SERPER_URL = "https://google.serper.dev/news"

def fetch_serper_news(query, num_results=10):
    """Fetch news from Serper API"""
    headers = {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json"
    }

    payload = {
        "q": query,
        "num": num_results
    }

    try:
        response = requests.post(SERPER_URL, headers=headers, json=payload, timeout=15)
        response.raise_for_status()

        data = response.json()

        # Parse results
        articles = []
        if "news" in data:
            for item in data["news"]:
                articles.append({
                    "title": item.get("title", ""),
                    "url": item.get("link", ""),
                    "snippet": item.get("snippet", ""),
                    "date": item.get("date", ""),
                    "source": item.get("source", "")
                })

        return articles

    except Exception as e:
        print(f"Error fetching from Serper: {e}")
        if "response" in locals():
            print(f"Response: {response.text}")
        return []

def save_news_results(news_dict):
    """Save news results to file"""
    news_file = os.path.join(WORKSPACE_PATH, 'news_search_results.json')
    with open(news_file, 'w', encoding='utf-8') as f:
        json.dump(news_dict, f, ensure_ascii=False, indent=2)
    print(f"Saved news to {news_file}")
    return news_file

def main():
    """Fetch all news categories"""
    queries = {
        "马来西亚热门新闻": "Malaysia news 每日头条 最新新闻",
        "金融经济新闻": "finance news economy stock market financial markets"
    }

    all_news = {}

    for category, query in queries.items():
        print(f"\nFetching: {category}")
        print(f"Query: {query}")

        articles = fetch_serper_news(query, num_results=10)

        if articles:
            all_news[category] = articles
            print(f"✅ Got {len(articles)} articles")

            for i, art in enumerate(articles[:3], 1):
                print(f"   {i}. {art.get('title', 'N/A')[:60]}")
        else:
            all_news[category] = []
            print(f"❌ No articles found")

    # Save results
    save_news_results(all_news)

    # Print summary
    print("\n" + "=" * 50)
    print("News Fetch Summary:")
    print("=" * 50)
    for category, articles in all_news.items():
        print(f"{category}: {len(articles)} articles")

if __name__ == '__main__':
    main()
