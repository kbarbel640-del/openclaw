#!/usr/bin/env python3
"""
Daily Briefing Generator for Eden
完整版本：邮件 + 新闻 + X热度 + 天气
"""
import json
import os
import sys
import re
from datetime import datetime, timedelta

# Try to import requests for API calls (for news/weather)
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

WORKSPACE_PATH = os.path.join(os.path.expanduser('~'), '.openclaw', 'workspace')

# Serper API
SERPER_API_KEY = "b8571dbbb94e54cf514bde8535625225b0bd7b6b"
SERPER_URL = "https://google.serper.dev/news"

# Serper备用API (SerpApi)
SERPAPI_BACKUP_KEY = "49647fe1edddef86730e5d75c5208bd436ea7f877ccaa8a4ac1b209ef808cc5b"
SERPAPI_BACKUP_URL = "https://serpapi.com/search"

# X queries
X_QUERIES = ["technology trends", "AI artificial intelligence", "financial markets", "breaking news"]

# Weather API (Open-Meteo, free)
WEATHER_API = "https://api.open-meteo.com/v1/forecast"
# KL coordinates
KL_LAT, KL_LON = 3.1390, 101.6869

# News API (free tier available)
# Using GNews API for now (or we can use web_search inside this workspace)
NEWS_API_KEY = ""  # TODO: Add API key if needed

def decode_header(header):
    """Decode email header safely including MIME encoded words"""
    if header is None:
        return ""

    try:
        import email
        from email.header import make_header, decode_header
        decoded = make_header(decode_header(header))
        return str(decoded)
    except:
        pass

    # Fallback: manual regex decode
    mime_pattern = re.compile(r'=\?([^?]+)\?([BbQq])\?([^?]+)\?=')

    def decode_part(match):
        encoding = match.group(1).lower()
        encoding_type = match.group(2).upper()
        content = match.group(3)

        try:
            if encoding_type == 'B':
                import base64
                content = base64.b64decode(content)
            elif encoding_type == 'Q':
                import quopri
                content = quopri.decodestring(content)
            return content.decode(encoding or 'utf-8', errors='ignore')
        except:
            return match.group(0)

    decoded = mime_pattern.sub(decode_part, header)
    return decoded if decoded else header

def fetch_emails(config):
    """Fetch emails from configured accounts"""
    try:
        import imaplib
    except ImportError:
        print("IMAP library not available")
        return []

    results = []
    for account in config.get('accounts', []):
        account_name = account.get('name', 'unknown')
        try:
            mail = imaplib.IMAP4_SSL(account['host'], account['port'])
            mail.login(account['username'], account['password'])
            mail.select('INBOX')

            since_date = (datetime.now() - timedelta(hours=24)).strftime("%d-%b-%Y")
            typ, data = mail.search(None, f'(SINCE {since_date})')

            if not data or not data[0]:
                mail.close()
                mail.logout()
                continue

            email_ids = data[0].split()
            email_ids = email_ids[-10:] if len(email_ids) > 10 else email_ids

            for eid in email_ids:
                try:
                    typ, msg_data = mail.fetch(eid, '(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])')
                    if not msg_data or not msg_data[0]:
                        continue

                    raw_header = msg_data[0][1]
                    if isinstance(raw_header, bytes):
                        try:
                            raw_header = raw_header.decode('utf-8', errors='ignore')
                        except:
                            continue

                    from_val, subject_val, date_val = '', '', ''

                    for line in raw_header.split('\n'):
                        line = line.strip()
                        if line.startswith('From:'):
                            from_val = line[5:].strip()
                        elif line.startswith('Subject:'):
                            subject_val = line[8:].strip()
                        elif line.startswith('Date:'):
                            date_val = line[5:].strip()

                    from_val = decode_header(from_val)
                    subject_val = decode_header(subject_val)

                    if '<' in from_val and '>' in from_val:
                        from_val = from_val.split('<')[0].strip(' "')

                    email_info = {
                        'from': from_val,
                        'subject': subject_val,
                        'date': date_val,
                        'account': account_name
                    }
                    results.append(email_info)

                except Exception as e:
                    print(f"Error processing email {eid.decode() if isinstance(eid, bytes) else eid}: {e}")
                    continue

            mail.close()
            mail.logout()

        except Exception as e:
            print(f"Error fetching from {account_name}: {e}")

    return results

