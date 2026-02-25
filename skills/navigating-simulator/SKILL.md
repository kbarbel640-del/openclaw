---
name: navigating-simulator
description: Automates iOS Simulator interactions using AXe. Provides describe-ui inspection, tap-by-label/ID, scrolling, gestures, and text input. Use when navigating simulator screens, automating UI tests, or verifying screen state.
invocation: user
---

# Simulator Navigating

Reliable iOS Simulator UI automation using **AXe** (Accessibility eXplorer). Use for:

- Tap buttons, cells, or other UI elements
- Scroll, swipe, or perform gestures
- Type text into fields
- Verify what's on screen
- Navigate through an app

## Contents

- [Quick Reference](#quick-reference)
- [Core Principle](#core-principle-accessibility-first)
- [Prerequisites](#prerequisites)
- [Command Reference](#command-reference)
- [Navigation Patterns](#navigation-patterns)
- [Tool Responsibilities](#tool-responsibilities)
- [Troubleshooting](#troubleshooting)
- [When to Use Screenshots vs describe-ui](#when-to-use-screenshots-vs-describe-ui)

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

## Core Principle: NEVER Use Screenshots for Navigation

> **MANDATORY: Use `describe-ui` for ALL navigation. Screenshots are FORBIDDEN during navigation.**
>
> This is non-negotiable. Screenshots destroy context and make sessions fail.

| Method        | Context Cost | Use For                                            |
| ------------- | ------------ | -------------------------------------------------- |
| `describe-ui` | ~5KB         | **ALL navigation, verification, finding elements** |
| Screenshots   | 100-400KB    | **ONLY** final BEFORE/AFTER evidence for PRs       |

**Screenshots are 20-80x more expensive than describe-ui.** A navigation session with 10 screenshots consumes 1-4MB of context and will cause the session to fail.

```bash
# ✅ ALWAYS: Use describe-ui to understand the screen
axe describe-ui --udid $UDID 2>&1 | grep -v "objc"

# ❌ NEVER: Taking screenshots during navigation
xcrun simctl io $UDID screenshot /tmp/screen.png  # FORBIDDEN FOR NAVIGATION
```

**`describe-ui` gives you everything you need:**

- What elements exist (`AXLabel`, `AXUniqueId`)
- Where they are (`frame: {x, y, width, height}`)
- What type they are (`role`, `type`)
- Whether they're interactive (`enabled`)

## Prerequisites

### Tool Verification

Before using this skill, verify required tools are installed:

```bash
# AXe — UI automation (v1.2.1+ required)
axe --version || { echo "MISSING: install AXe"; }

# jq — JSON parsing for describe-ui output
jq --version || { echo "MISSING: brew install jq"; }

# 1Password CLI — credential retrieval for test accounts
op --version || { echo "MISSING: brew install --cask 1password-cli"; }

# Simulator tools (part of Xcode)
xcrun simctl list devices booted -j >/dev/null 2>&1 || { echo "MISSING: Xcode Command Line Tools"; }
```

### Install/Upgrade AXe (v1.2.1+ required)

```bash
brew tap cameroncooke/axe
brew install axe
# or upgrade
brew upgrade cameroncooke/axe/axe
```

### Get Booted Simulator UDID

```bash
UDID=$(xcrun simctl list devices booted -j | jq -r '.devices[][] | select(.state == "Booted") | .udid' | head -1)
echo "UDID: $UDID"
```

### Test Account (Engage & Teams)

Retrieve credentials from 1Password (never hardcode in skills or scripts):

```bash
EMAIL=$(op item get "Yammer iOS Test Account" --vault Agents --fields username)
PASS=$(op item get "Yammer iOS Test Account" --vault Agents --fields password)
```

**Login flow for Engage:**

```bash
axe tap --id "username_field" --udid $UDID
axe type "$EMAIL" --udid $UDID
axe tap --id "login_button" --post-delay 2 --udid $UDID
# Wait for password field, then enter password
axe type "$PASS" --udid $UDID
axe tap --label "Sign in" --post-delay 3 --udid $UDID
```

### App Authentication

See `/injecting-simulator-tokens` for full auth documentation:

| App                  | Method                                                |
| -------------------- | ----------------------------------------------------- |
| **YammerSDKDemoApp** | Token exchange + UserDefaults injection (recommended) |
| **Engage**           | UI login via AXe (token injection is broken)          |
| **Teams**            | UI login via AXe (no token injection path)            |

### Get Screen Dimensions

```bash
# Common dimensions (logical points, not pixels)
# iPhone 16: 393x852
# iPhone 16 Plus: 430x932
# iPhone 16 Pro: 402x874
# iPhone 16 Pro Max: 440x956
# iPhone SE (3rd): 375x667

# Or extract from describe-ui root element
axe describe-ui --udid $UDID 2>&1 | grep -v "objc" | jq '.[0].frame'
```

---

## Command Reference

### 1. Describe UI (Inspect Screen State)

**Use this to verify navigation, find elements, and understand the current screen.**

```bash
# Full accessibility tree
axe describe-ui --udid $UDID 2>&1 | grep -v "objc"

# Find specific element by label
axe describe-ui --udid $UDID 2>&1 | grep -v "objc" | jq '[.[] | .. | objects | select(.AXLabel == "Settings")]'

# List all tappable elements with labels
axe describe-ui --udid $UDID 2>&1 | grep -v "objc" | jq '[.[] | .. | objects | select(.AXLabel and .enabled == true) | {label: .AXLabel, id: .AXUniqueId, frame: .frame}]'

# Check if element exists (for verification)
axe describe-ui --udid $UDID 2>&1 | grep -q '"AXLabel":"Submit"' && echo "Found" || echo "Not found"
```

### 2. Tap (Primary Interaction)

**Priority order: `--id` > `--label` > coordinates**

```bash
# BEST: Tap by accessibility identifier (most stable)
axe tap --id "com.app.submitButton" --udid $UDID

# GOOD: Tap by accessibility label (what VoiceOver reads)
axe tap --label "Submit" --udid $UDID

# FALLBACK: Tap by coordinates (when id/label unavailable)
axe tap -x 200 -y 400 --udid $UDID

# With delays for animations
axe tap --label "Next" --pre-delay 0.3 --post-delay 0.5 --udid $UDID
```

### 3. Scrolling and Swipes

> **WARNING:** `axe gesture scroll-down/scroll-up` presets are broken in AXe v1.2.1 — they exit 0 but silently fail to scroll. Use `axe swipe` with explicit coordinates instead.

```bash
SCREEN_WIDTH=393   # iPhone 16 default; adjust for device
SCREEN_HEIGHT=852
CENTER_X=$((SCREEN_WIDTH / 2))

# Scroll down (to see more content below)
axe swipe --start-x $CENTER_X --start-y $((SCREEN_HEIGHT * 3/4)) --end-x $CENTER_X --end-y $((SCREEN_HEIGHT / 4)) --duration 0.5 --udid $UDID

# Scroll up (to see content above)
# NOTE: Start at H*2/5 (not H/4) to avoid triggering Notification Center
axe swipe --start-x $CENTER_X --start-y $((SCREEN_HEIGHT * 2/5)) --end-x $CENTER_X --end-y $((SCREEN_HEIGHT * 3/4)) --duration 0.5 --udid $UDID

# Horizontal scroll left (to see content to the right)
axe swipe --start-x $((SCREEN_WIDTH * 3/4)) --start-y $((SCREEN_HEIGHT / 2)) --end-x $((SCREEN_WIDTH / 4)) --end-y $((SCREEN_HEIGHT / 2)) --duration 0.5 --udid $UDID

# Horizontal scroll right (to see content to the left)
axe swipe --start-x $((SCREEN_WIDTH / 4)) --start-y $((SCREEN_HEIGHT / 2)) --end-x $((SCREEN_WIDTH * 3/4)) --end-y $((SCREEN_HEIGHT / 2)) --duration 0.5 --udid $UDID

# Edge swipes (for system gestures — these gesture presets DO work)
axe gesture swipe-from-left-edge --screen-width $SCREEN_WIDTH --screen-height $SCREEN_HEIGHT --udid $UDID
axe gesture swipe-from-right-edge --screen-width $SCREEN_WIDTH --screen-height $SCREEN_HEIGHT --udid $UDID
```

### 4. Type Text

```bash
# First tap to focus the field, then type
axe tap --label "Search" --udid $UDID
sleep 0.3
axe type "your search text" --udid $UDID
```

### 5. Hardware Buttons

```bash
axe button home --udid $UDID
axe button lock --udid $UDID
axe button side-button --udid $UDID
```

### 6. Screenshots (Only for Evidence)

**Use screenshots only when you need visual evidence for PRs or documentation.**

```bash
# Quick JPEG screenshot (small file, good for PR attachments)
xcrun simctl io $UDID screenshot /tmp/screen.png && \
  sips -Z 1024 -s format jpeg -s formatOptions 80 /tmp/screen.png --out /tmp/screen.jpg && \
  rm /tmp/screen.png

# PNG for highest quality (when details matter)
xcrun simctl io $UDID screenshot /tmp/screen.png && \
  sips -Z 1568 /tmp/screen.png --out /tmp/screen_resized.png
```

---

## Navigation Patterns

### Pattern 1: Navigate and Verify

```bash
# Navigate
axe tap --label "Settings" --post-delay 0.5 --udid $UDID

# Verify using describe-ui (NOT screenshot)
if axe describe-ui --udid $UDID 2>&1 | grep -q '"AXLabel":"General"'; then
  echo "Successfully navigated to Settings"
else
  echo "Navigation failed - General not found"
fi
```

### Pattern 2: Wait for Element

```bash
wait_for_element() {
  local LABEL="$1"
  local UDID="$2"
  local MAX_ATTEMPTS="${3:-10}"

  for i in $(seq 1 $MAX_ATTEMPTS); do
    if axe describe-ui --udid $UDID 2>&1 | grep -v "objc" | grep -q "\"AXLabel\":\"$LABEL\""; then
      return 0
    fi
    sleep 0.5
  done
  return 1
}

# Usage
if wait_for_element "Submit" $UDID 20; then
  axe tap --label "Submit" --udid $UDID
else
  echo "Element never appeared"
fi
```

### Pattern 3: Back Navigation

**The swipe-from-left-edge gesture is unreliable. Prefer tapping the back button.**

```bash
# Method 1: Tap back button in top-left safe zone
axe tap -x 40 -y 70 --udid $UDID

# Method 2: Find back button dynamically
BACK=$(axe describe-ui --udid $UDID 2>&1 | grep -v "objc" | \
  jq '[.[] | .. | objects | select(.frame.y < 100 and .frame.x < 100 and .AXLabel != null and .type == "Button")] | .[0]')

if [ "$BACK" != "null" ]; then
  X=$(echo $BACK | jq '.frame.x + (.frame.width / 2)')
  Y=$(echo $BACK | jq '.frame.y + (.frame.height / 2)')
  axe tap -x $X -y $Y --udid $UDID
fi
```

### Pattern 4: Scroll Until Element Visible

```bash
scroll_to_element() {
  local LABEL="$1"
  local UDID="$2"
  local MAX_SCROLLS="${3:-10}"
  local SCREEN_WIDTH="${4:-393}"
  local SCREEN_HEIGHT="${5:-852}"
  local CENTER_X=$((SCREEN_WIDTH / 2))

  for i in $(seq 1 $MAX_SCROLLS); do
    if axe describe-ui --udid $UDID 2>&1 | grep -v "objc" | grep -q "\"AXLabel\":\"$LABEL\""; then
      return 0
    fi
    axe swipe --start-x $CENTER_X --start-y $((SCREEN_HEIGHT * 3/4)) --end-x $CENTER_X --end-y $((SCREEN_HEIGHT / 4)) --duration 0.5 --udid $UDID
    sleep 0.3
  done
  return 1
}

# Usage
if scroll_to_element "Privacy & Security" $UDID; then
  axe tap --label "Privacy & Security" --udid $UDID
fi
```

### Pattern 5: Extract Element Coordinates

```bash
get_element_center() {
  local LABEL="$1"
  local UDID="$2"

  axe describe-ui --udid $UDID 2>&1 | grep -v "objc" | \
    jq -r --arg label "$LABEL" '
      [.[] | .. | objects | select(.AXLabel == $label)] | .[0] |
      if . then "\(.frame.x + .frame.width/2),\(.frame.y + .frame.height/2)" else "not_found" end
    '
}

# Usage
COORDS=$(get_element_center "Submit" $UDID)
if [ "$COORDS" != "not_found" ]; then
  X=$(echo $COORDS | cut -d',' -f1)
  Y=$(echo $COORDS | cut -d',' -f2)
  axe tap -x $X -y $Y --udid $UDID
fi
```

---

## Tool Responsibilities

| Task                    | Tool                         | Notes                       |
| ----------------------- | ---------------------------- | --------------------------- |
| Boot/shutdown simulator | `xcrun simctl`               | Native Apple tool           |
| Install app             | `xcrun simctl install`       |                             |
| Launch app              | `xcrun simctl launch`        |                             |
| Light/dark mode         | `xcrun simctl ui appearance` |                             |
| Privacy permissions     | `xcrun simctl privacy`       | Pre-grant before launch     |
| **UI inspection**       | **`axe describe-ui`**        | Primary verification method |
| **Taps**                | **`axe tap`**                | Use --label or --id         |
| **Scrolling/swipes**    | **`axe gesture`**            | Built-in presets            |
| **Text input**          | **`axe type`**               | After focusing field        |
| Screenshots             | `xcrun simctl io screenshot` | Only for PR evidence        |

---

## Troubleshooting

### Element Not Found by Label

1. **Check exact label:** Labels are case-sensitive and may include extra text

   ```bash
   axe describe-ui --udid $UDID 2>&1 | grep -v "objc" | jq '.. | .AXLabel? // empty' | sort -u
   ```

2. **Element may be off-screen:** Scroll first, then retry

3. **Element hasn't loaded:** Use wait_for_element pattern

### Tap Has No Effect

1. **Add pre-delay:** Animation may still be running

   ```bash
   axe tap --label "Submit" --pre-delay 0.5 --udid $UDID
   ```

2. **Element may be disabled:** Check `enabled` field in describe-ui

3. **Wrong element tapped:** Multiple elements may have same label - use --id instead

### Back Gesture Doesn't Work

The `swipe-from-left-edge` gesture is unreliable on iOS. Use the back button tap pattern instead.

### objc Warnings in Output

Filter them out:

```bash
axe describe-ui --udid $UDID 2>&1 | grep -v "objc\["
```

---

## Integration Example

```bash
#!/bin/bash
# Complete navigation workflow

UDID=$(xcrun simctl list devices booted -j | jq -r '.devices[][] | select(.state == "Booted") | .udid' | head -1)
BUNDLE_ID="com.example.app"
SCREEN_WIDTH=393
SCREEN_HEIGHT=852

# Setup (simctl)
xcrun simctl launch $UDID $BUNDLE_ID
sleep 2

# Navigate to target screen (AXe)
axe tap --label "Profile" --post-delay 0.5 --udid $UDID

# Verify navigation (describe-ui, NOT screenshot)
if ! axe describe-ui --udid $UDID 2>&1 | grep -q '"AXLabel":"Edit Profile"'; then
  echo "ERROR: Failed to navigate to Profile"
  exit 1
fi

# Scroll to find element (use axe swipe, not broken gesture presets)
axe swipe --start-x $((SCREEN_WIDTH/2)) --start-y $((SCREEN_HEIGHT*3/4)) --end-x $((SCREEN_WIDTH/2)) --end-y $((SCREEN_HEIGHT/4)) --duration 0.5 --udid $UDID
sleep 0.3

# Tap target element
axe tap --label "Privacy Settings" --udid $UDID

# Final verification
axe describe-ui --udid $UDID 2>&1 | grep -v "objc" | jq '[.[] | .. | objects | select(.AXLabel) | .AXLabel]'
```

---

## When to Use Screenshots vs describe-ui

> **CRITICAL: Screenshots during navigation will break your session.**
>
> Each screenshot is 100-400KB. Taking 10 screenshots = 1-4MB of context consumed.
> This WILL cause API errors and session failures.

| Scenario                    | Tool          | Mandatory        |
| --------------------------- | ------------- | ---------------- |
| Navigation decisions        | `describe-ui` | **YES - always** |
| Verify navigation succeeded | `describe-ui` | **YES - always** |
| Check if element exists     | `describe-ui` | **YES - always** |
| Get element coordinates     | `describe-ui` | **YES - always** |
| Find tappable elements      | `describe-ui` | **YES - always** |
| BEFORE evidence for PR      | Screenshot    | Only 1           |
| AFTER evidence for PR       | Screenshot    | Only 1           |

**Maximum screenshots per task: 2 (BEFORE and AFTER only)**

Everything else MUST use `describe-ui`.

---

## XcodeBuildMCP (Alternative)

When the XcodeBuildMCP MCP server is connected, it provides equivalent UI automation tools that wrap AXe under the hood:

| AXe Command       | XcodeBuildMCP Equivalent          |
| ----------------- | --------------------------------- |
| `axe describe-ui` | `mcp__XcodeBuildMCP__describe_ui` |
| `axe tap`         | `mcp__XcodeBuildMCP__tap`         |
| `axe type`        | `mcp__XcodeBuildMCP__type_text`   |
| `axe gesture`     | `mcp__XcodeBuildMCP__gesture`     |

AXe remains the golden path because it works without MCP and gives you full control over arguments. Use XcodeBuildMCP when it's already connected and you want tighter integration with build/launch workflows. See `/ios-debugger-agent`.

## Status Bar Normalization

Before taking PR screenshots, normalize the status bar for clean results:

```bash
xcrun simctl status_bar booted override \
  --time "9:41" \
  --batteryState charged \
  --batteryLevel 100 \
  --cellularMode active \
  --cellularBars 4

# Take screenshot
xcrun simctl io booted screenshot /tmp/screen.png

# Clear override when done
xcrun simctl status_bar booted clear
```

---

## Uploading Test Results to ADO

When using simulator navigation for UI testing, upload results to Azure DevOps:

```bash
# Create test run for manual tests
az devops configure --defaults organization=https://yammer.visualstudio.com project=engineering

# Upload screenshot as test attachment
TOKEN=$(az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798 --query accessToken -o tsv)
RUN_ID=12345
curl -X POST "https://yammer.visualstudio.com/engineering/_apis/test/Runs/$RUN_ID/attachments?api-version=7.1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @/tmp/screen.jpg

# Query test results from UI test runs
az devops invoke --area test --resource runs \
  --route-parameters project=engineering \
  --query-parameters buildUri=vstfs:///Build/Build/$BUILD_ID \
  -o json | jq '.value[] | select(.name | contains("UI")) | {id, name, passedTests, failedTests}'

# Get failed UI test screenshots
az devops invoke --area test --resource attachments \
  --route-parameters project=engineering runId=$RUN_ID testCaseResultId=1 \
  -o json | jq '.value[] | select(.fileName | endswith(".png")) | .fileName'
```

## Related Skills

- `/injecting-simulator-tokens` - Automated token injection for YammerSDKDemoApp and Engage
- `/capturing-simulator-logs` - Capturing logs and metrics from simulator apps
- `/reproducing-bugs` - Bug reproduction workflow
- `/using-azure-cli` - `az devops invoke` for test result APIs
- `/migrating-to-swift-testing` - Test framework with CI/CD integration

## Verification

After navigation actions:

1. **Verify UDID:** `echo $UDID` shows a valid device identifier
2. **Verify navigation:** `axe describe-ui --udid $UDID | grep -q "ExpectedLabel"` finds the target element
3. **Verify tap effect:** Run `describe-ui` again to confirm screen changed
4. **Verify screenshots:** `ls -la /tmp/*.png` shows captured files
