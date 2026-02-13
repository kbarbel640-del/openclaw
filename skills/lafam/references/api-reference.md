# LaFam API Reference — Full Action Catalogue

All actions go through `scripts/lafam.sh`. Auth is handled automatically (token cached, re-login on 401).  
Base URL: `https://events-api-tq4b.onrender.com`

---

## AUTH

| Action    | Description                              |
| --------- | ---------------------------------------- |
| `login`   | Force a fresh login (normally automatic) |
| `refresh` | Force a token refresh                    |

---

## HEALTH

| Action   | Example                            |
| -------- | ---------------------------------- |
| `health` | `lafam.sh health` — no auth needed |

---

## EVENTS

| Action               | Usage                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `events:list`        | `lafam.sh events:list [--query Q] [--tags t1,t2] [--page N] [--limit N] [--startDate ISO]`           |
| `events:get`         | `lafam.sh events:get <eventId>`                                                                      |
| `events:get-by-slug` | `lafam.sh events:get-by-slug <slug>`                                                                 |
| `events:create`      | `lafam.sh events:create '<JSON>'`                                                                    |
| `events:update`      | `lafam.sh events:update <eventId> '<JSON>'`                                                          |
| `events:delete`      | `lafam.sh events:delete <eventId>`                                                                   |
| `events:stats`       | `lafam.sh events:stats <eventId> [--timeframe <value>]`                                              |
| `events:tickets`     | `lafam.sh events:tickets <eventId> [--page N] [--limit N] [--query Q] [--ticketType T] [--status S]` |

### Create event — required fields

```json
{
  "title": "My Event",
  "description": "Description text",
  "startDate": "2026-03-01T18:00:00.000Z",
  "endDate": "2026-03-02T04:00:00.000Z",
  "location": "Venue name or address",
  "ownerId": "<userId>",
  "ticketTypes": [{ "name": "General", "price": 100, "quantity": 200, "kind": "GENERAL" }]
}
```

Optional: `communityIds`, `imageUrl`, `coverImageUrl`, `logoUrl`, `tags`, `slug`, `isPublic`, `hasBar`.

---

## TICKET TYPES (per event)

| Action           | Usage                                                       |
| ---------------- | ----------------------------------------------------------- |
| `tickets:list`   | `lafam.sh tickets:list <eventId>`                           |
| `tickets:create` | `lafam.sh tickets:create <eventId> '<JSON>'`                |
| `tickets:update` | `lafam.sh tickets:update <eventId> <ticketTypeId> '<JSON>'` |
| `tickets:delete` | `lafam.sh tickets:delete <eventId> <ticketTypeId>`          |

### Create ticket type — fields

Required: `name`, `description`, `price`, `quantity`, `kind`.  
Optional: `isHidden`, `couponCode`, `iconName`, `startDate`, `endDate`.

```json
{ "name": "VIP", "description": "VIP access", "price": 250, "quantity": 50, "kind": "VIP" }
```

---

## ARTISTS

| Action                     | Usage                                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `artists:list`             | `lafam.sh artists:list [--page N] [--limit N]`                                                                              |
| `artists:search`           | `lafam.sh artists:search "query"`                                                                                           |
| `artists:get`              | `lafam.sh artists:get <artistId>`                                                                                           |
| `artists:get-by-slug`      | `lafam.sh artists:get-by-slug <slug>`                                                                                       |
| `artists:create`           | `lafam.sh artists:create '<JSON>'`                                                                                          |
| `artists:update`           | `lafam.sh artists:update <artistId> '<JSON>'`                                                                               |
| `artists:delete`           | `lafam.sh artists:delete <artistId>`                                                                                        |
| `artists:add-social`       | `lafam.sh artists:add-social <artistId> '{"platform":"YOUTUBE","url":"https://..."}'`                                       |
| `artists:add-socials-bulk` | `lafam.sh artists:add-socials-bulk <artistId> '[{"platform":"YOUTUBE","url":"..."},{"platform":"SOUNDCLOUD","url":"..."}]'` |
| `artists:playable-media`   | `lafam.sh artists:playable-media` — returns artists with YOUTUBE/SOUNDCLOUD links                                           |
| `artists:usage`            | `lafam.sh artists:usage <artistId>` — which communities use this artist                                                     |
| `artists:bookings`         | `lafam.sh artists:bookings <artistId>`                                                                                      |

