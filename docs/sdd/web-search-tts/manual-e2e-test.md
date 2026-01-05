# Manual E2E Test Checklist

**Prerequisites:**
- [ ] Gateway running: `pnpm dev` or `pnpm gateway:watch`
- [ ] Telegram bot token configured in `~/.clawdis/clawdis.json`
- [ ] MiniMax API key set: `MINIMAX_API_KEY` environment variable
- [ ] TTS feature enabled (default: true)

**Test Environment:**
- Dry-run mode: Disabled (test real TTS generation)
- Test chat: Private Telegram chat with bot
- Test queries: Prepared

## Test Cases

### Test 1: Basic TTS Flow (Success)

Steps:
1. [ ] Send: `/web weather in Moscow`
2. [ ] Verify: Web search result received with "○ Результат поиска:"
3. [ ] Verify: "🔊 Озвучить" button appears below result
4. [ ] Click: "Озвучить" button
5. [ ] Verify: Button text changes to "⏳ 0% ░░░░░░░░░░░░"
6. [ ] Verify: Button updates to 25% → 50% → 75% → 100%
7. [ ] Verify: Audio file sent to chat (voice message)
8. [ ] Verify: Button is removed after audio sent
9. [ ] Verify: Audio plays the web search result in English_CalmWoman voice

Expected result: ✅ Full TTS flow successful

### Test 2: Cache Hit (Second Request)

Steps:
1. [ ] Send: `/web weather in Moscow` (same query as Test 1)
2. [ ] Verify: Result received with "Озвучить" button
3. [ ] Click: "Озвучить" button
4. [ ] Verify: Button jumps to 100% almost instantly (< 1 sec)
5. [ ] Verify: Same audio file sent (from cache)

Expected result: ✅ Cache hit works, fast response

### Test 3: Long Text Truncation

Steps:
1. [ ] Send: `/web history of the Roman Empire` (long expected result)
2. [ ] Verify: Result received (may be long)
3. [ ] Click: "Озвучить" button
4. [ ] Verify: Progress completes successfully
5. [ ] Verify: Audio is generated (may be truncated if > 9500 chars)

Expected result: ✅ Long text handled without error

### Test 4: TTS API Error (Simulated)

Steps:
1. [ ] Temporarily set invalid API key or block MiniMax API
2. [ ] Send: `/web test query`
3. [ ] Click: "Озвучить" button
4. [ ] Verify: Error message shown: "✂︎ Озвучка не удалась: {error}"
5. [ ] Verify: Button is removed
6. [ ] Verify: No retry button shown
7. [ ] Restore valid API key

Expected result: ✅ Error handled gracefully, button removed

### Test 5: Button Scope (No Button for Agent Tool)

Steps:
1. [ ] Send message that triggers agent's web_search tool
2. [ ] Verify: Web search result delivered
3. [ ] Verify: NO "Озвучить" button shown

Expected result: ✅ Button only for `/web` command, not agent

### Test 6: Russian Text Support

Steps:
1. [ ] Send: `/web погода в Санкт-Петербурге`
2. [ ] Verify: Result is in Russian
3. [ ] Click: "Озвучить" button
4. [ ] Verify: Audio generated with Russian text
5. [ ] Verify: Voice articulates Russian reasonably (English_CalmWoman)

Expected result: ✅ Russian text handled

## Regression Tests

- [ ] Existing `/web` command still works without clicking button
- [ ] Deep research `/depreserch` still works with its buttons
- [ ] Agent tool `web_search` still works
- [ ] No breaking changes to Telegram bot message handling
- [ ] Cache directory created correctly: `~/.clawdis/cache/tts/`

## Edge Cases

### Edge Case 1: Multiple Sequential Requests

1. [ ] Send `/web query1`, click "Озвучить"
2. [ ] Immediately send `/web query2` before TTS completes
3. [ ] Verify: Both requests handled independently
4. [ ] Verify: No state corruption between requests

### Edge Case 2: Rapid Button Clicks

1. [ ] Send `/web test`
2. [ ] Click "Озвучить" button multiple times rapidly
3. [ ] Verify: Only one TTS generation triggered
4. [ ] Verify: No duplicate audio files

## Performance Checks

- [ ] Cold cache TTS generation: < 20 seconds
- [ ] Warm cache (hit): < 1 second
- [ ] Button click acknowledgment: < 500ms
- [ ] Memory usage stable after multiple TTS generations

## Cleanup

- [ ] Clear cache: `rm -rf ~/.clawdis/cache/tts/`
- [ ] Verify cache rebuilt on next TTS request