def fetch_serpapi_news(query, num_results=10):
    """Fetch news from SerpApi (backup)"""
    if not HAS_REQUESTS:
        return []

    params = {
        "engine": "google_news",
        "q": query,
        "api_key": SERPAPI_BACKUP_KEY,
        "num": num_results
    }

    try:
        response = requests.get(SERPAPI_BACKUP_URL, params=params, timeout=15)
        response.raise_for_status()

        data = response.json()
        articles = []

        if "news_results" in data:
            for item in data["news_results"]:
                articles.append({
                    "title": item.get("title", ""),
                    "url": item.get("link", ""),
                    "snippet": item.get("snippet", "")
                })

        return articles

    except Exception as e:
        print(f"Error fetching from SerpApi: {e}")
        return []

def fetch_serper_news(query, num_results=10):
    """Fetch news from Serper API (with SerpApi backup)"""
    # 先尝试主要API
    if HAS_REQUESTS:
        headers = {
            "X-API-KEY": SERPER_API_KEY,
            "Content-Type": "application/json"
        }

        payload = {"q": query, "num": num_results}

        try:
            response = requests.post(SERPER_URL, headers=headers, json=payload, timeout=15)
            response.raise_for_status()

            data = response.json()
            articles = []

            if "news" in data:
                for item in data["news"]:
                    articles.append({
                        "title": item.get("title", ""),
                        "url": item.get("link", ""),
                        "snippet": item.get("snippet", "")
                    })

            return articles

        except Exception as e:
            print(f"  Serper API failed: {e}, trying SerpApi backup...")

    # 使用备用API
    print("  Using SerpApi backup...")
    return fetch_serpapi_news(query, num_results)

def fetch_news_data():
    """Fetch all news categories"""
    queries = {
        "马来西亚热门新闻": "Malaysia news 今日头条 最新",
        "金融经济新闻": "finance news economy stock market financial markets"
    }

    all_news = {}

    for category, query in queries.items():
        print(f"  Fetching {category}...")
        articles = fetch_serper_news(query, num_results=10)
        all_news[category] = articles
        print(f"    Got {len(articles)} articles")

    return all_news

def fetch_weather():
    """Fetch weather data for Kuala Lumpur"""
    if not HAS_REQUESTS:
        return {'error': 'requests library not available'}

    try:
        params = {
            'latitude': KL_LAT,
            'longitude': KL_LON,
            'current_weather': 'true',
            'daily': 'temperature_2m_max,temperature_2m_min,precipitation_sum',
            'timezone': 'Asia/Kuala_Lumpur'
        }
        response = requests.get(WEATHER_API, params=params, timeout=10)
        data = response.json()

        current = data.get('current_weather', {})
        daily = data.get('daily', {})

        return {
            'current_temp': current.get('temperature'),
            'current_code': current.get('weathercode'),
            'high_temp': daily.get('temperature_2m_max', [0])[0] if daily.get('temperature_2m_max') else None,
            'low_temp': daily.get('temperature_2m_min', [0])[0] if daily.get('temperature_2m_min') else None,
            'precipitation': daily.get('precipitation_sum', [0])[0] if daily.get('precipitation_sum') else None
        }
    except Exception as e:
        return {'error': str(e)}

def format_weather(weather_data):
    """Format weather section"""
    if 'error' in weather_data:
        return f"🌤️ **天气 (吉隆坡)**\n无法获取数据: {weather_data['error']}\n\n"

    temp = weather_data.get('current_temp', 'N/A')
    high = weather_data.get('high_temp', 'N/A')
    low = weather_data.get('low_temp', 'N/A')
    precip = weather_data.get('precipitation', 0)

    # Weather code interpretation
    code = weather_data.get('current_code', 0)
    weather_desc = "晴"

    if code >= 1 and code <= 3:
        weather_desc = "多云"
    elif code >= 45 and code <= 48:
        weather_desc = "雾"
    elif code >= 51 and code <= 67:
        weather_desc = "雨"
    elif code >= 80 and code <= 99:
        weather_desc = "阵雨"

    rain_chance = "有雨" if precip > 0 else "无雨"

    return f"""🌤️ **天气 (吉隆坡)**

• 温度: {temp}°C (高: {high}°C / 低: {low}°C)
• 天气: {weather_desc}
• 降雨: {rain_chance}

"""

def fetch_calendar():
    """Fetch calendar events - placeholder"""
    # TODO: Implement Google Calendar integration
    return []

def format_calendar(events):
    """Format calendar section"""
    if not events:
        return "📅 **今日行程**\n暂无行程数据 (Google Calendar待接入)\n\n"

    output = "📅 **今日行程**\n\n"
    for event in events:
        output += f"• {event}\n"

    return output + "\n"

