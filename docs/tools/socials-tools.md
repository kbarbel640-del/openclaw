---
summary: "Social media scraping via Apify (Instagram, TikTok, YouTube)"
read_when:
  - You want to scrape social media platforms
  - You need an Apify API key for social scraping
  - You want Instagram, TikTok, or YouTube data extraction
title: "Social Tools"
---

# Social tools

OpenClaw ships a `social_platforms` tool backed by **Apify** Actors for structured
social media data extraction. It supports **Instagram**, **TikTok**, and **YouTube**.

## How it works

- `social_platforms` calls platform-specific Apify Actors and returns structured data as markdown.
- Results are cached by query for 15 minutes (configurable).
- Requires `APIFY_API_KEY` or `tools.social.apiKey` in config.
- Prefer `social_platforms` over `web_fetch` for social media URLs.

## Get an API key

1. Create an Apify account at [https://console.apify.com/](https://console.apify.com/)
2. Generate an API token in Account Settings.
3. Store it in config or set `APIFY_API_KEY` in the gateway environment.

## Configure

```json5
{
  tools: {
    social: {
      enabled: true,
      apiKey: "APIFY_API_KEY_HERE", // optional if APIFY_API_KEY is set
      baseUrl: "https://api.apify.com",
      timeoutSeconds: 60,
      cacheTtlMinutes: 15,
      maxResults: 20,
      allowedPlatforms: ["instagram", "tiktok", "youtube"],
    },
  },
}
```

Notes:

- `tools.social.enabled` defaults to true when an API key is present.
- `allowedPlatforms` controls which platforms are available (default: all three).
- `maxResults` sets the default result limit (default: 20, max: 100).

## social_platforms

### Requirements

- `tools.social.enabled` must not be `false` (default: enabled when apiKey is set)
- Apify API key: `tools.social.apiKey` or `APIFY_API_KEY`

### Tool parameters

- `platform` (required): `"instagram"`, `"tiktok"`, or `"youtube"`
- `urls` (optional): URLs to scrape (Instagram URLs, TikTok video URLs, YouTube URLs)
- `queries` (optional): Search terms
- `hashtags` (optional): Hashtags to scrape (TikTok)
- `profiles` (optional): Profile usernames (TikTok)
- `maxResults` (optional): Maximum results to return (1–100, default: 20)

#### Instagram parameters

- `instagramMode` (required for Instagram): `"url"` or `"search"`
- `instagramType` (required for Instagram):
  - URL mode: `"posts"`, `"comments"`, `"mentions"`, `"urls"`
  - Search mode: `"hashtags"`, `"places"`, `"users"`

#### TikTok parameters

- `tiktokType` (required for TikTok): `"search"`, `"hashtags"`, `"videos"`, or `"profiles"`
  - `"search"` requires `queries`
  - `"hashtags"` requires `hashtags`
  - `"videos"` requires `urls`
  - `"profiles"` requires `profiles`

#### YouTube parameters

- Provide `urls` (video/channel/playlist URLs) or `queries` (search terms)

### Platform capabilities

| Platform      | Actions                                                                     |
| ------------- | --------------------------------------------------------------------------- |
| **Instagram** | Scrape URLs (posts, comments, mentions) or search (hashtags, places, users) |
| **TikTok**    | Search queries, hashtags, video URLs, or profiles                           |
| **YouTube**   | Search terms or direct video/channel URLs                                   |

### Examples

```javascript
// Instagram: get posts from a profile URL
await social_platforms({
  platform: "instagram",
  instagramMode: "url",
  instagramType: "posts",
  urls: ["https://www.instagram.com/natgeo/"],
  maxResults: 10,
});

// Instagram: search for hashtags
await social_platforms({
  platform: "instagram",
  instagramMode: "search",
  instagramType: "hashtags",
  queries: ["travel"],
});

// TikTok: search videos
await social_platforms({
  platform: "tiktok",
  tiktokType: "search",
  queries: ["web scraping tutorial"],
  maxResults: 10,
});

// TikTok: get profile videos
await social_platforms({
  platform: "tiktok",
  tiktokType: "profiles",
  profiles: ["apaborern"],
});

// YouTube: search
await social_platforms({
  platform: "youtube",
  queries: ["web scraping 2025"],
  maxResults: 5,
});

// YouTube: get video details
await social_platforms({
  platform: "youtube",
  urls: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
});
```

- Responses are cached (default 15 minutes) to reduce repeated API calls.
- If you use tool profiles/allowlists, add `social_platforms` or `group:plugins`.
- See [Web tools](/tools/web) for web-specific scraping with `web_fetch`.
