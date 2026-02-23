# OpenClaw Token Counter

A deterministic token counting and reporting toolkit for OpenClaw sessions. Provides real-time visibility into token usage, context window utilization, and API costs.

## Why This Exists

LLM token usage directly impacts costs and context limits. This toolkit gives OpenClaw agents and users clear visibility into:

- **Turn-by-turn token usage** - See exactly how many tokens each exchange consumes
- **Context window utilization** - Know when you're approaching context limits
- **Session totals** - Track cumulative usage across a conversation
- **Cost awareness** - Understand the resource cost of interactions

## Structure

```
tools/token-counter/
├── README.md              # This file
├── package.json           # NPM package definition
├── tokenize.js            # Core tokenizer (deterministic BPE-style)
├── api-usage.js           # Extracts ACTUAL token usage from session files
├── report.js              # Main reporter (turn + context window + session)
├── track.js               # Token tracking state management
├── analyze-session.js     # Deep session analysis
├── session-report.js      # Detailed session reports
├── report.sh              # Shell wrapper for quick access
├── tool-count.json        # Tool call counter state
└── track-state.json       # Tracking state
```

## Core Components

### `tokenize.js` - Deterministic Tokenizer

Estimates token counts without external dependencies. Same input always produces the same output.

```bash
# Basic usage
node tokenize.js "Write a hello world program"

# From file
node tokenize.js --file instruction.txt

# JSON output
node tokenize.js --json "Your instruction"

# Specify model
node tokenize.js --model claude "Explain quantum physics"
```

### `api-usage.js` - Real Token Extractor

Extracts **actual** token usage from OpenClaw session files (as reported by the LLM provider API).

```bash
# Current session summary
node api-usage.js

# Last message only (compact)
node api-usage.js --last

# Specific session file
node api-usage.js --session /path/to/session.jsonl
```

### `report.js` - Main Reporter

Produces the formatted token report for appending to agent messages.

```bash
# Report with tool call count
node report.js --tools 5

# Reset counters
node report.js --reset
```

**Output format:**
```
📊 **Turn #5**
   New: 1,234 in / 456 out
   Context: 23,456 cached (system prompt + files + history)
   Tools: 3 calls
📊 **Context Window** 🟢
   Input: 25,000 / 204,800 tokens (12.2%)
   [█░░░░░░░░░] 88% remaining (179,800 tokens)
📊 **Session**
   New tokens: 12,345 (10,000 in / 2,345 out)
   Total processed: 45,678 (includes 33,333 cache re-reads)
```

### `track.js` - State Management

Manages persistent token tracking state across turns.

```bash
# Add input tokens
node track.js --add-input "user message"

# Add output tokens  
node track.js --add-output "assistant message"

# Add tool call count
node track.js --add-tool 3

# Generate report
node track.js --report
```

## Model Support

Context window sizes are configured for:

| Provider | Models | Context Window |
|----------|--------|----------------|
| Z.AI | GLM-5, GLM-4.7 | 204,800 |
| MiniMax | M2.5 | 200,000 |
| Anthropic | Claude 3/4 series | 200,000 |
| Google | Gemini 2.5/3 | 1,000,000 |
| OpenAI | GPT-4o, GPT-4-turbo | 128,000 |

## Integration with OpenClaw

### Agent Integration

Add to your `AGENTS.md` to enable automatic token reporting:

```markdown
## Token Reporting (REQUIRED - Every Message)

After EVERY response, run the token reporter:

\`\`\`bash
node ~/.openclaw/tools/token-counter/report.js --tools N
\`\`\`

Include the FULL output verbatim in your response.
```

### Heartbeat Integration

Track token usage during periodic heartbeat checks:

```bash
node ~/.openclaw/tools/token-counter/track.js --report >> heartbeat-logs.txt
```

## Deterministic Guarantee

The `tokenize.js` tokenizer uses a deterministic algorithm that approximates BPE-style tokenization without external dependencies. It's consistent across runs but provides estimates rather than exact counts (which require model-specific tokenizers).

**Same input → Same token count, always.**

## Installation

```bash
# Copy to OpenClaw tools directory
cp -r tools/token-counter ~/.openclaw/tools/

# Make executable
chmod +x ~/.openclaw/tools/token-counter/*.js
```

## License

MIT License - Part of OpenClaw
