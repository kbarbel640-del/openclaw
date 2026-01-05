[[appended]]

---

## 🕸️ AI Agent Tools: Web Search Integration

### Overview

AI agents have access to powerful web search tools that can query current information. These tools are **always available** and should be used proactively when:
- User asks about current events, weather, news
- User uses search keywords: "погугли", "search", "google", "веб поиск"
- Information needed is time-sensitive or may have changed
- User explicitly requests web search

---

### 🛠️ Available Tools

#### 1. `google_web` (Primary Tool)

**CLI for Gemini web searches.**

**Location:** `/home/almaz/zoo_flow/clawdis/google_web`

**Basic Usage:**
```bash
# Simple search (uses Gemini backend by default)
google_web "погода в Москве"

# With options
google_web --format text "python tutorial"
google_web --dry-run "query"
google_web --help
```

**Output Format:**
```json
{
  "session_id": "abc-123",
  "response": "Search results in Russian",
  "stats": { "models": { ... } }
}
```

**Environment Variables:**
```bash
export WEB_SEARCH_TIMEOUT="30"        # seconds
```

### 🤖 When to Use Web Search

#### ✅ DO Use Web Search When:

1. **Current Information Needed**
   ```bash
   User: "погода в Москве"
   → google_web "погода в Москве"
   ```

2. **User Explicitly Requests Search**
   ```bash
   User: "погугли последние новости"
   → google_web "последние новости"
   ```

3. **Recent Events**
   ```bash
   User: "результаты матча вчера"
   → google_web "результаты матча вчера"
   ```

4. **Time-Sensitive Data**
   ```bash
   User: "курс доллара"
   → google_web "курс доллара"
   ```

5. **Multi-Step Reasoning Needs Fresh Data**
   ```bash
   User: "Какая компания лидирует в ИИ в 2024?"
   → google_web "AI market leaders 2024"
   → Analyze results
   → Provide answer
   ```

#### ❌ DO NOT Use Web Search When:

1. **Historical Facts** (already known)
   ```bash
   User: "кто такой Альберт Эйнштейн"
   → NO SEARCH (in training data)
   ```

2. **Personal Questions**
   ```bash
   User: "как тебя зовут"
   → NO SEARCH (bot identity)
   ```

3. **Simple Calculations**
   ```bash
   User: "2 + 2"
   → NO SEARCH (compute directly)
   ```

4. **Creative Tasks**
   ```bash
   User: "напиши стихотворение"
   → NO SEARCH (generate)
   ```

---

### 🔍 Detection Logic

The system automatically detects web search intent:

**Explicit Keywords (Confidence: 95-100%):**
- "погуглить", "погугли", "загугли"
- "google", "search", "look up"
- "найди в интернете", "поиск в сети"

**Contextual Patterns (Confidence: 85-94%):**
- Questions about weather: "погода в..."
- News queries: "последние новости..."
- Current events: "что нового..."
- Time-sensitive: "курс доллара", "цена..."

**Question Words + Topics (Confidence: 75-84%):**
- "что такое [topic]"
- "как [topic]"
- "где [topic]"
- "когда [topic]"

**Minimum Confidence:** 75% to trigger search

---

### 💬 Response Format

#### User-Facing Output

```
🔍 Выполняю веб-поиск...
[5-10 seconds later]
🌐 Результат поиска:
В Москве сейчас +15°C, переменная облачность...
```

**Visual Elements:**
- 🔍 Magnifying glass: Search in progress
- 🌐 Globe: Search result
- ❌ Red X: Error
- ⏱️ Stopwatch: Timeout

---

### 🛡️ Error Handling

**Retry Strategy:**
```bash
# On error, retry once with modified query
try {
  const result = await google_web(query);
} catch (error) {
  if (error.includes('timeout')) {
    # Retry with shorter query
    const result = await google_web(simplifyQuery(query));
  } else if (error.includes('API')) {
    # Log error and inform user
    return messages.error(error.message, result.session_id);
  }
}
```

**Fallback Order:**
1. Primary: `google_web` with Gemini backend
2. Final: Inform user search is unavailable

