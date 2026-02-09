---
name: code-review
description: AI-powered code review with intelligent model selection (Claude for logic, Gemini for style)
---

# Code Review

Comprehensive code review using multiple AI models with automatic selection based on complexity analysis.

## Features

✨ **Intelligent Model Selection**

- Automatic complexity analysis of code changes
- Smart model selection based on complexity (simple/advanced)

🧠 **Logic Review (Claude)**

- Uses Claude Sonnet 4.5 (simple) or Opus 4.5 (advanced)
- Focuses on: logic errors, security vulnerabilities, potential bugs
- Direct CLI invocation for token efficiency

🎨 **Style Review (Gemini)**

- Uses Gemini Flash (simple) or Pro (advanced)
- Focuses on: code style, readability, naming conventions
- Executed via OpenClaw agent

⚡ **Automatic Fallback**

- Auto-switches to backup models on 429/token limit errors
- Real-time notification of model switches
- Fallback tracking in final report

📊 **Concise Reporting**

- Reports only issues, risks, and improvement suggestions
- No praise or descriptions of good implementations
- Clear model attribution and review duration

## Usage

```bash
review [target]
```

### Parameters

- `target`: Git reference (branch, commit, or `HEAD`), defaults to `HEAD`
- If no target is provided, compares changes from `main` to `HEAD`

### Examples

```bash
# Review current branch changes relative to main
review

# Review specific branch
review feature/new-feature

# Review specific commit
review abc1234
```

## Workflow

1. **Extract Changes**: Run `git diff main...target` to get code changes
2. **Complexity Analysis**: Use Gemini Flash to quickly analyze change complexity
   - Evaluate file count, logic complexity, security impact
   - Determine whether to use simple or advanced models
3. **Logic Review**: Use Claude to analyze logic, security, and bugs
   - Simple changes → Claude Sonnet 4.5
   - Complex changes → Claude Opus 4.5
   - Fallback to Claude Haiku 4.5 on failure
4. **Style Review**: Use Gemini to analyze style and readability
   - Simple changes → Gemini Flash
   - Complex changes → Gemini Pro
   - Fallback to Gemini Flash on failure
5. **Generate Report**: Merge both reviews and save to `Docs/Reviews/`

## Complexity Analysis

Gemini Flash automatically evaluates the following factors:

- Number and scope of modified files
- Logic complexity (algorithms, architecture changes, new features)
- Security impact (authentication, authorization, data handling)
- Required review depth

**Analysis Results:**

- `simple`: Uses lightweight models (Sonnet / Flash)
- `advanced`: Uses more powerful models (Opus / Pro)

## Report Format

Reports include the following sections:

1. **Review Summary**: Target, timestamp, complexity, risk level
2. **Logic Review**: Claude's analysis (issues & risks, improvement suggestions)
3. **Style Review**: Gemini's analysis (style issues, optimization directions)
4. **Review Summary**: Models used, duration, fallback information

Report location: `Docs/Reviews/review-{target}-{timestamp}.md`

## Requirements

### Essential

- OpenClaw CLI installed and configured
- Claude CLI installed: `npm install -g @anthropic-ai/claude-cli`
- Gemini models available (via google-gemini-cli extension)

### Model Requirements

**Logic Review (Claude):**

- Primary: `claude-sonnet-4-5` (simple) / `claude-opus-4-5` (advanced)
- Fallback: `claude-haiku-4-5`

**Style Review (Gemini):**

- Primary: `gemini-3-flash-preview` (simple) / `gemini-3-pro-preview` (advanced)
- Fallback: `gemini-3-flash-preview`

**Complexity Analysis (Gemini):**

- `gemini-3-flash-preview`

## Error Handling

### Automatic Fallback

The following errors trigger automatic model switching:

- HTTP 429 (Rate Limit)
- Token limit exceeded
- Quota exhausted

### Failure Handling

If both primary and fallback models fail, the report includes error messages and suggestions:

- Check Claude CLI authorization
- Verify API quota
- Retry later

## Output Example

```
═══════════════════════════════════════
  📋 Code Review Tool
═══════════════════════════════════════
Target: HEAD

📂 Extracting code changes...
  ✓ Diff size: 12.34 KB

📊 Analyzing code complexity...
  ✓ Complexity: 🟢 Low
  Reason: Only 2 files modified, no architecture changes

🧠 Running logic review (Claude)...
  Selected model: sonnet (simple)

🎨 Running style review (Gemini)...
  Selected model: google-gemini-cli/gemini-3-flash-preview (simple)

═══════════════════════════════════════
✓ Review complete!
═══════════════════════════════════════
📄 Report location: Docs/Reviews/review-HEAD-2026-02-06T12-00-00.md
⏱️  Duration: 15.3 seconds

Models used:
  • Logic: sonnet
  • Style: google-gemini-cli/gemini-3-flash-preview
```

## Configuration

### Claude CLI Setup

Ensure Claude CLI is authenticated:

```bash
claude login
```

### OpenClaw Setup

Ensure Gemini extension is installed and configured:

```bash
openclaw config get google-gemini-cli
```

## Best Practices

1. **Regular Reviews**: Run reviews before merging
2. **Small Batches**: Keep changes small for more precise reviews
3. **Monitor Fallbacks**: Frequent fallbacks may indicate quota issues
4. **Combine with Human Review**: AI review is supplementary, not a replacement

## Limitations

### Intelligent Processing

- **Adaptive Diff Handling**: The analyzer agent evaluates diff size and complexity
  - For very large diffs, the agent may sample key sections rather than process everything
  - Impact: Extremely large refactors (e.g., 100+ files) are best reviewed in batches
  - Recommendation: Keep changes focused and under ~20 files per review for best results

### Infrastructure Dependencies

- **Network Connectivity**: Requires stable internet connection
  - Both Claude and Gemini APIs are cloud-based services
  - Unreliable networks may cause review failures or timeouts

- **API Availability**: Depends on third-party API uptime
  - If Claude or Gemini APIs experience downtime, reviews will fail
  - API quota exhaustion will trigger automatic fallback (if available) or failure

**Best Practice**: For large-scale changes, break them into logical chunks and review incrementally. This produces more accurate analysis and better fits within API constraints.

## Troubleshooting

### Claude CLI Not Found

```bash
npm install -g @anthropic-ai/claude-cli
claude login
```

### OpenClaw Not Found

Verify OpenClaw is in PATH or at standard locations:

- `/opt/homebrew/bin/openclaw`
- `/usr/local/bin/openclaw`

### Agent Creation Failed

Check if Gemini extension is properly installed:

```bash
openclaw extensions list
```

### Review Failed

1. Check API quota
2. Verify network connectivity
3. Check model availability
4. Review detailed error messages
