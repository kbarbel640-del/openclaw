---
name: simulator-navigating
description: Automates iOS Simulator interactions using AXe. Use when navigating simulator screens, inspecting UI state, tapping elements, scrolling, or verifying screen content.
---

# Simulator Navigating

UI automation for iOS Simulator using **AXe** (Accessibility eXplorer).

## Contents

- [Quick Reference](#quick-reference)
- [Core Rule](#core-rule)
- [Setup](#setup)
- [Command Reference](#command-reference)
- [Troubleshooting](#troubleshooting)
- **Reference Files:**
  - [references/patterns.md](references/patterns.md) - Reusable navigation patterns (wait, scroll-to, back nav)

## Quick Reference

| Task            | Command                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------- |
| Get UDID        | `xcrun simctl list devices booted -j \| jq -r '...'`                                        |
| Inspect screen  | `axe describe-ui --udid $UDID`                                                              |
| Tap by label    | `axe tap --label "Submit" --udid $UDID`                                                     |
| Tap by ID       | `axe tap --id "com.app.button" --udid $UDID`                                                |
| Tap coordinates | `axe tap -x 200 -y 400 --udid $UDID`                                                        |
| Scroll down     | `axe swipe --start-x 196 --start-y 639 --end-x 196 --end-y 213 --duration 0.5 --udid $UDID` |
| Type text       | `axe type "text" --udid $UDID`                                                              |
| Screenshot      | `xcrun simctl io $UDID screenshot /tmp/screen.png`                                          |

## Core Rule

> **Use `describe-ui` for ALL navigation. Screenshots are FORBIDDEN during navigation.**
>
> Each screenshot is 100-400KB (20-80x more than describe-ui). Taking 10 screenshots consumes 1-4MB of context and will break your session.

| Method        | Context Cost | Use For                                            |
| ------------- | ------------ | -------------------------------------------------- |
| `describe-ui` | ~5KB         | Navigation, verification, finding elements         |
| Screenshots   | 100-400KB    | **ONLY** final BEFORE/AFTER evidence (max 2 total) |

## Setup

### Prerequisites

AXe v1.2.1+ and jq required.

```bash
axe --version || { echo "MISSING: brew tap cameroncooke/axe && brew install axe"; }
```

### Get Booted Simulator UDID

```bash
UDID=$(xcrun simctl list devices booted -j | jq -r '.devices[][] | select(.state == "Booted") | .udid' | head -1)
```

### Screen Dimensions (logical points)

| Device            | Width x Height |
| ----------------- | -------------- |
| iPhone 16         | 393x852        |
| iPhone 16 Plus    | 430x932        |
| iPhone 16 Pro     | 402x874        |
| iPhone 16 Pro Max | 440x956        |
| iPhone SE (3rd)   | 375x667        |

Or extract: `axe describe-ui --udid $UDID 2>&1 | grep -v "objc" | jq '.[0].frame'`

### Authentication

See `/simulator-authenticating` for app login before navigation.

## Command Reference

### Describe UI (Inspect Screen)

```bash
# Full tree
axe describe-ui --udid $UDID 2>&1 | grep -v "objc"

# Find element by label
axe describe-ui --udid $UDID 2>&1 | grep -v "objc" | jq '[.[] | .. | objects | select(.AXLabel == "Settings")]'

# List all tappable elements
axe describe-ui --udid $UDID 2>&1 | grep -v "objc" | jq '[.[] | .. | objects | select(.AXLabel and .enabled == true) | {label: .AXLabel, id: .AXUniqueId, frame: .frame}]'

# Check if element exists
axe describe-ui --udid $UDID 2>&1 | grep -q '"AXLabel":"Submit"' && echo "Found" || echo "Not found"
```

### Tap

Priority: `--id` > `--label` > coordinates.

```bash
axe tap --id "com.app.submitButton" --udid $UDID          # Best: by ID
axe tap --label "Submit" --udid $UDID                      # Good: by label
axe tap -x 200 -y 400 --udid $UDID                        # Fallback: coordinates
axe tap --label "Next" --pre-delay 0.3 --post-delay 0.5 --udid $UDID  # With delays
```

### Scrolling

> `axe gesture scroll-down/scroll-up` presets are broken in AXe v1.2.1 — they exit 0 but silently fail. Use `axe swipe` instead.

```bash
SCREEN_WIDTH=393; SCREEN_HEIGHT=852; CENTER_X=$((SCREEN_WIDTH / 2))

# Scroll down
axe swipe --start-x $CENTER_X --start-y $((SCREEN_HEIGHT * 3/4)) --end-x $CENTER_X --end-y $((SCREEN_HEIGHT / 4)) --duration 0.5 --udid $UDID

# Scroll up (start at H*2/5 to avoid Notification Center)
axe swipe --start-x $CENTER_X --start-y $((SCREEN_HEIGHT * 2/5)) --end-x $CENTER_X --end-y $((SCREEN_HEIGHT * 3/4)) --duration 0.5 --udid $UDID

# Edge swipes (these gesture presets DO work)
axe gesture swipe-from-left-edge --screen-width $SCREEN_WIDTH --screen-height $SCREEN_HEIGHT --udid $UDID
```

### Type Text

```bash
axe tap --label "Search" --udid $UDID   # Focus field first
sleep 0.3
axe type "your search text" --udid $UDID
```

### Hardware Buttons

```bash
axe button home --udid $UDID
axe button lock --udid $UDID
```

### Screenshots (Evidence Only)

```bash
# JPEG for PR attachments (small)
xcrun simctl io $UDID screenshot /tmp/screen.png && \
  sips -Z 1024 -s format jpeg -s formatOptions 80 /tmp/screen.png --out /tmp/screen.jpg && \
  rm /tmp/screen.png

# PNG for high quality
xcrun simctl io $UDID screenshot /tmp/screen.png && \
  sips -Z 1568 /tmp/screen.png --out /tmp/screen_resized.png
```

### Status Bar Normalization

Before taking PR screenshots:

```bash
xcrun simctl status_bar booted override \
  --time "9:41" --batteryState charged --batteryLevel 100 \
  --cellularMode active --cellularBars 4

xcrun simctl io booted screenshot /tmp/screen.png
xcrun simctl status_bar booted clear
```

## Tool Responsibilities

| Task                           | Tool                         |
| ------------------------------ | ---------------------------- |
| Boot/shutdown, install, launch | `xcrun simctl`               |
| Light/dark mode                | `xcrun simctl ui appearance` |
| Privacy permissions            | `xcrun simctl privacy`       |
| **UI inspection**              | **`axe describe-ui`**        |
| **Taps**                       | **`axe tap`**                |
| **Scrolling/swipes**           | **`axe swipe`**              |
| **Text input**                 | **`axe type`**               |
| Screenshots                    | `xcrun simctl io screenshot` |

## Troubleshooting

| Issue                      | Fix                                                                        |
| -------------------------- | -------------------------------------------------------------------------- |
| Element not found by label | Check exact spelling: `jq '.. \| .AXLabel? // empty' \| sort -u`           |
| Element off-screen         | Scroll first, then retry                                                   |
| Element hasn't loaded      | Use `wait_for_element` pattern (see [patterns.md](references/patterns.md)) |
| Tap has no effect          | Add `--pre-delay 0.5` for animations                                       |
| Tap hits wrong element     | Use `--id` instead of `--label`                                            |
| Back gesture doesn't work  | Tap back button at `(40, 70)` instead                                      |
| objc warnings in output    | Filter: `2>&1 \| grep -v "objc"`                                           |

## Verification

1. `echo $UDID` shows valid device identifier
2. `axe describe-ui --udid $UDID | grep -q "ExpectedLabel"` finds target
3. Run `describe-ui` after tap to confirm screen changed
