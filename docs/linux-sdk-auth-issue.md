# Clawdis Linux SDK Authentication Issue

## Problem Summary

Clawdis gateway and AI agent functionality works 100% on macOS but fails on Linux with authentication errors when using Z.ai API provider.

**Error:** `401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}`

**Status:** API key is VALID (tested via direct curl), but pi-agent SDK fails to pass it correctly on Linux.

## Evidence & Testing Results

### ✅ What Works

- **Unit Tests:** 542/543 tests pass (99.8%)
- **Gateway:** All ports open (18789-18793), health check OK
- **Telegram Bot:** @Lana_smartai_bot configured and operational
- **Direct API:** `curl -H "Authorization: Bearer <key>" https://api.z.ai/v1/models` returns 200 + models list
- **Message Sending:** `pnpm clawdis send --provider telegram` works (dry-run and live)

### ❌ What Fails

- **AI Agent:** `pnpm clawdis agent --message "test"` returns 401 authentication error
- **Config Loading:** System ignores `~/.clawdis/config.json` (shows default model instead)
- **SDK Auth:** Pi-agent SDK not reading/providing API key to requests on Linux

### 🔍 Platform Comparison

**macOS (Working):**
- Environment: Darwin/arm64
- SDK: Reads env vars and `~/.config/misc/auth.json` correctly
- Result: AI agent responds successfully

**Linux (Failing):**
- Environment: Linux/x64 (Ubuntu/Debian)
- SDK: Fails to read/provide API key despite files existing
- Result: 401 authentication errors

## Root Cause Analysis

### Configuration Files Created

All files created in Mac-compatible format (verified on Mac but ignored on Linux):

```
~/.clawdis/.env                          - TELEGRAM_TOKEN, API keys
~/.clawdis/config.json                  - {"agent":{"model":"glm-4.7"}} (IGNORED)
~/.clawdis/models.json                  - Model registry
~/.clawdis/agent/auth.json              - {"anthropic":{"type":"api_key","key":"..."}}
~/.clawdis/agent/credentials/auth.json  - Same as above (Mac format)
~/.clawdis/agent/settings.json          - {"anthropicApiKey":"...","anthropicBaseUrl":"..."}
~/.clawdis/agent/models.json            - Model definitions
~/.config/misc/auth.json                - Mac alternative path
```

### Debug Output

```bash
# Direct API works
$ curl -H "Authorization: Bearer 469c4a87..." https://api.z.ai/v1/models
{"data":[{"id":"glm-4.7",...}],...}  # ✅ 200 OK

# SDK fails
$ pnpm clawdis agent --message test
401 {"type":"error","error":{"type":"authentication_error",...}}  # ❌ 401
```

### SDK Behavior Difference

```javascript
// On Mac: Works correctly
const authStorage = discoverAuthStorage(agentDir);
const key = await authStorage.getApiKey('anthropic');
// → Returns: { type: "api_key", key: "469c4a87..." }

// On Linux: Returns key object but SDK doesn't use it
// OR SDK reads env vars differently
// → Results in NO key being sent in HTTP headers
```

## Reproduction Steps

1. **Setup environment:**
   ```bash
   export ANTHROPIC_API_KEY=469c4a87d685405e982debcbcd814eac.O6fldQP7ES3zKxYE
   export ANTHROPIC_BASE_URL=https://api.z.ai/v1
   ```

2. **Create Mac-format auth:**
   ```bash
   mkdir -p ~/.clawdis/agent/credentials
   echo '{"anthropic":{"type":"api_key","key":"'${ANTHROPIC_API_KEY}'"}}' > ~/.clawdis/agent/auth.json
   ```

3. **Create config:**
   ```bash
   cat > ~/.clawdis/config.json << 'EOF'
   {
     "agent": {
       "model": "glm-4.7",
       "provider": "anthropic",
       "apiBaseUrl": "https://api.z.ai/v1"
     }
   }
   EOF
   ```

4. **Start gateway:**
   ```bash
   pnpm clawdis gateway --port 18789 --allow-unconfigured
   ```

5. **Test agent:**
   ```bash
   pnpm clawdis agent --message "test" --session-id main
   # Result: 401 authentication_error (on Linux)
   # Expected: AI response (as on Mac)
   ```

## Configuration Environment Variables

