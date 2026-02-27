---
name: nostr-publishing
description: Publish Nostr notes reliably from the CLI using nak (correct relay args, stdin handling, stable event generation, retries). Use when agents need to post or reply on Nostr without getting tripped up by nak flags.
---

# Nostr Publishing (nak)

## Rule: Never Call `nak event` Directly

Always use the script:

- `~/OneDrive/satsmax/scripts/nostr-post.sh` (preferred inside satsmax repo)
- or `~/OneDrive/skills/nostr-publishing/scripts/nostr-post.sh` (works anywhere)

This avoids recurring footguns:

- `nak event` relay URLs are **positional args** (there is **no** `--relay` flag)
- stdin is for event JSON; piping content/secrets causes weird behavior
- redirects/capture can cause nak to block waiting on stdin; we always use `< /dev/null`

## Examples

Post a note (default relay is primal):

```bash
~/OneDrive/satsmax/scripts/nostr-post.sh --content "Hello from SATMAX"
```

Post to multiple relays:

```bash
~/OneDrive/satsmax/scripts/nostr-post.sh --content "..." --relay wss://relay.primal.net --relay wss://relay.damus.io
```

Post from a file:

```bash
~/OneDrive/satsmax/scripts/nostr-post.sh --content-file ./post.md
```

Tags:

```bash
~/OneDrive/satsmax/scripts/nostr-post.sh --content "..." --tag t=bitcoin --tag t=nostr
```

Dry run (build + print the event id, do not publish):

```bash
~/OneDrive/satsmax/scripts/nostr-post.sh --dry-run --content "..."
```
