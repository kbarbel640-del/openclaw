---
name: line-profile-resolver
description: Resolve LINE userId to displayName. Use when receiving LINE messages to identify who is speaking. Auto-lookup unknown users via LINE API and cache results.
---

# LINE Profile Resolver

Resolve anonymous LINE userIds to human-readable display names.

## How It Works

LINE webhook events only carry `userId` (e.g. `U2e2f4...`), not display names. This skill:

1. Check cache file `references/line-profile-cache.json` for known mappings
2. If unknown, call LINE Get Group Member Profile API
3. Store result in cache for future use

## Quick Lookup

Read `references/line-profile-cache.json` — a JSON object keyed by groupId → userId → displayName.

## API Call (for unknown users)

```bash
# Group member profile (preferred for group messages)
curl -s -H "Authorization: Bearer $BOT_TOKEN" \
  "https://api.line.me/v2/bot/group/{groupId}/member/{userId}"

# Direct profile (fallback, only works if user has added the bot)
curl -s -H "Authorization: Bearer $BOT_TOKEN" \
  "https://api.line.me/v2/bot/profile/{userId}"
```

Response: `{"userId":"...","displayName":"...","pictureUrl":"..."}`

## Workflow

1. Receive LINE message with userId + groupId
2. Read cache → if found, use displayName
3. If not found, call API → save to cache → use displayName
4. Address user by name in replies

## Cache Update

After resolving a new user, update `references/line-profile-cache.json`:
- Key: groupId → userId → displayName
- Keep it flat and simple

## Bot Token

Use the LINE Bot token from TOOLS.md (LINE Push API Bearer token).
