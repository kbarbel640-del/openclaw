# Squarespace Integration

Draft-first publishing workflow for DJ's Squarespace site.

## Design Principles

1. **Draft-First**: Creating and editing drafts is allowed freely. Publishing always requires explicit approval.

2. **Notion is Canonical**: All content lives in Notion. Squarespace gets a formatted copy.

3. **Browser-Based**: Uses browser automation (no Squarespace API assumptions).

## Commands

| Command | Description | Approval |
|---------|-------------|----------|
| `/site draft-post <title>` | Create new draft | Never |
| `/site update-draft <id> <source>` | Update draft content | Never |
| `/site publish <id>` | Publish draft | **Always** |

## Workflow

### Typical Episode Publishing

```
1. Write episode in Notion
   ↓
2. /site draft-post "Episode 42: Title" template=episode
   → Creates draft in Squarespace
   → Returns draft ID
   ↓
3. /site update-draft draft-xxx notion://page/yyy
   → Fetches content from Notion
   → Updates Squarespace draft
   ↓
4. Preview in Squarespace editor
   ↓
5. /site publish draft-xxx
   → ⏸️ Approval required
   → /web approve pub-zzz
   → ✅ Published!
```

### Quick Blog Post

```
1. /site draft-post "New Post Title"
2. /site update-draft draft-xxx "# Content\n\nMarkdown here..."
3. /site publish draft-xxx
```

## Login Handling

Squarespace requires authentication. The first command will trigger a login approval:

```
⏸️ Squarespace login required
Action: AUTH
Reason: Squarespace session expired

To approve: /web approve auth-abc123
```

After login:
- Session stored in browser profile
- Subsequent commands don't require login
- Session may expire (re-login needed)

## Templates

### Episode Template

Structured for podcast episodes:

```markdown
# {title}

**Episode {number}** | **Released: {date}**

## Summary
{summary}

## Show Notes
{notes}

## Timestamps
- 00:00 - Intro
- {timestamps}

## Links & Resources
{links}

## Subscribe
{subscribe_links}
```

### Blog Template

Simple blog post format:

```markdown
# {title}

{content}

---

*Published: {date}*
```

## Markdown Conversion

### Supported Elements

| Markdown | Squarespace |
|----------|-------------|
| `# Heading` | H1 |
| `## Heading` | H2 |
| `### Heading` | H3 |
| `- Item` | Bullet list |
| `1. Item` | Numbered list |
| `[text](url)` | Link |
| `**bold**` | Bold |
| `*italic*` | Italic |
| `> quote` | Blockquote |

### Avoided Elements

- Complex HTML (fragile)
- Custom CSS (not portable)
- JavaScript embeds (security)
- iframes (may be blocked)

## Configuration

Add to `~/.openclaw/openclaw.json`:

```json
{
  "dj": {
    "squarespace": {
      "siteUrl": "https://yoursite.squarespace.com",
      "editorUrl": "https://yoursite.squarespace.com/config/pages",
      "defaultTemplate": "blog"
    },
    "notion": {
      "postsDbId": "your-posts-database-id"
    }
  }
}
```

| Key | Description |
|-----|-------------|
| `siteUrl` | Your Squarespace site URL |
| `editorUrl` | Squarespace editor URL |
| `defaultTemplate` | Default template (blog/episode) |
| `postsDbId` | Notion database for posts |

## Notion Schema

### Posts Database

| Property | Type | Description |
|----------|------|-------------|
| Name | Title | Post title |
| Status | Select | Draft, Published, Archived |
| SquarespaceDraftId | Rich Text | Draft ID from Squarespace |
| Template | Select | episode, blog |
| Content | Rich Text | Full content (preferred source for sync) |
| ContentHash | Rich Text | SHA-256 hash for idempotent sync |
| LastSyncedAt | Date | Last sync to Squarespace |
| PublishedAt | Date | Publication date |
| PublishedUrl | URL | Live URL after publish |
| LastError | Rich Text | Most recent error message |

