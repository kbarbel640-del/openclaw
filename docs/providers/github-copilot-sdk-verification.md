---
summary: "Verification guide for GitHub Copilot SDK subscription model discovery"
read_when:
  - You want to verify SDK is using your subscription models
  - You need to troubleshoot model discovery issues
---
# GitHub Copilot SDK Verification Guide

This guide walks through verifying that the GitHub Copilot SDK integration correctly discovers and uses models from **your** subscription.

## Understanding How It Works

The SDK integration queries models available in your GitHub Copilot subscription by:

1. **Using your GitHub token** to authenticate with GitHub Copilot services
2. **Querying the Copilot CLI** which has direct access to your subscription details
3. **Listing available models** via `listModels()` API that returns models based on your subscription tier
4. **Extracting model metadata** including capabilities, limits, and supported features

**Key Point**: The SDK does NOT use a hardcoded model list. It dynamically queries GitHub's API using your credentials to determine which models you have access to.

## Step-by-Step Verification

### Step 1: Verify Your Copilot Subscription

First, confirm you have an active GitHub Copilot subscription:

```bash
gh copilot explain "test"
```

Expected: The CLI should work and show you have access.

To check your subscription details:
```bash
gh api /user/copilot
```

This returns your subscription status, billing info, and plan type (Individual, Business, Enterprise).

### Step 2: Install and Configure OpenClaw

1. **Install the Copilot CLI**:
   ```bash
   npm install -g @github/copilot
   ```

2. **Authenticate**:
   ```bash
   gh copilot auth login
   ```

3. **Configure OpenClaw** to enable SDK discovery (`~/.openclaw/config.json`):
   ```json5
   {
     "models": {
       "copilotSdk": {
         "enableModelDiscovery": true
       }
     }
   }
   ```

4. **Login to GitHub Copilot via OpenClaw**:
   ```bash
   openclaw models auth login-github-copilot
   ```

### Step 3: Verify Model Discovery

**Method 1: Check discovered models**

```bash
openclaw models list | grep github-copilot
```

Expected output should show models specific to your subscription tier:

**Copilot Individual** (example):
```
✓ github-copilot/gpt-4o
✓ github-copilot/gpt-4.1
✓ github-copilot/o1-mini
```

**Copilot Business/Enterprise** (example):
```
✓ github-copilot/gpt-4o
✓ github-copilot/gpt-4.1
✓ github-copilot/o1
✓ github-copilot/o1-mini
✓ github-copilot/claude-sonnet-4.5
```

**Method 2: Inspect models.json**

```bash
cat ~/.openclaw/models.json | jq '.providers["github-copilot"].models'
```

Expected: Array of models with detailed metadata from your subscription:

```json
[
  {
    "id": "gpt-4o",
    "name": "GPT-4o",
    "api": "openai-responses",
    "reasoning": false,
    "input": ["text", "image"],
    "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
    "contextWindow": 128000,
    "maxTokens": 4096
  },
  {
    "id": "o1",
    "name": "o1",
    "api": "openai-responses",
    "reasoning": true,
    "input": ["text"],
    "contextWindow": 200000,
    "maxTokens": 100000
  }
]
```

**Method 3: Check gateway logs**

```bash
openclaw gateway run --dev 2>&1 | grep -i "copilot\|models"
```

Look for:
```
Discovered 5 models from GitHub Copilot subscription
```

The number should match your subscription's model count.

### Step 4: Test Model Usage

**Test 1: Verify model selection**

```bash
openclaw models set github-copilot/gpt-4o
openclaw status
```

Expected: Status should show `github-copilot/gpt-4o` as the active model.

**Test 2: Send a test message**

```bash
openclaw agent --message "What models can you use?" --verbose
```

Expected: 
- Response uses the selected Copilot model
- Verbose output shows the model ID in the request

**Test 3: Verify API routing**

Check that requests go to your Copilot subscription:

```bash
openclaw agent --message "Hello" --verbose 2>&1 | grep -i "api\|token\|copilot"
```

Expected: You should see references to Copilot API endpoints and token exchange.

### Step 5: Compare with Subscription Limits

**Verify context window accuracy**:

1. Check a model's context window from your subscription:
   ```bash
   gh copilot explain "Tell me about GPT-4o context window"
   ```

2. Compare with OpenClaw's discovered value:
   ```bash
   openclaw models list --json | jq '.[] | select(.id == "github-copilot/gpt-4o") | .contextWindow'
   ```

Expected: Values should match (e.g., 128000 tokens for GPT-4o).

**Verify vision support**:

Models with vision capabilities (GPT-4o, GPT-4.1) should show `"input": ["text", "image"]`:

```bash
openclaw models list --json | jq '.[] | select(.id == "github-copilot/gpt-4o") | .input'
```

Expected: `["text", "image"]` for vision-capable models.

## Troubleshooting Verification

### Issue: No models discovered

