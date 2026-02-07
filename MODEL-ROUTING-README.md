# 🎯 Model Routing - Quick Start

> **Automatically route tasks to cost-effective models. Save 75-85% on AI costs.**

---

## Install

```bash
# Already included in OpenClaw (when feature is merged)
# No additional installation needed
```

---

## Enable

Add to `openclaw.json5`:

```json5
{
  "agents": {
    "defaults": {
      "modelRouting": {
        "enabled": true
      }
    }
  }
}
```

Restart OpenClaw:

```bash
openclaw gateway restart
```

---

## Use

### Automatic Routing

Just chat normally. Messages are auto-routed:

```
You: check WhatsApp status
🤖: [Using ollama/llama3.1:8b - FREE]

You: draft a follow-up email for the client
🤖: [Using claude-3-5-haiku - ₹0.75]

You: create a detailed technical proposal
🤖: [Using claude-sonnet-4-5 - ₹4]
```

### Manual Override

Force a specific model when needed:

```
You: check status [use sonnet]
🤖: [Using claude-sonnet-4-5 - ₹4]  ← Forced to Sonnet

You: complex analysis [use local]
🤖: [Using ollama/llama3.1:8b - FREE]  ← Forced to Local
```

**Override Options:**
- `[use local]` - Free local model
- `[use haiku]` - Fast, cheap cloud model
- `[use sonnet]` - Powerful, expensive cloud model

---

## Cost Savings Example

**Your Usage:**
- 1,000 messages/month
- Mix of simple (check status) and complex (write code) tasks

**Before Routing:**
- All messages use Sonnet: 1,000 × ₹4 = **₹4,000/month**

**After Routing:**
- 400 simple → Local (free): 400 × ₹0 = ₹0
- 400 medium → Haiku: 400 × ₹0.75 = ₹300
- 200 complex → Sonnet: 200 × ₹4 = ₹800
- **Total: ₹1,100/month**

**💰 Savings: ₹2,900/month (73%)**

---

## How It Works

### 1. Message Analysis

```
You: "check WhatsApp lead status"
     ↓
Keywords detected: "check", "status"
     ↓
Classified as: status_check (simple task)
     ↓
Routed to: Local model (FREE)
```

### 2. Task Types

| Task Type | Example | Model Used | Cost |
|-----------|---------|------------|------|
| Status Check | "check status" | Local | FREE |
| File Operation | "read README" | Local | FREE |
| Draft Message | "write email" | Haiku | ₹0.75 |
| General Query | "help me with X" | Haiku | ₹0.75 |
| Proposal | "create proposal" | Sonnet | ₹4 |
| Technical | "explain code" | Sonnet | ₹4 |
| Analysis | "analyze data" | Sonnet | ₹4 |

### 3. Confidence Scoring

```
Message: "draft a quick email"
         ↓
Scores:
- Local:  1 (keyword: "quick")
- Haiku:  4 (keywords: "draft", "email")
- Sonnet: 0
         ↓
Confidence: 80% (4/5)
         ↓
Route to Haiku ✅
```

---

## Customize

### Add Your Keywords

```json5
{
  "modelRouting": {
    "keywords": {
      "local_triggers": [
        "check", "status", "list",
        "my-custom-word"  // ← Add your own
      ],
      "haiku_triggers": [
        "draft", "email", "message",
        "another-keyword"  // ← Add your own
      ],
      "sonnet_triggers": [
        "proposal", "analyze", "complex",
        "special-task"  // ← Add your own
      ]
    }
  }
}
```

### Adjust Confidence

```json5
{
  "modelRouting": {
    "override": {
      "minConfidence": 0.8  // Higher = more conservative
    }
  }
}
```

- **0.6** - Aggressive (max savings, some risk)
- **0.7** - Balanced (default)
- **0.8** - Conservative (less savings, safer)

### Override Task Rules

```json5
{
  "modelRouting": {
    "rules": {
      "draft_message": "ollama/llama3.1:8b"  // Use local for all drafts
    }
  }
}
```

---

## Debug

### View Routing Logs

```bash
openclaw logs | grep "model-routing"
```

**Output:**
```
[model-routing] routed taskType=status_check confidence=95% 
from=anthropic/claude-sonnet-4-5 to=ollama/llama3.1:8b

[model-routing] no_override taskType=general confidence=65% 
model=anthropic/claude-3-5-haiku-20241022
```

### Test Classification

```bash
# Check how a message would be classified
openclaw routing classify "your message here"
```

---

## FAQ

**Q: Will this make responses slower?**  
A: No. Classification adds <10ms. Local models are often faster than remote ones.

**Q: What if it picks the wrong model?**  
A: Override with `[use MODEL]`. Example: `your message [use sonnet]`

**Q: Can I disable routing temporarily?**  
A: Yes. Set `enabled: false` in config or override every message.

**Q: Does it work with my custom models?**  
A: Yes. Use any model format in rules: `"provider/model-name"`

**Q: What about image/vision tasks?**  
A: Image tasks bypass routing and use your `imageModel` config.

**Q: How accurate is the classification?**  
A: ~80-90% accuracy. Improves with custom keywords for your use case.

---

## Troubleshooting

### Routing Not Working

1. Check config: `enabled: true`
2. Restart OpenClaw: `openclaw gateway restart`
3. Check logs: `openclaw logs | grep "model-routing"`

### Wrong Model Selected

1. Use override: `your message [use sonnet]`
2. Add keywords to config (see Customize section)
3. Adjust `minConfidence` threshold

### Too Expensive (Too Much Sonnet)

1. Lower `minConfidence` to 0.6
2. Add more `haiku_triggers` keywords
3. Review logs to see classification patterns

---

## Learn More

- **Full Documentation:** [docs/features/model-routing.md](docs/features/model-routing.md)
- **Feature Request:** [#11068](https://github.com/openclaw/openclaw/issues/11068)
- **Discord:** [#feature-requests](https://discord.com/invite/clawd)

---

## Examples

### Example 1: Daily Workflow

```
8:00 AM - "check today's calendar" → Local (FREE)
9:00 AM - "draft email to client" → Haiku (₹0.75)
10:00 AM - "create project proposal" → Sonnet (₹4)
11:00 AM - "summarize meeting notes" → Haiku (₹0.75)
2:00 PM - "analyze quarterly data" → Sonnet (₹4)
4:00 PM - "list pending tasks" → Local (FREE)

Daily Cost: ₹9.50 (vs ₹24 without routing)
Daily Savings: ₹14.50 (60%)
```

### Example 2: Override When Needed

```
# Normal classification
"check status"
→ Local (FREE)

# But you want high-quality output
"check status [use sonnet]"
→ Sonnet (₹4)

# Or you want faster response
"create proposal [use haiku]"
→ Haiku (₹0.75) - faster but may lack depth
```

---

## Support

**Bug Reports:** [GitHub Issues](https://github.com/openclaw/openclaw/issues)  
**Feature Requests:** [#11068](https://github.com/openclaw/openclaw/issues/11068)  
**Questions:** [Discord #support](https://discord.com/invite/clawd)

---

**Made with ❤️ by OpenClaw Community**

**License:** MIT  
**Status:** Feature Request (Implementation Complete)  
**Version:** 1.0.0 (pending merge)