### Create artist — fields

Required: `name`.  
Optional: `description`, `tags`, `imageUrl`, `coverImageUrl`, `artistImageUrl`, `country`, `hourlyRate`, `slug`, `communityIds`.

---

## LOCATIONS

| Action                       | Usage                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| `locations:list`             | `lafam.sh locations:list [--page N] [--limit N]`                                    |
| `locations:search`           | `lafam.sh locations:search "query"`                                                 |
| `locations:get`              | `lafam.sh locations:get <locationId>`                                               |
| `locations:get-by-slug`      | `lafam.sh locations:get-by-slug <slug>`                                             |
| `locations:create`           | `lafam.sh locations:create '<JSON>'`                                                |
| `locations:update`           | `lafam.sh locations:update <locationId> '<JSON>'`                                   |
| `locations:delete`           | `lafam.sh locations:delete <locationId>`                                            |
| `locations:add-social`       | `lafam.sh locations:add-social <locationId> '{"platform":"INSTAGRAM","url":"..."}'` |
| `locations:add-socials-bulk` | `lafam.sh locations:add-socials-bulk <locationId> '[...]'`                          |
| `locations:usage`            | `lafam.sh locations:usage <locationId>`                                             |

### Create location — fields

Required: `name`, `address`, `tags` (array).  
Optional: `description`, `capacity`, `amenities`, `imageUrl`, `hourlyRate`, `dailyRate`, `communityIds`.

---

## SERVICES

| Action                      | Usage                                                                           |
| --------------------------- | ------------------------------------------------------------------------------- |
| `services:list`             | `lafam.sh services:list [--page N] [--limit N]`                                 |
| `services:search`           | `lafam.sh services:search "query"`                                              |
| `services:get`              | `lafam.sh services:get <serviceId>`                                             |
| `services:get-by-slug`      | `lafam.sh services:get-by-slug <slug>`                                          |
| `services:create`           | `lafam.sh services:create '<JSON>'`                                             |
| `services:update`           | `lafam.sh services:update <serviceId> '<JSON>'`                                 |
| `services:delete`           | `lafam.sh services:delete <serviceId>`                                          |
| `services:add-social`       | `lafam.sh services:add-social <serviceId> '{"platform":"WEBSITE","url":"..."}'` |
| `services:add-socials-bulk` | `lafam.sh services:add-socials-bulk <serviceId> '[...]'`                        |

### Create service — fields

Required: `name`.  
Optional: `description`, `tags`, `imageUrl`, `coverImageUrl`, `baseRate`, `unit`, `communityIds`.

---

## COMMUNITIES

| Action                          | Usage                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `communities:list`              | `lafam.sh communities:list [--limit N] [--offset N]`                                  |
| `communities:get`               | `lafam.sh communities:get <communityId>`                                              |
| `communities:get-by-slug`       | `lafam.sh communities:get-by-slug <slug>`                                             |
| `communities:create`            | `lafam.sh communities:create '<JSON>'`                                                |
| `communities:update`            | `lafam.sh communities:update <communityId> '<JSON>'`                                  |
| `communities:delete`            | `lafam.sh communities:delete <communityId>`                                           |
| `communities:events`            | `lafam.sh communities:events <communityId>`                                           |
| `communities:members`           | `lafam.sh communities:members <communityId>`                                          |
| `communities:join`              | `lafam.sh communities:join <communityId> ['{"message":"Hi!"}']`                       |
| `communities:join-requests`     | `lafam.sh communities:join-requests <communityId>` — pending requests                 |
| `communities:join-approve`      | `lafam.sh communities:join-approve <requestId> APPROVED` (or REJECTED)                |
| `communities:related-artists`   | `lafam.sh communities:related-artists <communityId>`                                  |
| `communities:related-locations` | `lafam.sh communities:related-locations <communityId>`                                |
| `communities:related-services`  | `lafam.sh communities:related-services <communityId>`                                 |
| `communities:playable-media`    | `lafam.sh communities:playable-media <communityId>` — YOUTUBE + SOUNDCLOUD            |
| `communities:feed`              | `lafam.sh communities:feed`                                                           |
| `communities:agents`            | `lafam.sh communities:agents <communityId>`                                           |
| `communities:add-agent`         | `lafam.sh communities:add-agent <communityId> '{"email":"x@y.com","role":"MANAGER"}'` |