---

### 🔄 Multi-Step Reasoning Patterns

#### Pattern 1: Fact Verification

```bash
# User claims something needs verification
const claim = "Python 3.12 was released in 2023"
const searchResult = await google_web("Python 3.12 release date")
const verified = verifyClaim(claim, searchResult.response)
if (verified) {
  return "✅ That is correct!"
} else {
  return "❌ Actually, " + extractCorrectInfo(searchResult.response)
}
```

#### Pattern 2: Current Data Analysis

```bash
# User asks about trends
const searchResult = await google_web("AI adoption statistics 2024")
const stats = extractStatistics(searchResult.response)
const analysis = analyzeTrends(stats)
return `Based on current data: ${analysis.summary}`
```

#### Pattern 3: Weather + Recommendation

```bash
# Weather query + clothing advice
const weatherData = await google_web("погода в Москве завтра")
const temp = extractTemperature(weatherData.response)
const conditions = extractConditions(weatherData.response)
const recommendation = suggestClothing(temp, conditions)
return `${weatherData.response}\n\n💡 Recommendation: ${recommendation}`
```

---

### 📊 Backend Selection Guide

#### Gemini Backend (Default)
**Best for:**
- Russian queries
- Natural language summaries
- Complex reasoning about search results

**Tradeoffs:**
- Slower (5-10s typical)
- Less structured output
- Gemini API quota limits

---

### 📝 Documentation Reference

**For AI Agents:**
- **SDD:** `docs/sdd/web-search-via-gemini-cli/` (complete spec)
- **Tools Quick Ref:** `docs/sdd/web-search-via-gemini-cli/AI_AGENT_TOOLS.md`
- **Gap Decisions:** `docs/sdd/web-search-via-gemini-cli/gaps.md`

**Tool Locations:**
```bash
google_web              # Main CLI wrapper (symlink)
google-web-cli.sh       # Full script
```

**Configuration:**
- `.env` file in project root
- `WEB_SEARCH_TIMEOUT` = timeout in seconds

---

### 🚀 Quick Test

```bash
# Test web search
cd /home/almaz/zoo_flow/clawdis
./google_web --dry-run "тестовый запрос"

# See help
./google_web --help
```

Expected output for `--dry-run`:
```
📝 DRY RUN MODE
🐛 DEBUG: Backend=gemini
🐛 DEBUG: CLI=/home/almaz/TOOLS/web_search_by_gemini/web-search-by-Gemini.sh
🐛 DEBUG: Timeout=30s
🐛 DEBUG: Query=тестовый запрос
✓ Would execute: timeout 30s "/home/almaz/TOOLS/web_search_by_gemini/web-search-by-Gemini.sh" --request "тестовый запрос"
```

---

### ✅ Agent Checklist

**Before Using Web Search:**
- [ ] Query needs current/fresh information?
- [ ] User explicitly requested search?
- [ ] Deep research not already triggered?
- [ ] Query confidence ≥75%?
- [ ] Backend configured and available?

**After Getting Results:**
- [ ] Response marked with 🌐 emoji?
- [ ] Result in appropriate language?
- [ ] Session ID captured for debugging?
- [ ] Error handling in place?
- [ ] Ready for user presentation?

**For Multi-Step Reasoning:**
- [ ] Search result analyzed appropriately?
- [ ] Extracted relevant information?
- [ ] Combined with other knowledge?
- [ ] Formatted final answer clearly?
- [ ] Credited source appropriately?

---

## 🎓 Best Practices Summary

1. **Be Proactive:** Don't wait for explicit "search" keywords if context suggests need
2. **Be Fast:** Use Gemini for efficient web searches
3. **Be Clear:** Always mark search results visually (🌐)
4. **Be Safe:** Handle errors gracefully with fallbacks
5. **Be Smart:** Extract and synthesize, don't just dump results
6. **Be Current:** No caching, always fresh data
7. **Be Aware:** Check if deep research already triggered

---

**Remember:** Web search is a tool in your toolkit. Use it judiciously, but don't hesitate when current information is needed or explicitly requested.