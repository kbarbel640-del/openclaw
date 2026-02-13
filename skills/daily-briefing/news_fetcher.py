#!/usr/bin/env python3
"""
News Fetcher for Daily Briefing
"""
import json
import os
from datetime import datetime

WORKSPACE_PATH = os.path.join(os.path.expanduser('~'), '.openclaw', 'workspace')

def save_news(category, articles, date_str):
    """Save news articles to file"""
    news_path = os.path.join(WORKSPACE_PATH, f'news_{category}_{date_str}.json')
    with open(news_path, 'w', encoding='utf-8') as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)
    return news_path

def format_news_section(news_data):
    """Format news section for briefing"""
    output = ""

    for category, articles in news_data.items():
        if not articles:
            output += f"📰 **{category}**\n暂无新闻\n\n"
            continue

        output += f"📰 **{category}**\n\n"

        for i, article in enumerate(articles[:5], 1):
            title = article.get('title', '').replace('\n', ' ')
            url = article.get('url', '')
            snippet = article.get('snippet', '')[:100] + '...' if article.get('snippet') else ''

            if url:
                output += f"{i}. [{title}]({url})\n   {snippet}\n\n"
            else:
                output += f"{i}. {title}\n   {snippet}\n\n"

        output += "\n"

    return output

if __name__ == '__main__':
    # Placeholder for testing
    today = datetime.now().strftime('%Y-%m-%d')
    fake_news = {
        "马来西亚热门新闻": [
            {"title": "测试新闻1", "url": "https://example.com/1", "snippet": "这是测试新闻摘要"},
            {"title": "测试新闻2", "url": "https://example.com/2", "snippet": "这是测试新闻摘要"}
        ]
    }

    print(format_news_section(fake_news))