### Create community — fields

Required: `name`, `description`.  
Optional: `imageUrl`, `coverImageUrl`, `tags`, `slug`.

---

## POSTS & COMMENTS

| Action                 | Usage                                                     |
| ---------------------- | --------------------------------------------------------- |
| `posts:list`           | `lafam.sh posts:list [--limit N] [--offset N]`            |
| `posts:get`            | `lafam.sh posts:get <postId>`                             |
| `posts:create`         | `lafam.sh posts:create '<JSON>'`                          |
| `posts:update`         | `lafam.sh posts:update <postId> '<JSON>'`                 |
| `posts:delete`         | `lafam.sh posts:delete <postId>`                          |
| `posts:search`         | `lafam.sh posts:search "query"`                           |
| `posts:for-entity`     | `lafam.sh posts:for-entity artist <artistId>`             |
| `posts:comments`       | `lafam.sh posts:comments <postId> [--page N] [--limit N]` |
| `posts:comment`        | `lafam.sh posts:comment <postId> '{"content":"Nice!"}'`   |
| `posts:comment-delete` | `lafam.sh posts:comment-delete <commentId>`               |

### Create post — fields

All optional: `title`, `content`, `imageUrls`, `tags`, `communityId`, `artistId`, `serviceId`, `locationId`, `isPublic`, `isPinned`, `isBookable`, `hourlyRate`, `dailyRate`, `socialLinks`.

Entity types for `posts:for-entity`: `artist`, `location`, `service`, `community`.

---

## INTERACTIONS (likes, follows, saves)

| Action                          | Usage                                                                   |
| ------------------------------- | ----------------------------------------------------------------------- |
| `interactions:like-post`        | `lafam.sh interactions:like-post <postId>`                              |
| `interactions:save-post`        | `lafam.sh interactions:save-post <postId>`                              |
| `interactions:post-info`        | `lafam.sh interactions:post-info <postId>`                              |
| `interactions:like-artist`      | `lafam.sh interactions:like-artist <artistId>`                          |
| `interactions:follow-artist`    | `lafam.sh interactions:follow-artist <artistId>`                        |
| `interactions:artist-followers` | `lafam.sh interactions:artist-followers <artistId>`                     |
| `interactions:mine`             | `lafam.sh interactions:mine like` (or `save`, `follow`)                 |
| `interactions:check`            | `lafam.sh interactions:check '{"postIds":["..."],"artistIds":["..."]}'` |

---

## SOCIAL LINKS (generic)

Supported platforms: `YOUTUBE`, `SOUNDCLOUD`, `INSTAGRAM`, `TWITTER`, `FACEBOOK`, `TIKTOK`, `SPOTIFY`, `WEBSITE`

| Action                     | Usage                                                                           |
| -------------------------- | ------------------------------------------------------------------------------- |
| `social-links:by-platform` | `lafam.sh social-links:by-platform YOUTUBE,SOUNDCLOUD [--limit N] [--offset N]` |
| `social-links:update`      | `lafam.sh social-links:update <linkId> '{"url":"https://new-url"}'`             |
| `social-links:delete`      | `lafam.sh social-links:delete <linkId>`                                         |

> **Playable media tip:** Use `social-links:by-platform YOUTUBE,SOUNDCLOUD` or `artists:playable-media` or `communities:playable-media` to surface embeddable audio/video links.

