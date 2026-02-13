---
name: lafam
description: Interact with the LaFam / Mishpuha event-and-community platform API. Use when you need to list, create, update, or delete events, artists, locations, services, communities, posts, bookings, or tickets on LaFam. Also use for searching, tagging, social links, playable media (YouTube/SoundCloud), cart/checkout flows, interactions (like/follow/save), uploads, profile management, and AGENT OPERATIONS (purchase tickets, send SMS/email, lookup users, view stats, manage bookings). Covers every LaFam API endpoint including the full Agent Transaction API.
---

# LaFam — Mishpuha Platform Skill

## How to run

All commands go through the dispatcher script:

```bash
bash /Users/daniel/Projects/MishpuhaWorld/openclaw/skills/lafam/scripts/lafam.sh <action> [args...]
```

Auth is **fully automatic** — the script logs in on first use, caches the token, and re-logins transparently on 401. No manual token management needed.

Credentials (baked in): `flopi_bot@lafam.world` / `bot@442`  
Base URL: `https://events-api-tq4b.onrender.com`

---

## Quick examples

```bash
# List communities
bash lafam.sh communities:list --limit 5

# Search for artists
bash lafam.sh artists:search "psytrance"

# Get an event by ID
bash lafam.sh events:get cmbrwipf90009pq382hjr4f7f

# Create an event (pass JSON as single quoted arg)
bash lafam.sh events:create '{"title":"Beach Party","description":"Summer vibes","startDate":"2026-07-01T20:00:00.000Z","endDate":"2026-07-02T04:00:00.000Z","location":"Beach Tel Aviv","ownerId":"<userId>","ticketTypes":[{"name":"General","price":80,"quantity":300,"kind":"GENERAL","description":"Standard entry"}]}'

# Upload an image, then use the returned URL in create calls
bash lafam.sh upload:image /path/to/poster.jpg

# Get playable media (YouTube + SoundCloud links)
bash lafam.sh artists:playable-media
bash lafam.sh communities:playable-media <communityId>
bash lafam.sh social-links:by-platform YOUTUBE,SOUNDCLOUD

# Global search
bash lafam.sh search "goa trance"

# Like an artist + follow
bash lafam.sh interactions:like-artist <artistId>
bash lafam.sh interactions:follow-artist <artistId>

# AGENT API — Send SMS
bash lafam.sh agent:notify:sms '{"to":"052-3581008","message":"דונט וורי בי דרורי"}'

# AGENT API — Search products
bash lafam.sh agent:products:search --q "psytrance" --limit 10

# AGENT API — Purchase ticket
bash lafam.sh agent:purchase '{"productId":"<ticketTypeId>","quantity":1,"user":{"name":"John","email":"john@example.com","phone":"0501234567","gender":"זכר","birthday":"1990-01-01"},"agentCode":"flopi_bot"}'

# AGENT API — Get stats
bash lafam.sh agent:stats flopi_bot
```

---

## Action groups at a glance

| Group                     | Key actions                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Events**                | `events:list`, `events:get`, `events:create`, `events:update`, `events:delete`, `events:stats`, `events:tickets`                                                               |
| **Ticket types**          | `tickets:list`, `tickets:create`, `tickets:update`, `tickets:delete`                                                                                                           |
| **Artists**               | `artists:list`, `artists:search`, `artists:get`, `artists:create`, `artists:update`, `artists:delete`, `artists:playable-media`, `artists:bookings`                            |
| **Locations**             | `locations:list`, `locations:search`, `locations:get`, `locations:create`, `locations:update`, `locations:delete`                                                              |
| **Services**              | `services:list`, `services:search`, `services:get`, `services:create`, `services:update`, `services:delete`                                                                    |
| **Communities**           | `communities:list`, `communities:get`, `communities:events`, `communities:members`, `communities:feed`, `communities:playable-media`, `communities:join`, `communities:agents` |
| **Posts & Comments**      | `posts:list`, `posts:get`, `posts:create`, `posts:search`, `posts:comment`, `posts:for-entity`                                                                                 |
| **Interactions**          | `interactions:like-post`, `interactions:follow-artist`, `interactions:mine`, `interactions:check`                                                                              |
| **Social Links**          | `social-links:by-platform`, `social-links:update`, `social-links:delete`                                                                                                       |
| **Cart & Checkout**       | `cart:get`, `cart:add`, `cart:summary`, `cart:checkout`                                                                                                                        |
| **Bookings**              | `bookings:create`, `bookings:list`, `bookings:mine`, `bookings:update-status`                                                                                                  |
| **Tags & Search**         | `search`, `tags:entities`, `tags:popular`, `tags:popular-artists`, `tags:popular-events`                                                                                       |
| **Profile**               | `profile:get`, `profile:update`, `profile:tickets`, `profile:transactions`, `profile:managed-items`                                                                            |
| **Uploads**               | `upload:image`, `upload:config`                                                                                                                                                |
| **Agent - Transactions**  | `agent:purchase`, `agent:transaction`                                                                                                                                          |
| **Agent - Products**      | `agent:products:search`, `agent:products:merchandise`, `agent:products:events`, `agent:products:upcoming`, `agent:products:get`                                                |
| **Agent - Users**         | `agent:user:lookup`, `agent:user:history`                                                                                                                                      |
| **Agent - Notifications** | `agent:notify:sms`, `agent:notify:email`                                                                                                                                       |
| **Agent - Stats**         | `agent:stats`, `agent:stats:sales`, `agent:stats:top-products`                                                                                                                 |
| **Agent - Bookings**      | `agent:booking:create`, `agent:booking:get`, `agent:booking:update-status`, `agent:booking:cancel`, `agent:booking:list-user`, `agent:booking:list-event`                      |

---

## Full action reference

See **`references/api-reference.md`** for the complete catalogue — every action, every argument, every field, with examples. Load it when you need the exact syntax for a specific action.

---

## Key notes

1. **JSON args must be single-quoted** on the shell command line to avoid expansion: `'{"key":"value"}'`
2. **Social link platforms:** `YOUTUBE`, `SOUNDCLOUD`, `INSTAGRAM`, `TWITTER`, `FACEBOOK`, `TIKTOK`, `SPOTIFY`, `WEBSITE`
3. **Playable media = YouTube + SoundCloud.** Three ways to surface them: `artists:playable-media`, `communities:playable-media <id>`, or `social-links:by-platform YOUTUBE,SOUNDCLOUD`
4. **Pagination:** Most list endpoints support `--page`/`--limit` or `--limit`/`--offset` flags (varies by domain — see reference)
5. **Entity types** for `posts:for-entity`: `artist`, `location`, `service`, `community`
6. **Cart session:** `cart:get` requires a session ID string (any unique identifier); pass it as the first arg
7. **Upload → use:** Upload images with `upload:image <path>`, get back a URL, then pass that URL into `imageUrl` / `coverImageUrl` / `logoUrl` fields on create/update calls
8. **`lafam.sh help`** prints the full action list with signatures — useful as a quick cheat sheet
