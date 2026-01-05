# Gaps: Web Search TTS Integration

## Status: ALL GAPS FILLED

---

## GAP-001: MiniMax TTS Voice Selection

**Question**: Which voice should be used for Russian web search results?

**Answer**: `English_CalmWoman`

**Notes**: Even though search results are in Russian, user explicitly chose `English_CalmWoman` voice. This is acceptable for TTS - the voice will still articulate Russian text reasonably well.

---

## GAP-002: Audio File Caching

**Question**: Should generated audio files be cached?

**Decision**: **Yes, cache by result hash**

**Rationale**:
- Web search results don't change for the same query
- Saves MiniMax API costs and latency
- Cache key: SHA-256 hash of the result text
- Cache location: `~/.clawdis/cache/tts/`
- Cache TTL: 7 days (configurable)

---

## GAP-003: Long Text Handling

**Question**: What if web search result exceeds MiniMax's character limit?

**Decision**: **Truncate to max length with ellipsis indicator**

**Rationale**:
- MiniMax TTS 2.6 supports up to ~10,000 characters
- Splitting into chunks creates poor UX (multiple audio files)
- Truncation at ~9,500 characters with "..." suffix
- Alternative: If result > limit, show warning before button

**Technical Note**: Web search results are typically summaries (500-2000 chars), so this edge case is rare.

---

## GAP-004: Error Handling Behavior

**Question**: What should happen if MiniMax TTS API fails?

**Decision**: **Show error message + remove button**

**Rationale**:
- Consistent with web search error pattern (shows error, no retry button)
- User can always re-trigger `/web` command if needed
- Simpler UX than persistent retry buttons
- Error message: "✂︎ Озвучка не удалась: {error}"

---

## GAP-005: Progress Display Implementation

**Question**: How exactly should progress be shown on the button?

**Decision**: **Edit button text with percentage + visual bar**

**Implementation**:
- Initial: "🔊 Озвучить"
- On click: Button text updates to "⏳ 25% ▮▮░░░░"
- Progress increments: 0% → 25% → 50% → 75% → 100%
- At 100%: Button removed, audio file sent

**Technical**: Use `editMessageReplyMarkup` to update button text only.

---

## GAP-006: MiniMax API Authentication

**Question**: How to authenticate with MiniMax API?

**Decision**: **Environment variable pattern**

**Configuration**:
```json5
{
  tts: {
    enabled: true,
    minimaxApiKey: "your-api-key",  // or MINIMAX_API_KEY env
    minimaxGroupId: "your-group-id", // optional, defaults to "default"
    model: "speech-2.6-hd",
    voiceId: "English_CalmWoman",
    emotion: "fluent",
    speed: 1.0,
    cacheTtlSec: 604800  // 7 days
  }
}
```

---

## GAP-007: Button Placement Scope

**Question**: Should TTS button appear for all web search triggers?

**Decision**: **Only for successful `/web` command results**

**Scope**:
- ✅ `/web <query>` command → show button
- ❌ Agent tool `web_search` → no button (agent-only usage)
- ❌ Auto-categorized web intent → no button (avoid clutter)

**Reasoning**: The feature is specifically for the Telegram `/web` user command.

---

## All Gaps Resolved ✓

The requirements are now complete and unambiguous. Proceeding to Phase 4: Output.