**Check 1: CLI authentication**
```bash
gh auth status
```

Expected: `Logged in to github.com as <your-username>`

**Check 2: Copilot access**
```bash
gh api /user/copilot
```

Expected: JSON response with `"seat_management_url"` and subscription details.

**Check 3: OpenClaw auth**
```bash
openclaw status | grep -i auth
```

Expected: GitHub Copilot auth profile listed.

### Issue: Wrong models discovered

**Verify subscription tier**:
```bash
gh api /user/copilot | jq '.plan'
```

- `"individual"` = Individual plan (limited models)
- `"business"` = Business plan (more models)
- `"enterprise"` = Enterprise plan (full model access)

**Check model availability in Copilot CLI**:
```bash
gh copilot explain "test" --model gpt-4o
```

If this works, the model should be discovered by OpenClaw.

### Issue: Outdated model list

**Force refresh**:
```bash
rm ~/.openclaw/models.json
openclaw gateway run --dev
```

This regenerates `models.json` with fresh discovery.

## How to Verify It's Using YOUR Subscription

### Test 1: Subscription-Specific Model Access

If you have **Business/Enterprise**, test a model not available in Individual:

```bash
# This should work if you have Business/Enterprise
openclaw agent --model github-copilot/claude-sonnet-4.5 --message "test"

# This should fail if you only have Individual
# (Claude models typically not in Individual plans)
```

### Test 2: Usage Attribution

**Check Copilot dashboard**:
1. Visit https://github.com/settings/copilot
2. Go to "Usage" tab
3. Send messages via OpenClaw
4. Refresh usage page

Expected: Your usage should increment, confirming requests are attributed to your subscription.

### Test 3: Rate Limits

Your subscription's rate limits should apply:

```bash
# Send multiple rapid requests
for i in {1..10}; do
  openclaw agent --message "test $i" &
done
wait
```

If you hit rate limits, the error should match your subscription tier's limits (not shared/global limits).

## Advanced Verification: Raw SDK Test

Create a test script to directly verify SDK behavior:

```typescript
// test-copilot-sdk.ts
import { CopilotClient } from "@github/copilot-sdk";

async function testSubscription() {
  const githubToken = process.env.GITHUB_TOKEN!;
  const client = new CopilotClient({
    githubToken,
    autoStart: true,
    useLoggedInUser: false,
  });

  await client.start();

  // Get auth status
  const authStatus = await client.getAuthStatus();
  console.log("Auth Status:", authStatus);

  // List models
  const models = await client.listModels();
  console.log(`\nDiscovered ${models.length} models:`);
  models.forEach(model => {
    console.log(`- ${model.id}: ${model.name}`);
    console.log(`  Context: ${model.capabilities?.limits?.max_context_window_tokens}`);
    console.log(`  Vision: ${model.capabilities?.supports?.vision}`);
  });

  await client.stop();
}

testSubscription().catch(console.error);
```

Run with:
```bash
GITHUB_TOKEN=$(gh auth token) npx tsx test-copilot-sdk.ts
```

Expected: Models listed should match your subscription exactly.

## Subscription Tier Differences

| Feature | Individual | Business | Enterprise |
|---------|-----------|----------|------------|
| GPT-4o | ✅ | ✅ | ✅ |
| GPT-4.1 | ✅ | ✅ | ✅ |
| o1-mini | ✅ | ✅ | ✅ |
| o1 | ❌ | ✅ | ✅ |
| o3-mini | ❌ | ✅ | ✅ |
| Claude Sonnet 4.5 | ❌ | ✅ | ✅ |
| Custom models | ❌ | ❌ | ✅ |

*Note: Model availability subject to change; verify with `gh api /user/copilot`*

## Frequently Asked Questions

**Q: Does OpenClaw share tokens with other users?**
A: No. Each OpenClaw installation uses its own GitHub token linked to your subscription.

**Q: Are discovered models cached?**
A: Yes, in `models.json`. Discovery runs when config changes or file is deleted. This is more efficient than querying on every request.

**Q: Can I override discovered models?**
A: Yes, you can add custom model definitions in `models.providers["github-copilot"].models` in your config. They merge with discovered models.

**Q: What if I upgrade my subscription?**
A: Delete `~/.openclaw/models.json` and restart. OpenClaw will rediscover models with your new tier's access.

**Q: Does this work offline?**
A: No. SDK discovery requires network access to GitHub's API. However, cached models in `models.json` work offline until stale.

## Summary

✅ **Verification checklist**:
- [ ] `gh copilot` CLI works with your account
- [ ] `openclaw models list` shows Copilot models
- [ ] `models.json` contains non-empty model array for github-copilot
- [ ] Model count matches your subscription tier
- [ ] Model capabilities (context, vision) are accurate
- [ ] Requests route through your subscription (check usage dashboard)
- [ ] Rate limits match your tier

If all checks pass, the SDK is correctly using models from **your** GitHub Copilot subscription. 🎉
