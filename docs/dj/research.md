# Research Skill

The `/research` skill provides budget-aware web research with caching and optional Notion persistence.

## Overview

Research uses `web_search` and `web_fetch` (NOT browser) to:
1. Find relevant sources
2. Fetch content
3. Synthesize findings
4. Optionally save to Notion

## Usage

```bash
# Quick research
/research "query"

# Research and save to Notion
/research save "query"
```

## Budget Profiles

Research depth scales with budget profile:

| Profile | Searches | Fetches | Chars/Fetch | Use Case |
|---------|----------|---------|-------------|----------|
| cheap | 1 | 2 | 10,000 | Quick lookup |
| normal | 2 | 5 | 50,000 | Standard research |
| deep | 5 | 10 | 100,000 | Comprehensive |

### Profile Selection

```bash
# Check current profile
/budget

# Switch profiles
/budget normal
/budget deep
```

**Note**: Deep mode must be explicitly armed and self-expires.

## Output Format

Research returns structured findings:

```markdown
## Research: {query}

### Key Findings
- Finding 1 with key insight
- Finding 2 with supporting data
- Finding 3 with relevant context
- [5-10 bullet points]

### Sources
1. [Source Title](URL) - Brief description
2. [Source Title](URL) - Brief description
...

### Next Actions
- [ ] Suggested follow-up 1
- [ ] Suggested follow-up 2

### Uncertainty / Assumptions
- Area where info was incomplete
- Assumption made due to lack of data
```

## Caching

To avoid repeated API spend:

### Cache Key Generation

```
cache_key = sha256(query + sorted(urls))
```

### Cache Location

```
~/.openclaw/cache/research/<cache_key>.json
```

### Cache Structure

```json
{
  "query": "original query",
  "urls": ["https://..."],
  "content": ["fetched content..."],
  "synthesized": "formatted output",
  "cachedAt": "2026-02-03T10:00:00Z",
  "expiresAt": "2026-02-04T10:00:00Z"
}
```

### Cache Behavior

| Scenario | Behavior |
|----------|----------|
| Cache hit, not expired | Return cached |
| Cache hit, expired | Fresh research |
| Cache miss | Fresh research |
| Same query, diff profile | Fresh (higher profile may find more) |

### Cache TTL

Default: 24 hours. Configure with `DJ_RESEARCH_CACHE_TTL_HOURS`.

## Notion Integration

### Research Radar Database

Save research to Notion for future reference:

| Property | Type | Description |
|----------|------|-------------|
| Query | Title | Original search query |
| Summary | Rich Text | Synthesized findings |
| Sources | URL | Comma-separated URLs |
| Profile | Select | cheap/normal/deep |
| Status | Select | New, Reviewed, Archived |
| Tags | Multi-Select | Topic tags |
| SearchedAt | Date | When researched |
| ReviewedAt | Date | When DJ reviewed |

### Auto-Save

Set `DJ_RESEARCH_AUTO_SAVE=true` to save all research automatically.

Otherwise, use `/research save` for explicit saves.

## Citation Rules

1. **Always cite** - Every factual claim links to source
2. **Original URLs** - No Google cache/AMP links
3. **Access date** - Note for time-sensitive topics
4. **Paywall flags** - Note if content was partial

### Example Citation

```markdown
- AI regulation in EU expected to take effect 2025 [1]
- Companies must comply within 24 months [1]

### Sources
1. [EU AI Act Overview](https://example.com/ai-act) - Official summary (accessed Feb 2026)
```

## Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `DJ_NOTION_RESEARCH_RADAR_DB` | - | Notion database ID |
| `DJ_RESEARCH_AUTO_SAVE` | `false` | Auto-save all research |
| `DJ_RESEARCH_CACHE_TTL_HOURS` | `24` | Cache expiration |
| `DJ_RESEARCH_CHEAP_MAX_SEARCHES` | `1` | Cheap profile limit |
| `DJ_RESEARCH_CHEAP_MAX_FETCHES` | `2` | Cheap profile limit |
| `DJ_RESEARCH_NORMAL_MAX_SEARCHES` | `2` | Normal profile limit |
| `DJ_RESEARCH_NORMAL_MAX_FETCHES` | `5` | Normal profile limit |
| `DJ_RESEARCH_DEEP_MAX_SEARCHES` | `5` | Deep profile limit |
| `DJ_RESEARCH_DEEP_MAX_FETCHES` | `10` | Deep profile limit |

## Examples

### Quick Lookup (cheap)

```
/research "GPT-5 release date"
```

Output:
```markdown
## Research: GPT-5 release date

### Key Findings
- No official announcement from OpenAI as of Feb 2026
- Rumors suggest late 2026 or early 2027
- Focus currently on GPT-4 improvements

### Sources
1. [OpenAI Blog](https://openai.com/blog) - Official announcements

### Uncertainty
- Release dates are speculative
- OpenAI doesn't pre-announce
```

### Standard Research (normal)

```
/budget normal
/research "EU AI Act compliance requirements"
```

Output:
```markdown
## Research: EU AI Act compliance requirements

### Key Findings
- EU AI Act adopted April 2024, phased implementation
- High-risk AI systems require conformity assessment
- General-purpose AI models have transparency obligations
- Penalties up to €35M or 7% global turnover
- Compliance deadlines: 6-36 months depending on category

### Sources
1. [EU AI Act Text](https://...) - Official regulation
2. [European Commission FAQ](https://...) - Implementation guidance
3. [AI Act Compliance Guide](https://...) - Industry analysis

### Next Actions
- [ ] Identify which AI systems are "high-risk"
- [ ] Review current documentation practices
- [ ] Assess timeline for compliance work

### Uncertainty
- Some implementing acts still pending
- Interpretation may evolve
```

### Deep Dive (deep)

```
/budget deep
/research "quantum computing commercial timeline"
```

Returns comprehensive 8-10 bullet analysis with 8-10 sources.

### Save to Notion

```
/research save "podcast guest research: Jane Smith AI ethics"
```

Output:
```
## Research: podcast guest research: Jane Smith AI ethics

[... research output ...]

---
✅ Saved to Research Radar
View in Notion: [link]
```

## Best Practices

1. **Start cheap** - Many questions need only 1-2 sources
2. **Escalate when needed** - Switch to normal/deep for complex topics
3. **Save important research** - Use `/research save` for reference
4. **Check cache** - Repeated queries use cache (saves budget)
5. **Review uncertainty** - Pay attention to gaps in findings

## Troubleshooting

### No Results

```
Error: No relevant results found

Try:
- Rephrase query
- Use more specific terms
- Check if topic is too recent
```

### Rate Limited

```
Error: Search rate limited

Wait a few minutes and retry.
Consider caching results for reuse.
```

### Fetch Failed

```
Error: Could not fetch URL

Possible causes:
- Site blocking bots
- Paywall
- Temporary outage

Workaround: Try different sources
```

### Cache Issues

```
# Clear cache for fresh results
rm ~/.openclaw/cache/research/<cache_key>.json

# Clear all research cache
rm -rf ~/.openclaw/cache/research/
```
