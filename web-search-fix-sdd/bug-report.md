# Bug Report: Web Search Intermittent Failures

> **Bug ID:** `WEB-SEARCH-INTERMITTENT` | **Severity:** P2 | **Date:** 2026-01-06

## Summary

Web search command `/web` produces inconsistent results - sometimes succeeds, sometimes fails with generic error message. Core feature is unreliable.

## Expected vs Actual Behavior

### Expected Behavior
Web search should return results consistently for valid queries:
```
/web hello world → Returns search results
/web git flow principles → Returns search results
```

### Actual Behavior
| Query | Status | Output |
|-------|--------|--------|
| `hello world` | ❌ FAIL | `✂︎ Ошибка поиска: Ошибка при выполнении поиска Search ID: error-1767679754069` |
| `google it, git flow, main principles` | ✅ PASS | Detailed results about Git Flow |

## Error Output (Exact)

```
✂︎ Ошибка поиска:
Ошибка при выполнении поиска
Search ID: error-1767679754069
```

## Reproduction Steps

1. Send `/web hello world` to Telegram bot
2. Observe error message with Search ID starting with `error-`
3. Send `/web git flow main principles` to same bot
4. Observe detailed search results returned successfully

## Severity Assessment

| Factor | Value | Reasoning |
|--------|-------|-----------|
| **Impact** | Medium | Core feature (web search) fails intermittently |
| **Frequency** | Intermittent | ~50% failure rate observed |
| **Workaround** | None | User must retry same query |
| **Severity Level** | **P2** | Medium priority |

## Affected Components

| Component | File | Role |
|-----------|------|------|
| Shell Script | `scripts/web_search_with_gemini.sh` | Executes gemini CLI |
| TypeScript Executor | `src/web-search/executor.ts` | Parses output, handles errors |
| PI Tools | `src/agents/pi-tools.ts:350` | Web search tool definition |
| Telegram Messages | `src/web-search/messages.ts` | Error formatting |

## Evidence Collected

### Code Analysis - Shell Script (`scripts/web_search_with_gemini.sh`)

```bash
# Line 82-91: Error handling
timeout $SCRIPT_TIMEOUT gemini "$FULL_PROMPT" -m "$MODEL" --output-format "$OUTPUT_FORMAT" 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -eq 124 ]; then
  echo "Error: Search timed out after ${SCRIPT_TIMEOUT} seconds" >&2
  exit 124
elif [ $EXIT_CODE -ne 0 ]; then
  echo "Error: gemini CLI failed with exit code $EXIT_CODE" >&2
  exit $EXIT_CODE
fi
```

**Issue:** When gemini CLI fails, script outputs error TEXT (not JSON) to stdout.

### Code Analysis - Executor (`src/web-search/executor.ts:80-86`)

```typescript
// Gemini CLI outputs "Loaded cached credentials." before JSON - extract JSON part
let jsonStr = stdout.trim();
const jsonStart = jsonStr.indexOf('{');
if (jsonStart > 0) {
  jsonStr = jsonStr.slice(jsonStart);
}

const result = JSON.parse(jsonStr);  // FAILS if stdout is error text
```

**Issue:** If shell script outputs error text, `JSON.parse()` throws, causing the error message we see.

### Error Flow

```
1. /web query sent to bot
2. executeWebSearch() calls shell script
3. gemini CLI fails (various reasons)
4. Shell script outputs: "Error: gemini CLI failed with exit code X"
5. Executor tries JSON.parse("Error: gemini CLI failed...")
6. JSON.parse throws → Catch block returns generic error
7. User sees: "✂︎ Ошибка поиска: Ошибка при выполнении поиска"
```

## Root Cause Hypothesis

1. **Primary:** Shell script outputs error TEXT when gemini CLI fails, but executor expects JSON
2. **Secondary:** Missing retry logic for transient failures (API rate limits, network issues)
3. **Tertiary:** Error messages not detailed enough for debugging

## Additional Notes

- Git Flow query succeeds because gemini CLI returns valid JSON
- "hello world" fails because gemini CLI returns error (exit code != 0)
- The error message shown to user is generic, not the actual error

## Attachments

- Error screenshot: User provided Telegram message with `Search ID: error-1767679754069`
