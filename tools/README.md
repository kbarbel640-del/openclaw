# OpenClaw Tools

Utility tools for OpenClaw agents and users.

## Available Tools

### token-counter

A deterministic token counting and reporting toolkit for OpenClaw sessions. Provides real-time visibility into token usage, context window utilization, and API costs.

```bash
# Quick token report
node tools/token-counter/report.js --tools 5

# Tokenize text
node tools/token-counter/tokenize.js "your text here"

# Analyze session
node tools/token-counter/analyze-session.js --last 5
```

See [token-counter/README.md](./token-counter/README.md) for full documentation.

## Adding New Tools

1. Create a new directory under `tools/`
2. Add a `README.md` with usage documentation
3. Add a `package.json` if the tool has npm dependencies
4. Update this README with a link to your tool
