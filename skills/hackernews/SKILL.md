---
name: hackernews
description: "Fetch top stories from Hacker News. Use when: user asks for tech news, HN top stories, or latest startup/programming news."
homepage: https://news.ycombinator.com/
metadata: { "openclaw": { "emoji": "🗞️", "requires": { "bins": ["curl"] } } }
---

# Hacker News Skill

Get the top stories currently trending on Hacker News.

## When to Use

✅ **USE this skill when:**

- "What's on Hacker News?"
- "Show me the top 5 tech news stories"
- "Any interesting startup or programming news today?"
- "Read HN for me"

## When NOT to Use

❌ **DON'T use this skill when:**

- The user asks for mainstream non-tech news (e.g., politics, sports)
- The user is looking for a specific historical article by keyword

## Commands

### Current Top Stories

```bash
# Get the top 10 stories (default)
bash skills/hackernews/src/hn.sh

# Get the top 5 stories
bash skills/hackernews/src/hn.sh 5

# Get the top 20 stories
bash skills/hackernews/src/hn.sh 20
```

### "What's the top news on HN today?"

```bash
bash skills/hackernews/src/hn.sh 10
```

## Notes

- Uses the official HackerNews Firebase API.
- Automatically displays Title, Score, Author, Article Link, and HN Discussion Link.
