---
name: ios-debugger-agent
description: Use XcodeBuildMCP to build, run, launch, and debug the current iOS project on a booted simulator. Trigger when asked to run an iOS app, interact with the simulator UI, inspect on-screen state, capture logs/console output, or diagnose runtime behavior using XcodeBuildMCP tools.
---

# iOS Debugger Agent

## Overview

Use XcodeBuildMCP to build and run the current project scheme on a booted iOS simulator, interact with the UI, and capture logs. Prefer the MCP tools for simulator control, logs, and view inspection.

## Core Workflow

Follow this sequence unless the user asks for a narrower action.

### 1) Discover the booted simulator

- Call `mcp__XcodeBuildMCP__list_sims` and select the simulator with state `Booted`.
- If none are booted, ask the user to boot one (do not boot automatically unless asked).

### 2) Set session defaults

- Call `mcp__XcodeBuildMCP__session-set-defaults` with:
  - `projectPath` or `workspacePath` (whichever the repo uses)
  - `scheme` for the current app
  - `simulatorId` from the booted device
  - Optional: `configuration: "Debug"`, `useLatestOS: true`

### 3) Build + run (when requested)

- Call `mcp__XcodeBuildMCP__build_run_sim`.
- If the app is already built and only launch is requested, use `mcp__XcodeBuildMCP__launch_app_sim`.
- If bundle id is unknown:
  1. `mcp__XcodeBuildMCP__get_sim_app_path`
  2. `mcp__XcodeBuildMCP__get_app_bundle_id`

## Authentication

Before UI interaction, authenticate the app. See `/injecting-simulator-tokens` for full details.

| App                  | Method                                                        |
| -------------------- | ------------------------------------------------------------- |
| **YammerSDKDemoApp** | Token exchange + UserDefaults injection (automated, reliable) |
| **Engage**           | UI login via AXe (token injection is broken)                  |
| **Teams**            | UI login via AXe (no token injection path)                    |

## UI Interaction & Debugging

Use these when asked to inspect or interact with the running app.

**Context cost warning:** Each screenshot is 100-400KB. Use `describe_ui` for navigation and verification; take screenshots only for final evidence (BEFORE/AFTER for PRs).

- **Describe UI**: `mcp__XcodeBuildMCP__describe_ui` before tapping or swiping.
- **Tap**: `mcp__XcodeBuildMCP__tap` (prefer `id` or `label`; use coordinates only if needed).
- **Type**: `mcp__XcodeBuildMCP__type_text` after focusing a field.
- **Gestures**: `mcp__XcodeBuildMCP__gesture` for common scrolls and edge swipes.
- **Screenshot**: `mcp__XcodeBuildMCP__screenshot` for visual confirmation.

## Logs & Console Output

- Start logs: `mcp__XcodeBuildMCP__start_sim_log_cap` with the app bundle id.
- Stop logs: `mcp__XcodeBuildMCP__stop_sim_log_cap` and summarize important lines.
- For console output, set `captureConsole: true` and relaunch if required.

## AXe as Fallback

XcodeBuildMCP's UI automation tools (`describe_ui`, `tap`, `gesture`, `type_text`) wrap **AXe** under the hood. If XcodeBuildMCP is unavailable (MCP server not connected), use AXe directly:

```bash
UDID=$(xcrun simctl list devices booted -j | jq -r '.devices[][] | select(.state == "Booted") | .udid' | head -1)
axe describe-ui --udid "$UDID" 2>&1 | grep -v "objc"
axe tap --label "Submit" --udid "$UDID"
axe type "text" --udid "$UDID"
```

See `/navigating-simulator` for the full AXe command reference.

## Log Capture

For structured log capture, see `/capturing-simulator-logs`. XcodeBuildMCP provides convenience wrappers:

- `mcp__XcodeBuildMCP__start_sim_log_cap` — start streaming logs by bundle id
- `mcp__XcodeBuildMCP__stop_sim_log_cap` — stop and return captured logs

For direct control, use `xcrun simctl spawn booted log stream` with predicates.

## Troubleshooting

- If build fails, ask whether to retry with `preferXcodebuild: true`.
- If the wrong app launches, confirm the scheme and bundle id.
- If UI elements are not hittable, re-run `describe_ui` after layout changes.