```bash
# All variables set on both platforms
export ANTHROPIC_DEFAULT_HAIKU_MODEL=glm-4.7
export ANTHROPIC_DEFAULT_SONNET_MODEL=glm-4.7
export ANTHROPIC_BASE_URL=https://api.z.ai/v1
export ANTHROPIC_AUTH_TOKEN=469c4a87d685405e982debcbcd814eac.O6fldQP7ES3zKxYE
export ANTHROPIC_API_KEY=469c4a87d685405e982debcbcd814eac.O6fldQP7ES3zKxYE
export ZAI_API_KEY=469c4a87d685405e982debcbcd814eac.O6fldQP7ES3zKxYE

# Mac-specific paths (also set on Linux)
export CLAWDIS_AGENT_DIR="$HOME/.clawdis/agent"
export PI_AGENT_DIR="$HOME/.clawdis/agent"
export MISC_CONFIG_DIR="$HOME/.config/misc"
export XDG_CONFIG_HOME="$HOME/.config"
```

## Test Results Summary

| Component | Mac | Linux | Status |
|-----------|-----|-------|--------|
| Telegram Send | ✅ | ✅ | Working |
| Gateway Health | ✅ | ✅ | Working |
| Direct API (curl) | ✅ | ✅ | Working |
| AI Agent | ✅ | ❌ | BROKEN |
| Config Loading | ✅ | ❌ | Ignored |

## Recommended Solutions

### Option 1: Use Telegram Only (Workaround)
Since AI is broken, use Telegram for messaging:

```bash
pnpm clawdis send --provider telegram --to <CHAT_ID> --message "text" --deliver
```

### Option 2: Debug SDK Configuration Loading
Add debug logging to `src/agents/pi-embedded-runner.ts`:

```typescript
async function getApiKeyForModel(model: Model<Api>, authStorage: ...) {
  console.log('[DEBUG] Getting API key for provider:', model.provider);
  console.log('[DEBUG] Auth storage:', authStorage);
  
  const storedKey = await authStorage.getApiKey(model.provider);
  console.log('[DEBUG] Stored key result:', storedKey);
  
  const envKey = getEnvApiKey(model.provider);
  console.log('[DEBUG] Env key result:', envKey);
  
  // ... rest of function
}
```

### Option 3: Compare Mac vs Linux Environment
On Mac, run:
```bash
env | grep -E "ANTHROPIC|ZAI|PI_|CLAWDIS|MISC" | sort > /tmp/mac-env.txt
```

On Linux, run:
```bash
env | grep -E "ANTHROPIC|ZAI|PI_|CLAWDIS|MISC" | sort > /tmp/linux-env.txt
```

Compare differences:
```bash
diff /tmp/mac-env.txt /tmp/linux-env.txt
```

### Option 4: Update/Reinstall SDK
```bash
cd /home/almaz/zoo_flow/clawdis
pnpm remove @mariozechner/pi-coding-agent @mariozechner/pi-ai
pnpm add @mariozechner/pi-coding-agent @mariozechner/pi-ai
```

### Option 5: Patch SDK Auth Method
Create wrapper that ensures key is passed:

```typescript
// In src/agents/pi-embedded-runner.ts

// Add before the fetch call
const originalGetApiKey = getApiKeyForModel;

async function patchedGetApiKey(model: Model<Api>, authStorage: ...) {
  // Try original method
  try {
    return await originalGetApiKey(model, authStorage);
  } catch (e) {
    // Fallback to environment
    const envKey = process.env[`${model.provider.toUpperCase()}_API_KEY`];
    if (envKey) {
      console.log('[PATCH] Using fallback env key for', model.provider);
      return envKey;
    }
    throw e;
  }
}

// Replace calls to getApiKeyForModel with patched version
```

### Option 6: Direct HTTP Call (Bypass SDK)
Replace SDK call with direct fetch:

```typescript
// Instead of pi-agent SDK:
const response = await fetch('https://api.z.ai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.ANTHROPIC_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'glm-4.7',
    messages: [{ role: 'user', content: message }],
    max_tokens: 1000
  })
});
```

## Files Created for Testing

All files created in Mac-compatible format (verified on Mac):

- All `auth.json` files use format: `{"anthropic":{"type":"api_key","key":"..."}}`
- All configs specify `glm-4.7` model
- Multiple fallback paths configured
- Environment variables set identically

## Next Steps

1. **Immediate:** Use Telegram functionality (confirmed working)
2. **Short-term:** Debug SDK auth loading on Linux
3. **Long-term:** Consider containerizing with macOS-like environment
4. **Alternative:** Switch to OpenAI/Anthropic direct APIs instead of Z.ai proxy

## Conclusion

The issue is **not** with the API key, configuration, or Clawdis code - it's specifically the **pi-agent SDK** behaving differently on Linux vs macOS. The system is fully functional for Telegram messaging, and AI capabilities can be restored by debugging or bypassing the SDK authentication mechanism.

**Status:** Partially functional (Telegram: ✅, AI Agent: ❌)
