# Startup and Health Contract

## Startup Validation

The Gateway must validate prerequisites before accepting connections.

### Validation Steps (in order)

1. **Write models.json**
   - Trigger provider discovery
   - Write discovered providers to `~/.clawdbot/agents/<id>/models.json`
   - If this fails: startup fails

2. **Resolve default model**
   - Read `agents.defaults.model.primary` from config
   - Parse provider/model reference
   - If not configured: use `DEFAULT_PROVIDER/DEFAULT_MODEL`

3. **Resolve model from registry**
   - Look up model in pi-ai catalog or models.json
   - If not found: startup fails with "Unknown model"

4. **Check context window**
   - Model must have `contextWindow >= 16000`
   - If too small: startup fails with "context window too small"

5. **Verify auth**
   - Call `getApiKeyForModel` with resolved model
   - Auth is satisfied if:
     - `mode === "none"` (local provider)
     - `mode === "aws-sdk"` (IAM credentials)
     - `apiKey` exists (API key auth)
   - If not satisfied: startup fails with auth error

### Startup Success

If all validations pass:
```
Health: OK (provider=ollama, model=llama3:chat, ctx=32768, authMode=none)
```

### Startup Failure

If any validation fails:
```
Gateway startup validation failed: [error message]
  Configured model: provider/model

Suggestions:
  - [actionable suggestion 1]
  - [actionable suggestion 2]
```

The Gateway throws an error and does NOT start listening.

## Skip Validation (Testing Only)

Set `CLAWDBOT_SKIP_STARTUP_VALIDATION=1` to skip validation.

**CRITICAL: This env var is a loaded gun.**

**Hardening requirements (TODO if not already done):**
1. Only honor the skip when `NODE_ENV === "test"`
2. Or when `--test` flag is explicitly passed
3. Log a loud warning if skip is honored: `⚠️ STARTUP VALIDATION SKIPPED - NOT FOR PRODUCTION`
4. CI must run at least one test with validation ENABLED to catch regressions

**Why this matters:**
- Skip env vars undermine the fail-fast contract
- If health says "OK" but validation was skipped, we're lying
- Someone will "temporarily" export it and forget

**Only use for:**
- Unit tests that don't need real models
- Integration tests with mocked providers

**Never use for:**
- Production deployments
- Development with real users
- Any environment where real users send messages

**Current implementation status:**
- [x] Skip env var exists
- [x] Test helpers set it automatically
- [x] Guard: warns loudly if used outside NODE_ENV=test
- [ ] CI: at least one validated startup test (TODO)

## Health Check

After startup, health can be queried via:
- WebSocket: `req:health` method
- HTTP: `GET /health`

Health response includes:
- Gateway status
- Channel connection status
- Model availability

## Checklist: Before Accepting Connections

Human-readable checklist:

- [ ] Config loaded successfully
- [ ] models.json written (discovery complete)
- [ ] Default model resolved from config
- [ ] Model exists in registry
- [ ] Context window >= 16000 tokens
- [ ] Auth satisfied for model's provider
- [ ] Gateway listening on configured port

## Error Messages and Remediation

### "Unknown model"

**Cause:** Model not in registry or models.json

**Remediation:**
```bash
# For Ollama
ollama serve
ollama pull llama3:chat

# For hosted
moltbot models list --all
moltbot config set agents.defaults.model.primary <available-model>
```

### "Context window too small"

**Cause:** Model has fewer than 16000 tokens context

**Remediation:**
```bash
# Check model context
ollama show llama3:chat

# Use a larger model
moltbot config set agents.defaults.model.primary ollama/llama3.1:32k
```

### "No API key found for provider"

**Cause:** Auth not configured for non-local provider

**Remediation:**
```bash
# For Anthropic
export ANTHROPIC_API_KEY=your-key

# For Moonshot
export MOONSHOT_API_KEY=your-key

# Or use local model
moltbot config set agents.defaults.model.primary ollama/llama3:chat
```

### "Auth validation failed"

**Cause:** Auth resolution threw an error

**Remediation:**
```bash
# Check auth store
cat ~/.clawdbot/agents/main/agent/auth-profiles.json

# Re-configure auth
moltbot onboard
```

## Invariants (Do Not Break)

1. **Never accept connections if agent cannot respond**
   - Validation must run before `listen()`
   - Failure must prevent startup, not just log

2. **Validation must match runtime behavior**
   - If validation passes, first message must not fail on auth
   - If validation fails, error must be actionable

3. **Error messages must include remediation**
   - Don't just say "failed"
   - Say what to do to fix it

4. **Health check must reflect reality**
   - If health says OK, agent must work
   - If agent doesn't work, health must not say OK
