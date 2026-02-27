---
name: simulator-log-capturing
description: Captures and filters logs from iOS Simulator apps. Use when debugging simulator apps, streaming os_log, capturing print() output, or filtering app logs by subsystem.
---

# Simulator Log Capturing

Capture and filter logs from iOS Simulator apps using Apple's unified logging system.

## Contents

- [Quick Reference](#quick-reference)
- [Logging Method Visibility](#logging-method-visibility)
- [Streaming Logs](#streaming-logs)
- [Predicate Syntax](#predicate-syntax)
- [Adding Diagnostic Logging](#adding-diagnostic-logging)
- [PII Redaction](#pii-redaction)
- [Troubleshooting](#troubleshooting)

## Quick Reference

| Task                    | Command                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------ |
| **Stream by subsystem** | `xcrun simctl spawn booted log stream --predicate 'subsystem == "com.myapp"'`        |
| **Stream by message**   | `xcrun simctl spawn booted log stream --predicate 'eventMessage CONTAINS "keyword"'` |
| **Include debug level** | Add `--level debug`                                                                  |
| **Save to file**        | Append `> /tmp/logs.txt 2>&1`                                                        |
| **Background capture**  | Append `&` and save PID: `LOG_PID=$!`                                                |
| **print() fallback**    | `xcrun simctl launch --console-pty booted <bundle-id>`                               |

## Logging Method Visibility

| Method              | `log stream` | `--console-pty` | Console.app |
| ------------------- | :----------: | :-------------: | :---------: |
| `Logger` / `os_log` |   **Yes**    |       No        |   **Yes**   |
| `NSLog()`           |   **Yes**    |     **Yes**     |   **Yes**   |
| `print()`           |      No      |     **Yes**     |     No      |

**Always prefer `os.Logger` over `print()`.** Logger integrates with unified logging, is filterable by subsystem/category, has proper log levels, and supports privacy-aware interpolation.

## Streaming Logs

### By Subsystem (Recommended)

```bash
xcrun simctl spawn booted log stream --predicate 'subsystem == "com.yammer.imageQuality"'

# Include debug-level messages
xcrun simctl spawn booted log stream --level debug --predicate 'subsystem == "com.yammer.imageQuality"'
```

### By Message Content

```bash
xcrun simctl spawn booted log stream --predicate 'eventMessage CONTAINS "IMAGE_QUALITY_TEST"'
```

### Combined Filters

```bash
xcrun simctl spawn booted log stream --predicate 'subsystem == "com.yammer.imageQuality" AND eventMessage CONTAINS "dimensions"'
```

### Background Capture

```bash
xcrun simctl spawn booted log stream --level debug \
  --predicate 'subsystem == "com.yourapp.feature"' \
  > /tmp/logs.txt 2>&1 &
LOG_PID=$!

# ... interact with app ...

kill $LOG_PID
cat /tmp/logs.txt
```

### Capturing print() (Fallback)

If code uses `print()` and can't be changed:

```bash
xcrun simctl terminate booted com.yammer.YammerDev
xcrun simctl launch --console-pty booted com.yammer.YammerDev 2>&1 | tee /tmp/stdout.txt
```

This captures stdout/stderr only — not os_log output.

## Predicate Syntax

| Operator     | Example                                              |
| ------------ | ---------------------------------------------------- |
| `==`         | `subsystem == "com.myapp"`                           |
| `CONTAINS`   | `eventMessage CONTAINS "error"`                      |
| `BEGINSWITH` | `category BEGINSWITH "net"`                          |
| `AND` / `OR` | `subsystem == "com.myapp" AND category == "network"` |

**Fields:** `subsystem`, `category`, `process`, `eventMessage`, `eventType`

### Common Subsystems

| Subsystem               | Use For                                 |
| ----------------------- | --------------------------------------- |
| `com.apple.network`     | HTTP errors, timeouts, connectivity     |
| `com.apple.coredata`    | DB corruption, fetch issues, migrations |
| `com.apple.UIKit`       | Constraint issues, layout, lifecycle    |
| `com.apple.WebKit`      | JS errors, loading failures             |
| Custom (`com.yammer.*`) | App-specific diagnostics                |

## Adding Diagnostic Logging

```swift
import os

private static let logger = Logger(subsystem: "com.yourapp.feature", category: "diagnostics")

// In your method
Self.logger.info("Metric: value=\(value) size=\(size)")
Self.logger.debug("Debug: \(debugInfo)")
Self.logger.error("Failed: \(error.localizedDescription)")

// Privacy-aware interpolation (auto-redacted in release builds)
Self.logger.info("User: \(userId, privacy: .private)")
Self.logger.info("Public metric: \(value, privacy: .public)")
```

Remove diagnostic logging before committing (unless it's permanent telemetry).

## PII Redaction

Before sharing logs externally:

```bash
cat /tmp/logs.txt | \
  sed -E 's/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/[EMAIL]/g' | \
  sed -E 's/Bearer [a-zA-Z0-9._-]+/Bearer [REDACTED]/g' | \
  sed -E 's/token=[a-zA-Z0-9._-]+/token=[REDACTED]/g' | \
  sed -E 's/userId: [0-9]+/userId: [REDACTED]/g' \
  > /tmp/logs-redacted.txt
```

## Troubleshooting

| Issue                  | Fix                                      |
| ---------------------- | ---------------------------------------- |
| No output              | Verify subsystem/category spelling       |
| No output (debug logs) | Add `--level debug`                      |
| No output (print)      | Use Logger, or use `--console-pty`       |
| Too much output        | Add subsystem filter                     |
| App not logging        | Verify navigation triggers the code path |

## Verification

```bash
xcrun simctl spawn booted log stream --level debug \
  --predicate 'subsystem == "com.yammer.imageQuality"' &
LOG_PID=$!
sleep 2
# Trigger the code path, then:
kill $LOG_PID
```
