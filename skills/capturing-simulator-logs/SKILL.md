---
name: capturing-simulator-logs
description: Captures and filters logs from iOS Simulator apps. Use when debugging simulator apps, capturing print() output, streaming os_log, or filtering app logs.
---

# Simulator Logging

## Contents

- [Quick Reference](#quick-reference)
- [Recommended: Using os.Logger](#recommended-using-oslogger)
- [Logging Method Visibility](#logging-method-visibility)
- [Streaming Logs](#streaming-logs)
- [Predicate Syntax](#predicate-syntax)
- [Adding Diagnostic Logging](#adding-diagnostic-logging)
- [Troubleshooting](#troubleshooting)

## XcodeBuildMCP Wrappers

When XcodeBuildMCP MCP server is connected, it provides convenience wrappers for log capture:

- `mcp__XcodeBuildMCP__start_sim_log_cap` — start streaming logs by bundle id
- `mcp__XcodeBuildMCP__stop_sim_log_cap` — stop and return captured logs

These wrap the same `xcrun simctl spawn booted log stream` commands below. Use the direct commands when XcodeBuildMCP is unavailable or when you need full predicate control.

## Quick Reference

| Task                    | Command                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------- |
| **Stream by subsystem** | `xcrun simctl spawn booted log stream --predicate 'subsystem == "com.myapp.feature"'` |
| **Stream by message**   | `xcrun simctl spawn booted log stream --predicate 'eventMessage CONTAINS "keyword"'`  |
| **Include debug level** | Add `--level debug`                                                                   |
| **Save to file**        | Append `> /tmp/logs.txt 2>&1`                                                         |
| **print() fallback**    | `xcrun simctl launch --console-pty booted <bundle-id>`                                |

## Recommended: Using os.Logger

**Always prefer `os.Logger` over `print()` for diagnostic logging.**

```swift
import os

// Create a logger with subsystem and category
private static let logger = Logger(subsystem: "com.myapp.feature", category: "diagnostics")

// Log with appropriate level
logger.info("Processing item: \(itemId)")
logger.debug("Debug details: \(debugInfo)")
logger.error("Failed with error: \(error.localizedDescription)")
```

**Why Logger over print():**

- Integrates with Apple's unified logging system
- Captured by `log stream` without special flags
- Filterable by subsystem/category
- Proper log levels (debug, info, error, fault)
- Privacy-aware string interpolation
- Performance optimized (lazy evaluation)

## Logging Method Visibility

| Method              | `log stream` | `--console-pty` | Console.app |
| ------------------- | :----------: | :-------------: | :---------: |
| `Logger` / `os_log` |   **Yes**    |       No        |   **Yes**   |
| `NSLog()`           |   **Yes**    |     **Yes**     |   **Yes**   |
| `print()`           |      No      |     **Yes**     |     No      |

**Key insight:** `print()` only goes to stdout. Use `os.Logger` for proper log integration.

## Streaming Logs

### By Subsystem (Recommended)

```bash
# Stream logs from your custom subsystem
xcrun simctl spawn booted log stream --predicate 'subsystem == "com.yammer.imageQuality"'

# Include debug-level messages
xcrun simctl spawn booted log stream --level debug --predicate 'subsystem == "com.yammer.imageQuality"'
```

### By Message Content

```bash
xcrun simctl spawn booted log stream --predicate 'eventMessage CONTAINS "IMAGE_QUALITY_TEST"'
```

### By Process

```bash
xcrun simctl spawn booted log stream --predicate 'process == "Yammer-Dev"'
```

### Combined Filters

```bash
xcrun simctl spawn booted log stream --predicate 'subsystem == "com.yammer.imageQuality" AND eventMessage CONTAINS "dimensions"'
```

## Predicate Syntax

| Operator     | Example                                              |
| ------------ | ---------------------------------------------------- |
| `==`         | `subsystem == "com.myapp"`                           |
| `CONTAINS`   | `eventMessage CONTAINS "error"`                      |
| `BEGINSWITH` | `category BEGINSWITH "net"`                          |
| `AND` / `OR` | `subsystem == "com.myapp" AND category == "network"` |

**Fields:** `subsystem`, `category`, `process`, `eventMessage`, `eventType`

## Common Subsystem Filters

| Subsystem                 | Use For                      | Example                      |
| ------------------------- | ---------------------------- | ---------------------------- |
| `com.apple.network`       | Network issues, connectivity | HTTP errors, timeouts        |
| `com.apple.coredata`      | CoreData crashes, migrations | DB corruption, fetch issues  |
| `com.apple.pushkit`       | Push notification debugging  | Token registration, delivery |
| `com.apple.UIKit`         | UI lifecycle, layout         | Constraint issues, crashes   |
| `com.apple.WebKit`        | WebView issues               | JS errors, loading failures  |
| `com.apple.CoreBluetooth` | Bluetooth issues             | Pairing, connectivity        |
| Custom (`com.yammer.*`)   | App-specific logging         | Feature diagnostics          |

```bash
# Network debugging
xcrun simctl spawn booted log stream --predicate 'subsystem == "com.apple.network"'

# CoreData issues
xcrun simctl spawn booted log stream --predicate 'subsystem == "com.apple.coredata"'

# Multiple subsystems
xcrun simctl spawn booted log stream --predicate 'subsystem BEGINSWITH "com.apple.network" OR subsystem == "com.yammer.api"'
```

## PII Redaction

**Before sharing logs externally**, redact sensitive data:

| PII Type   | Pattern              | Redaction            |
| ---------- | -------------------- | -------------------- |
| Email      | `\w+@\w+\.\w+`       | `[EMAIL]`            |
| Token      | `Bearer \w+`         | `Bearer [REDACTED]`  |
| User ID    | `userId: \d+`        | `userId: [REDACTED]` |
| Phone      | `\d{3}-\d{3}-\d{4}`  | `[PHONE]`            |
| IP Address | `\d+\.\d+\.\d+\.\d+` | `[IP]`               |

**Redaction script:**

```bash
# Redact common PII patterns before sharing
cat /tmp/logs.txt | \
  sed -E 's/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/[EMAIL]/g' | \
  sed -E 's/Bearer [a-zA-Z0-9._-]+/Bearer [REDACTED]/g' | \
  sed -E 's/token=[a-zA-Z0-9._-]+/token=[REDACTED]/g' | \
  sed -E 's/userId: [0-9]+/userId: [REDACTED]/g' \
  > /tmp/logs-redacted.txt
```

**Logger privacy (built-in):**

```swift
// Use .private for sensitive data - auto-redacted in release builds
logger.info("User: \(userId, privacy: .private)")
logger.info("Public metric: \(value, privacy: .public)")
```

## Adding Diagnostic Logging

### Step 1: Add Logger to Your Code

```swift
import os

// In your class/struct
private static let logger = Logger(
    subsystem: "com.yourapp.featureName",
    category: "diagnostics"
)

// In your method
Self.logger.info("Metric: value=\(value) size=\(size)")
```

### Step 2: Stream During Testing

```bash
# Start streaming before triggering the code path
xcrun simctl spawn booted log stream --level debug \
  --predicate 'subsystem == "com.yourapp.featureName"' \
  > /tmp/metrics.txt 2>&1 &
LOG_PID=$!

# ... trigger your code path in the app ...

# Stop streaming
kill $LOG_PID

# View results
cat /tmp/metrics.txt
```

### Step 3: Clean Up

Remove diagnostic logging before committing (unless it's permanent telemetry).

## Background Streaming

```bash
# Stream to file in background
xcrun simctl spawn booted log stream \
  --predicate 'subsystem == "com.yammer.imageQuality"' \
  > /tmp/logs.txt 2>&1 &
LOG_PID=$!

# ... interact with app ...

# Stop and view
kill $LOG_PID
cat /tmp/logs.txt
```

## Fallback: Capturing print()

If code already uses `print()` and can't be changed:

```bash
# Terminate app first
xcrun simctl terminate booted com.yammer.YammerDev

# Launch with console capture
xcrun simctl launch --console-pty booted com.yammer.YammerDev 2>&1 | tee /tmp/stdout.txt
```

**Note:** This captures stdout/stderr only - not os_log output.

## Troubleshooting

| Issue           | Cause             | Fix                                |
| --------------- | ----------------- | ---------------------------------- |
| No output       | Wrong predicate   | Verify subsystem/category spelling |
| No output       | Debug level       | Add `--level debug`                |
| No output       | Using print()     | Use Logger, or use `--console-pty` |
| Too much output | Broad predicate   | Add subsystem filter               |
| App not logging | Code path not hit | Verify navigation triggers logging |

## Verification

```bash
# Test that your logging works
xcrun simctl spawn booted log stream --level debug \
  --predicate 'subsystem == "com.yammer.imageQuality"' &
LOG_PID=$!
sleep 2

# Trigger the code path, then:
kill $LOG_PID
```

## Related Skills

- `/navigating-simulator` - UI automation with AXe for triggering code paths
- `/injecting-simulator-tokens` - Token injection before testing logged-in features
- `/reproducing-bugs` - Using logs for bug reproduction evidence
