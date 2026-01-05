# Card 07: E2E Tests & Polish

| Field | Value |
|-------|-------|
| **ID** | TTS-07 |
| **Story Points** | 2 |
| **Depends On** | 06 |
| **Sprint** | 3 |

## User Story

> As a developer, I want to verify the complete TTS flow so that the feature works end-to-end.

## Context

Read before starting:
- [../manual-e2e-test.md](../manual-e2e-test.md) - Complete test checklist
- [src/tts/*.ts](../../../../../src/tts/) - All TTS modules

## Instructions

### Step 1: Run Manual E2E Tests

Follow the test checklist in `manual-e2e-test.md`:

**Test 1: Basic TTS Flow**
1. Start gateway: `pnpm dev`
2. Set `MINIMAX_API_KEY` environment variable
3. Send `/web weather in Moscow` to your bot
4. Verify button appears, click it, verify audio

**Test 2: Cache Hit**
1. Send same `/web` query again
2. Click button, verify fast response (< 1 sec)

**Test 3: Error Handling**
1. Temporarily break API key
2. Verify error message shown, button removed

**Test 4: Scope Validation**
1. Trigger agent's web_search tool (not `/web` command)
2. Verify NO button appears

### Step 2: Add Logging

Ensure proper logging in `src/tts/client.ts` and `src/tts/provider.ts`:

```typescript
// Add to synthesize function
console.log(`[tts] Synthesizing: ${text.slice(0, 50)}... (${text.length} chars)`);
console.log(`[tts] Cache ${cached ? "HIT" : "MISS"}: ${hash}`);
```

### Step 3: Edge Case Testing

Test edge cases:
- Very long web search results (> 5000 chars)
- Empty results
- Special characters in results
- Multiple concurrent TTS requests

### Step 4: Code Quality

Run checks:
```bash
pnpm build
pnpm lint
pnpm test
```

Fix any issues found.

### Step 5: Documentation Updates

Update relevant docs:
- Add TTS section to `docs/configuration.md` if needed
- Update `README.md` if feature is user-facing
- Add example config to `.env.example`

## Acceptance Criteria

- [ ] All E2E tests from `manual-e2e-test.md` pass
- [ ] Cache hit/miss logged correctly
- [ ] Error messages are user-friendly
- [ ] Long text handled without crashes
- [ ] Type checking passes: `pnpm build`
- [ ] No lint errors: `pnpm lint`
- [ ] Documentation updated

## Final Verification

After this card:
- [ ] Feature is complete and working
- [ ] All cards marked completed in state.json
- [ ] Ready for user testing

## Next Steps

After completing this card:
1. Update state.json: set card 07 to "completed"
2. SDD implementation complete! 🎉
3. Feature ready for production use