def generate_briefing():
    """Generate complete daily briefing"""
    print(f"[{datetime.now()}] Generating daily briefing...")

    today = datetime.now().strftime('%Y-%m-%d')
    briefing_data = {}

    # 1. Fetch emails
    print("Fetching emails...")
    config_path = os.path.join(WORKSPACE_PATH, 'email_config.json')
    if os.path.exists(config_path):
        with open(config_path, 'r', encoding='utf-8') as f:
            email_config = json.load(f)
        emails = fetch_emails(email_config)
        briefing_data['emails'] = emails
        print(f"  Fetched {len(emails)} emails")
    else:
        emails = []
        print("  No email config found")

    # 2. Fetch news (using Serper API)
    print("Fetching news via Serper...")
    news = fetch_news_data()
    briefing_data['news'] = news
    if news:
        print(f"  Fetched {len(news)} news categories")

    # 3. Fetch weather
    print("Fetching weather...")
    weather = fetch_weather()
    briefing_data['weather'] = weather
    if 'error' not in weather:
        print(f"  Current temp: {weather.get('current_temp')}°C")
    else:
        print(f"  Error: {weather['error']}")

    # 4. Calendar (placeholder)
    print("Calendar: Not yet implemented")

    # Generate formatted sections
    email_section = format_email_section(emails)
    news_section = format_news_section(news)
    weather_section = format_weather(weather)
    calendar_section = format_calendar([])

    # 5. Generate briefing
    briefing_content = f"""# 每日早报 - {datetime.now().strftime('%Y年%m月%d日')}

> 🐥 老大，早上8点到了！

---

{weather_section}

{news_section}

{calendar_section}

{email_section}

---

💡 **数据说明:**
- 邮件: 过去24小时收件箱 (Top 10)
- 新闻: 基于搜索结果
- 天气: 吉隆坡实时数据
- 行程: 待接入

---

由 Eden 自动生成 {datetime.now().strftime('%H:%M')}
"""

    # Save briefing
    briefing_path = os.path.join(WORKSPACE_PATH, f'daily_briefing_{today}.md')
    with open(briefing_path, 'w', encoding='utf-8') as f:
        f.write(briefing_content)

    # Save data
    data_path = os.path.join(WORKSPACE_PATH, f'briefing_data_{today}.json')
    with open(data_path, 'w', encoding='utf-8') as f:
        json.dump(briefing_data, f, ensure_ascii=False, indent=2, default=str)

    print(f"\nBriefing saved to {briefing_path}")
    print(f"Data saved to {data_path}")

    return briefing_path

def format_email_section(emails):
    """Format email section"""
    if not emails:
        return "📧 **昨日重要邮件**\n暂无邮件\n\n"

    # Filter out system alerts and duplicates
    valid_emails = [e for e in emails if e.get('account') and 'error' not in e]

    if not valid_emails:
        return "📧 **昨日重要邮件**\n暂无邮件\n\n"

    # Remove duplicates (by subject)
    seen = set()
    unique_emails = []
    for e in valid_emails:
        subject = e.get('subject', '')
        key = (e.get('from', ''), subject)
        if key not in seen:
            seen.add(key)
            unique_emails.append(e)

    unique_emails.reverse()

    output = "📧 **昨日重要邮件**\n\n"

    for e in unique_emails[:8]:
        from_name = e.get('from', 'Unknown')
        subject = e.get('subject', '(无主题)')
        account = e.get('account', '')

        # Skip Google security alerts (too many)
        if '安全提醒' in subject and 'Google' in from_name:
            continue

        account_tag = f"[{account}]" if len(valid_emails) > 1 else ""
        output += f"• **{from_name}** {account_tag}: {subject}\n"

    return output + "\n"

def format_news_section(news):
    """Format news section"""
    if not news:
        return "📰 **新闻**\n暂无新闻数据 (请先用web_search获取)\n\n"

    output = "📰 **新闻**\n\n"

    for category, articles in news.items():
        if not articles:
            output += f"**{category}**: 暂无\n\n"
            continue

        output += f"**{category}** ({len(articles)}条)\n"

        for i, article in enumerate(articles[:3], 1):  # Top 3 per category
            title = article.get('title', '').replace('\n', ' ')[:60]
            url = article.get('url', '')
            snippet = article.get('snippet', '')[:80] + '...' if article.get('snippet') else ''

            if url:
                output += f"{i}. [{title}]({url})\n   {snippet}\n"
            else:
                output += f"{i}. {title}\n   {snippet}\n"

        output += "\n"

    return output

if __name__ == '__main__':
    generate_briefing()