---

## CART

| Action             | Usage                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `cart:get`         | `lafam.sh cart:get <sessionId>` — creates cart if none exists for session                                               |
| `cart:add`         | `lafam.sh cart:add <cartId> '{"ticketTypeId":"...","quantity":1,"entityId":"...","entityType":"event"}'`                |
| `cart:update-item` | `lafam.sh cart:update-item <cartId> <itemId> '{"quantity":3}'`                                                          |
| `cart:remove-item` | `lafam.sh cart:remove-item <cartId> <itemId>`                                                                           |
| `cart:clear`       | `lafam.sh cart:clear <cartId>`                                                                                          |
| `cart:summary`     | `lafam.sh cart:summary <cartId>`                                                                                        |
| `cart:checkout`    | `lafam.sh cart:checkout <cartId> '{"paymentMethod":"CARD","holderName":"...","holderEmail":"...","holderPhone":"..."}'` |

---

## BOOKINGS

| Action                   | Usage                                                                  |
| ------------------------ | ---------------------------------------------------------------------- |
| `bookings:create`        | `lafam.sh bookings:create '<JSON>'`                                    |
| `bookings:list`          | `lafam.sh bookings:list`                                               |
| `bookings:get`           | `lafam.sh bookings:get <bookingId>`                                    |
| `bookings:mine`          | `lafam.sh bookings:mine [--startDate ISO] [--endDate ISO]`             |
| `bookings:update-status` | `lafam.sh bookings:update-status <bookingId> '{"status":"CONFIRMED"}'` |
| `bookings:delete`        | `lafam.sh bookings:delete <bookingId>`                                 |

### Create booking — fields

Required: `startTime`, `endTime`, `totalAmount`.  
Optional: `artistId`, `locationId`, `serviceId`, `eventId`, `paymentMethod`, `notes`.

---

## TAGS & SEARCH

| Action                 | Usage                                                           |
| ---------------------- | --------------------------------------------------------------- |
| `search`               | `lafam.sh search "keyword"` — global search across all entities |
| `tags:entities`        | `lafam.sh tags:entities <tagName>` — all entities with this tag |
| `tags:popular`         | `lafam.sh tags:popular [--limit N]`                             |
| `tags:popular-artists` | `lafam.sh tags:popular-artists`                                 |
| `tags:popular-events`  | `lafam.sh tags:popular-events`                                  |

---

## PROFILE (bot user)

| Action                  | Usage                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| `profile:get`           | `lafam.sh profile:get`                                             |
| `profile:update`        | `lafam.sh profile:update '<JSON>'`                                 |
| `profile:tickets`       | `lafam.sh profile:tickets`                                         |
| `profile:transactions`  | `lafam.sh profile:transactions`                                    |
| `profile:managed-items` | `lafam.sh profile:managed-items`                                   |
| `profile:add-social`    | `lafam.sh profile:add-social '{"platform":"YOUTUBE","url":"..."}'` |

---

## UPLOADS

| Action          | Usage                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| `upload:image`  | `lafam.sh upload:image /path/to/file.jpg` — multipart upload, returns URL |
| `upload:config` | `lafam.sh upload:config` — see allowed types/sizes                        |

---

## AGENT API — TRANSACTIONS & OPERATIONS

| Action              | Usage                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| `agent:purchase`    | `lafam.sh agent:purchase '<JSON>'` — Create purchase transaction      |
| `agent:transaction` | `lafam.sh agent:transaction <transactionId>` — Get transaction status |

### Purchase Request — required fields

```json
{
  "productId": "<ticketTypeId>",
  "quantity": 1,
  "user": {
    "name": "Full Name",
    "email": "user@example.com",
    "phone": "0501234567",
    "gender": "זכר",
    "birthday": "1990-01-01"
  },
  "agentCode": "flopi_bot"
}
```

Response includes `paymentUrl` (Cardcom) and `transactionId`.

---

## AGENT API — PRODUCTS

