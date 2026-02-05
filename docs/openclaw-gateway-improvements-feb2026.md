# OpenClaw Gateway Improvements - Feb 2026

**Date:** February 6, 2026
**Status:** ✅ All fixes deployed and working

## 🎯 Goals Achieved

1. ✅ Fix watchdog threshold issues (FD leaks causing constant restarts)
2. ✅ Resolve EBADF errors in WebSocket connections
3. ✅ Restore v17-style session completion notifications
4. ✅ Auto-notify main agent on Claude Code task completions with smart context

---

## 🐛 Problems Fixed

### 1. File Descriptor (FD) Leaks - Gateway Restart Loop

**Symptom:**

- Gateway hitting FD count of 1640 (threshold: 1000)
- Constant watchdog-triggered restarts
- EBADF (Error Bad File Descriptor) errors not being retried

**Root Cause:**

- HTTP download requests lacking timeouts → hanging connections
- EBADF errors not in retry pattern → immediate failures
- Leaked file descriptors not cleaned up properly

**Fix Location:** `src/media/store.ts:98-167`

**Changes Made:**

```typescript
// Added 30-second timeout to prevent hanging connections
req.setTimeout(30000, () => {
  req.destroy(new Error("Download timeout after 30s"));
});

// Added req.destroy() in ALL error paths:
// - Redirect handlers (lines 118, 123, 128)
// - Error handler (line 160)
// - Timeout handler (lines 164-166)
```

**Impact:** FD leaks eliminated, gateway stays stable ✅

---

### 2. EBADF Retry Handling

**Symptom:**

- EBADF errors causing immediate message delivery failures
- No retry attempts for bad file descriptors

**Root Cause:**

- Retry regex pattern didn't include EBADF errors
- Pattern only matched: `closed|reset|timed\s*out|disconnect`

**Fix Location:** `src/web/auto-reply/deliver-reply.ts:49`

**Changes Made:**

```typescript
// Before:
const shouldRetry = /closed|reset|timed\s*out|disconnect/i.test(errText);

// After:
const shouldRetry = /closed|reset|timed\s*out|disconnect|EBADF/i.test(errText);
```

**Impact:** EBADF errors now retry 3x with backoff instead of immediate failure ✅

---

## 🔔 Notification System Improvements

### 3. Cron Job → Main Agent Notifications

**Goal:** Restore v17 behavior where isolated cron completions trigger main agent responses (not just passive system events)

**Solution:** Use `channel=last` to deliver messages as user input

**Implementation:**

- Modified cron job payloads to send dual messages:
  1. Direct to Telegram: `channel=telegram, target=526579497`
  2. To main session for agent response: `channel=last`

**Example Payload:**

```json
{
  "message": "Read Syukur List... pick ONE random item.\n\nThen send it TWICE:\n1. Direct to Telegram: message tool action=send, channel=telegram, target=526579497\n2. To main session for agent response: message tool action=send, channel=last, message='Cron: Random Syukur reminder sent - [brief summary]. Feel free to reflect on this blessing!'"
}
```

**Impact:** Isolated cron jobs now trigger active main agent engagement ✅

---

### 4. Claude Code Completion Hook with Smart Context

**Goal:** Auto-notify main agent when Claude Code tasks complete, with intelligent context detection

**Components Created:**

#### A. Hooks API Integration

**File:** `~/.openclaw/openclaw.json`

```json
{
  "hooks": {
    "enabled": true,
    "token": "02a7a029857a8149b98490c66e337cc0c202d4ce63b55c83752f9d7645126587"
  }
}
```

#### B. Smart Notification Script

**File:** `~/clawd/scripts/notify-main-agent-smart.sh`

**Auto-detects:**

- 📁 Current working directory
- 📝 Git changes (modified/staged files)
- 📌 Recent commits (last 5 minutes)
- 📄 Recently modified files (for non-git projects)

**Sample Output:**

