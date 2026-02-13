# Message Hooks

Message hooks enable external commands to run before and after agent message processing. This is useful for:

- **Memory systems** (e.g., NIMA) - recall context before processing, capture after
- **Logging & analytics** - track messages and responses
- **Context injection** - inject data from external sources into the agent's system prompt
- **Integrations** - trigger external workflows on message events

## Configuration

Add `messageHooks` to your `hooks` config in `openclaw.yaml`:

```yaml
hooks:
  messageHooks:
    enabled: true
    maxHooks: 5 # Max hooks to run (default: 10)
    aggregateTimeoutMs: 10000 # Total time budget (default: 15000ms)
    allowedCommandPrefixes: # Optional security allowlist
      - "python3 /opt/hooks/"
    preMessage:
      - command: "python3 /opt/hooks/recall.py"
        timeout: 5000
        inject: true # Inject stdout into system prompt
      - command: "python3 /opt/hooks/log.py"
        passContext: true # Pass message context via stdin
    postMessage:
      - command: "python3 /opt/hooks/capture.py"
        passContext: true
```

## Hook Types

### Pre-Message Hooks

Run **before** the agent processes a message. Use cases:

- Recall relevant memories/context
- Load user preferences
- Inject external data

When `inject: true`, the hook's stdout is added to the agent's system prompt under `## Hook Context`.

### Post-Message Hooks

Run **after** the agent responds. Use cases:

- Capture conversation for memory
- Log analytics
- Trigger follow-up actions

Post-hooks receive the response text in the context JSON.

## Hook Execution

### Environment Variables

All hooks receive these environment variables:

| Variable                | Description                              |
| ----------------------- | ---------------------------------------- |
| `OPENCLAW_SESSION_KEY`  | Current session key                      |
| `OPENCLAW_CHANNEL`      | Message channel (telegram, signal, etc.) |
| `OPENCLAW_SENDER_ID`    | Sender's ID                              |
| `OPENCLAW_SENDER_NAME`  | Sender's display name                    |
| `OPENCLAW_MESSAGE_TEXT` | The message text                         |
| `OPENCLAW_IS_GROUP`     | "1" if group chat, "0" if direct         |

### Context JSON (stdin)

When `passContext: true`, hooks receive JSON via stdin:

```json
{
  "sessionKey": "main:user123",
  "channel": "telegram",
  "senderId": "user123",
  "senderName": "John",
  "messageText": "Hello!",
  "messageId": "msg_abc123",
  "timestamp": 1707840000000,
  "isGroup": false,
  "groupId": null,
  "groupName": null,
  "responseText": "Hi there!",
  "responseId": "resp_xyz789"
}
```

Note: `responseText` and `responseId` are only present in post-message hooks.

### Filtering

Hooks can be filtered by session key prefix or channel:

```yaml
preMessage:
  - command: "python3 /opt/hooks/vip-recall.py"
    sessionKeyPrefixes: ["vip-"]
    channels: ["telegram", "signal"]
```

## Resource Limits

| Limit             | Default | Max     |
| ----------------- | ------- | ------- |
| Per-hook timeout  | 5000ms  | 30000ms |
| Aggregate timeout | 15000ms | 60000ms |
| Max hooks         | 10      | 10      |
| Stdout capture    | 64KB    | 64KB    |
| Stderr capture    | 16KB    | 16KB    |

## Security

⚠️ **IMPORTANT**: Hook commands execute with OpenClaw's privileges. Only configure hooks you trust completely.

### Security Best Practices

1. **Use `allowedCommandPrefixes`** to restrict which commands can run:

   ```yaml
   allowedCommandPrefixes:
     - "python3 /opt/hooks/"
     - "/usr/local/bin/my-hook"
   ```

2. **Don't log/expose environment variables** - they contain message content

3. **Validate input** in your hook scripts - never trust stdin blindly

4. **Use absolute paths** for commands to prevent PATH injection

5. **Run hooks in isolated environments** when possible

### Injected Context Security

When `inject: true`, hook stdout becomes part of the AI's context. Ensure your hooks:

- Sanitize any external data before outputting
- Don't include sensitive information in output
- Handle errors gracefully (don't leak stack traces)

## Example: NIMA Memory Integration

### Pre-message hook (recall.py)

```python
#!/usr/bin/env python3
import os
import sys
import subprocess

session_key = os.environ.get('OPENCLAW_SESSION_KEY', '')
message = os.environ.get('OPENCLAW_MESSAGE_TEXT', '')

# Query NIMA for relevant memories
result = subprocess.run(
    ['python3', '/path/to/nima/quick_recall.py', message, '--top', '3', '--compact'],
    capture_output=True,
    text=True,
    timeout=3
)

if result.returncode == 0 and result.stdout.strip():
    print(result.stdout.strip())
```

### Post-message hook (capture.py)

```python
#!/usr/bin/env python3
import os
import sys
import json
import subprocess

# Read context from stdin
context = json.load(sys.stdin)

session_key = context.get('sessionKey', 'unknown')
sender = context.get('senderName', 'Unknown')
message = context.get('messageText', '')
response = context.get('responseText', '')

# Capture to NIMA
if message and response:
    subprocess.run([
        'python3', '/path/to/nima/capture.py',
        sender,
        f"Said: {message}",
        '--importance', '0.5'
    ], timeout=3)
```

## Debugging

Check OpenClaw logs for hook execution details:

```
dispatch-from-config: post-message hooks failed: ...
```

To see hook stdout/stderr, run hooks manually:

```bash
OPENCLAW_SESSION_KEY=test \
OPENCLAW_MESSAGE_TEXT="Hello" \
python3 /opt/hooks/recall.py
```