## Idempotent Sync (M4.5)

The site service uses content hashing to avoid unnecessary browser automation:

### How It Works

1. When `/site update-draft` runs, the service computes a SHA-256 hash of the content
2. If the hash matches the `ContentHash` stored in Notion → **sync is skipped**
3. If content changed → browser automation runs and new hash is stored

### Benefits

- **Faster updates**: Unchanged content doesn't trigger slow browser operations
- **Reduced cost**: Fewer browser actions = less budget consumption
- **Audit trail**: `LastSyncedAt` shows when content was actually pushed

### Content Source Preference

When fetching content from Notion:

1. **Preferred**: If the page has a non-empty `Content` rich text property, use it directly
2. **Fallback**: Fetch page blocks and convert to markdown

**Recommendation**: For predictable syncs, populate the `Content` property with your markdown. For flexible editing, use the page body with headings/lists.

### Example Workflow

```
# First update - content synced
/site update-draft draft-123 notion://page/abc
→ ContentHash: "a1b2c3..."
→ Browser: Updated Squarespace draft
→ Notion: LastSyncedAt set

# Second update - no changes
/site update-draft draft-123 notion://page/abc
→ ContentHash matches: "a1b2c3..."
→ ✓ No changes detected, skipping browser update

# Third update - content changed
/site update-draft draft-123 notion://page/abc
→ New ContentHash: "d4e5f6..."
→ Browser: Updated Squarespace draft
→ Notion: ContentHash + LastSyncedAt updated
```

### Publish Updates Notion

After a successful publish:

- `Status` → `Published`
- `PublishedAt` → current timestamp
- `PublishedUrl` → live URL from Squarespace
- `LastError` → cleared

## Error Handling

### Login Expired

```
Error: Squarespace session expired

Fix: Run any /site command and approve login prompt
```

### Draft Not Found

```
Error: Draft draft-abc123 not found

Possible causes:
- Draft was deleted in Squarespace
- Draft ID is incorrect
- Session context lost

Fix: Create a new draft with /site draft-post
```

### Publish Failed

```
Error: Publish button not found

Possible causes:
- Draft has validation errors
- Required fields missing
- Squarespace UI changed

Fix:
1. Open draft in Squarespace editor
2. Check for validation errors
3. Save draft manually
4. Retry /site publish
```

### Content Mismatch

```
Warning: Squarespace content differs from Notion

This happens when:
- Draft was edited in Squarespace directly
- Notion content was updated after last sync

Fix: /site update-draft to resync from Notion
```

## Security Considerations

### Publishing is Always Gated

The `/site publish` command triggers `PUBLISH` action class, which:
- Never auto-submits
- Always requires approval
- Cannot be bypassed by allowlist

### Session Management

- Login sessions stored in browser profile
- Sessions NOT logged (privacy)
- Profile isolated per user

### Canonical Source

If Squarespace content is lost:
- Notion has canonical copy
- Can regenerate with `/site update-draft`
- No data loss risk

## Budget Profiles

| Profile | Allowed Operations |
|---------|-------------------|
| cheap | ❌ No browser access |
| normal | ✅ Draft operations |
| deep | ✅ All operations |

For draft operations, `normal` profile is sufficient.

## Best Practices

1. **Always preview** before publishing
2. **Keep Notion updated** - it's your backup
3. **Use templates** for consistency
4. **Check draft** in Squarespace editor before publish
5. **Verify publish** - check live URL after approval

## Troubleshooting

### Browser Not Responding

```bash
# Restart browser
openclaw browser restart

# Check browser health
openclaw browser status
```

### Lost Draft ID

Check Notion Posts database for `SquarespaceDraftId` property.

Or list recent drafts:
```
/web do "List draft posts in Squarespace"
```

### Template Not Found

Verify template name: `episode` or `blog`.

Custom templates not yet supported.