```
✅ Claude Code session completed

📁 Dir: /Users/bagusyuliono/repos/clawdbot

📝 Git changes:
M  src/web/auto-reply/deliver-reply.ts
M  src/media/store.ts

What was accomplished in this session?
```

#### C. Claude Code Stop Hook

**File:** `~/.claude/settings.json`

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "~/clawd/scripts/notify-main-agent-smart.sh",
            "async": true,
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

**Behavior:**

- Fires on every Claude Code response completion
- Works across ALL Claude Code sessions (global config)
- Non-blocking execution (async: true)
- Main agent receives notification in Telegram
- Main agent actively responds with follow-up questions

**Impact:** Full v17-style workflow restored for all Claude Code tasks ✅

---

## 🔧 Technical Implementation Details

### Webhook Endpoint

```bash
POST http://localhost:18789/hooks/agent
Headers:
  x-openclaw-token: <hook_token>
  Content-Type: application/json

Body:
{
  "message": "<notification message>",
  "name": "Claude Code Completion",
  "sessionKey": "main",
  "deliver": true,
  "channel": "last"
}
```

**Key Parameters:**

- `sessionKey: "main"` - Routes to main agent session
- `deliver: true` - Ensures immediate delivery
- `channel: "last"` - Sends as user message (triggers agent response)

---

## 📊 Results

### Before

- ❌ Gateway restarting every few minutes
- ❌ EBADF errors causing message failures
- ❌ FD count climbing to 1640+
- ❌ No task completion notifications
- ❌ Isolated sessions completely disconnected

### After

- ✅ Gateway stable, no watchdog restarts
- ✅ EBADF errors retry gracefully
- ✅ FD count stays under threshold
- ✅ Smart notifications on every Claude Code completion
- ✅ Main agent actively engages with task results
- ✅ Full context awareness (directory, files, changes)

---

## 🚀 Usage

### Manual Notification (any script/task)

```bash
~/clawd/scripts/notify-main-agent-smart.sh
```

### Claude Code Sessions

- **Automatic** - No action needed
- Hook fires on every response completion
- Works in any directory, any project
- Main agent receives notification in Telegram

### Reload Hook Config

If you edit `~/.claude/settings.json` while Claude Code is running:

```
/hooks
```

Or restart Claude Code session.

---

## 📝 Files Modified

### OpenClaw Source

1. `src/web/auto-reply/deliver-reply.ts:49` - EBADF retry pattern
2. `src/media/store.ts:98-167` - HTTP timeout & cleanup

### Configuration

3. `~/.openclaw/openclaw.json` - Hooks enabled + token
4. `~/.claude/settings.json` - Stop hook configuration

### Scripts Created

5. `~/clawd/scripts/notify-main-agent.sh` - Basic notification
6. `~/clawd/scripts/notify-main-agent-smart.sh` - Smart context detection
7. `~/clawd/scripts/work-session.sh` - Work session wrapper

### Cron Jobs

8. `~/.openclaw/cron/jobs.json` - Modified random-syukur-hourly payload

---

## 🎓 Lessons Learned

1. **File descriptor management is critical** - Always set timeouts on HTTP requests
2. **Error retry patterns must be comprehensive** - Include all transient errors (EBADF, etc.)
3. **channel=last vs isolation.postToMain** - Use channel=last to trigger agent responses
4. **Hook reload requirement** - Changes to settings.json need `/hooks` reload or session restart
5. **Smart context > generic notifications** - Auto-detecting git changes provides much better UX

---

## ✨ What's Next?

Potential future improvements:

- [ ] Extract actual task summary from Claude Code conversation
- [ ] Add more context detection (package.json changes, test results, etc.)
- [ ] Configurable notification levels (errors only, all completions, etc.)
- [ ] Integration with other tools (VS Code, Cursor, etc.)

---

**Last Updated:** February 6, 2026
**Tested & Verified:** ✅ Working perfectly in production