| Action                       | Usage                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `agent:products:search`      | `lafam.sh agent:products:search [--q "query"] [--kind "GENERAL\|VIP\|..."] [--minPrice N] [--maxPrice N] [--eventId ID] [--limit N]` |
| `agent:products:merchandise` | `lafam.sh agent:products:merchandise` — Get all merchandise (physical products)                                                      |
| `agent:products:events`      | `lafam.sh agent:products:events` — Get all event ticket products                                                                     |
| `agent:products:upcoming`    | `lafam.sh agent:products:upcoming` — Get upcoming event products                                                                     |
| `agent:products:get`         | `lafam.sh agent:products:get <productId>` — Get product details                                                                      |

### Product response fields

Each product includes: `id`, `name`, `description`, `price`, `quantity`, `quantityLeft`, `kind`, `eventId`, `eventTitle`, `eventSlug`, `eventStartDate`, `eventEndDate`, `isHidden`, `startDate`, `endDate`.

---

## AGENT API — USERS

| Action               | Usage                                                                                                                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent:user:lookup`  | `lafam.sh agent:user:lookup --email "user@example.com"` <br> `lafam.sh agent:user:lookup --phone "0501234567"` <br> `lafam.sh agent:user:lookup --id "<userId>"` <br> `lafam.sh agent:user:lookup --q "search term"` |
| `agent:user:history` | `lafam.sh agent:user:history <userId>` — Get user's purchase history                                                                                                                                                 |

Lookup returns user info: `id`, `name`, `email`, `phone`, `createdAt`.  
Search (`--q`) returns an array of matching users.

---

## AGENT API — NOTIFICATIONS

| Action               | Usage                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `agent:notify:sms`   | `lafam.sh agent:notify:sms '{"to":"052-1234567","message":"היי!","link":"https://lafam.world"}'`     |
| `agent:notify:email` | `lafam.sh agent:notify:email '{"to":"user@example.com","subject":"נושא","html":"<p>תוכן HTML</p>"}'` |

### SMS fields

- `to` (required): Phone number (Israeli format, normalized automatically: `972...` → `0...`)
- `message` (required): Message text
- `link` (optional): URL to append
- `campaignName` (optional): Campaign identifier (default: `agent-notification`)

### Email fields

- `to` (required): Email address
- `subject` (required): Email subject
- `html` (required): HTML content
- `text` (optional): Plain text fallback (auto-generated from HTML if omitted)

Response: `{ "success": true }` or `{ "success": false, "error": "..." }`

---

## AGENT API — STATS

| Action                     | Usage                                                                      |
| -------------------------- | -------------------------------------------------------------------------- |
| `agent:stats`              | `lafam.sh agent:stats <agentCode>` — Get agent statistics summary          |
| `agent:stats:sales`        | `lafam.sh agent:stats:sales <agentCode>` — Get recent sales (last 30 days) |
| `agent:stats:top-products` | `lafam.sh agent:stats:top-products <agentCode>` — Get top-selling products |

Stats include: total sales count, revenue, commission, conversion rate, popular products.

---

## AGENT API — BOOKINGS

| Action                        | Usage                                                                       |
| ----------------------------- | --------------------------------------------------------------------------- |
| `agent:booking:create`        | `lafam.sh agent:booking:create '<JSON>'`                                    |
| `agent:booking:get`           | `lafam.sh agent:booking:get <bookingId>`                                    |
| `agent:booking:update-status` | `lafam.sh agent:booking:update-status <bookingId> '{"status":"CONFIRMED"}'` |
| `agent:booking:cancel`        | `lafam.sh agent:booking:cancel <bookingId>`                                 |
| `agent:booking:list-user`     | `lafam.sh agent:booking:list-user <userId>`                                 |
| `agent:booking:list-event`    | `lafam.sh agent:booking:list-event <eventId>`                               |

### Create booking — fields

Required: `userId`, `eventId`, `startDate`, `endDate`.  
Optional: `artistId`, `locationId`, `serviceId`, `notes`, `totalAmount`.

Booking statuses: `PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`.
