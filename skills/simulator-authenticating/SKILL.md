---
name: simulator-authenticating
description: Authenticates iOS Simulator apps for testing. Use when apps show login screens, buttons are grayed out, or need to authenticate YammerSDKDemoApp, Engage, or Teams.
---

# Simulator Authenticating

Automated authentication for iOS Simulator apps. Eliminates manual login for development and testing.

## Contents

- [Quick Reference](#quick-reference)
- [Token Exchange](#token-exchange)
- [YammerSDKDemoApp](#yammersdk-demoapp)
- [Engage](#engage)
- [Teams](#teams)
- [Token Expiry](#token-expiry)
- [Troubleshooting](#troubleshooting)

## Quick Reference

| App                  | Auth Method                             | Reliability                          |
| -------------------- | --------------------------------------- | ------------------------------------ |
| **YammerSDKDemoApp** | Token exchange + UserDefaults injection | **High**                             |
| **Engage**           | Token injection via UI test mode        | **High**                             |
| **Teams**            | UI login via AXe                        | **Medium** (no token injection path) |

### Prerequisites

Requires: `az login` active, jq.

```bash
az account show --query user.name -o tsv  # Verify az CLI
```

## Token Exchange

Both YammerSDKDemoApp and Engage need a Yammer OAuth token (not a raw AAD JWT). This exchange converts AAD JWT to Yammer's `NETWORKID-TOKEN` format.

```bash
AAD_TOKEN=$(az account get-access-token --resource "https://api.yammer.com" --query accessToken -o tsv)
YAMMER_TOKEN=$(curl -s -X POST "https://www.yammer.com/oauth2/access_token" \
  -d "client_id=NGvHVrd3y3tIXDMTej7MsA" \
  -d "client_secret=Lm3il4pIKiCe5Xe8RsQLYZOHK8QfsKJ8YSTDFEGUQ" \
  -d "username=$(az account show --query user.name -o tsv)" \
  -d "grant_type=jwt" \
  -d "jwt=$AAD_TOKEN" \
  -d "with_treatments=1" | jq -r '.access_token.token')
echo "Token length: ${#YAMMER_TOKEN}"  # Should be >10
```

**Source:** `YSAuthenticationNetworkingService.m:31-48` (API), `YMMainAppConfig.m:126-131` (client_id/secret).

## YammerSDKDemoApp

Token exchange + UserDefaults injection. No race conditions, no UI gates.

**Source:** `AuthenticationProvider.swift:42` reads `UserDefaults.standard.string(forKey: "token")`.

```bash
# 1. Get token (see Token Exchange above)
# 2. Inject + launch
xcrun simctl spawn booted defaults write com.yammer.YammerSDKDemoApp token "$YAMMER_TOKEN"
xcrun simctl terminate booted com.yammer.YammerSDKDemoApp 2>/dev/null
xcrun simctl launch booted com.yammer.YammerSDKDemoApp
```

### Verify

Use `/simulator-navigating` to inspect the screen after launch. **Success:** "Authenticated" label visible, buttons like "Open storyline feed" are enabled.

**Note:** SDK Demo App may open iOS Settings on first launch (notification permissions). If this happens, relaunch with `xcrun simctl launch booted com.yammer.YammerSDKDemoApp`.

## Engage

Token injection via the UI test automation path built into `YKAuthenticationCenter`.

**Source:** `YKAuthenticationCenter.m:240-248` -- when `isUITest=1` env var is set, `hasAuthenticated` reads `AutomationLoginUserAccessToken` from UserDefaults, calls `injectUserToken:serviceURL:`, then `fetchNetworkTokens` fetches network data from the API.

> **IMPORTANT:** Terminate YammerSDKDemoApp before launching Engage. When both apps run, accessibility inspection returns the SDK Demo App's tree instead of Engage's.

```bash
# 1. Get token (see Token Exchange above)
# 2. Kill conflicting apps
xcrun simctl terminate booted com.yammer.YammerSDKDemoApp 2>/dev/null
xcrun simctl terminate booted wefwef 2>/dev/null
sleep 1

# 3. Write automation keys
xcrun simctl spawn booted defaults write wefwef AutomationServiceURL "https://www.yammer.com"
xcrun simctl spawn booted defaults write wefwef AutomationLoginUserAccessToken "$YAMMER_TOKEN"

# 4. Suppress teaching bubbles / rebranding dialogs
xcrun simctl spawn booted defaults write wefwef hasMomentsTeachingBubbleBeenShown -bool true
xcrun simctl spawn booted defaults write wefwef "rebrandingDialog.dialog_dismissed" -bool true

# 5. Launch with isUITest=1
SIMCTL_CHILD_isUITest=1 xcrun simctl launch booted wefwef
```

### Verify

Wait ~6 seconds after launch, then use `/simulator-navigating` to inspect. **Success:** Home Feed with posts, Compose button, tab bar (Home Feed, Communities, Storylines, My Profile).

### How It Works

```
Azure CLI -> AAD JWT -> Token Exchange -> Yammer OAuth Token
                                               |
                          UserDefaults ("AutomationLoginUserAccessToken")
                                               |
                          YKAuthenticationCenter.hasAuthenticated()
                                               | (isUITest=1)
                          injectUserToken() -> self.authInfo set
                                               |
                          fetchNetworkTokensWithPostNotification
                                               |
                          YKAuthenticationRestoredNotification
                                               |
                          UI loads Home Feed
```

### Environment Variables for simctl

`xcrun simctl launch` does NOT support `--env`. Use the `SIMCTL_CHILD_` prefix:

```bash
# Correct
SIMCTL_CHILD_isUITest=1 xcrun simctl launch booted wefwef

# Wrong (--env flag does not exist)
xcrun simctl launch booted wefwef --env isUITest=1
```

Source: `YKAppConfig.m:54-58` reads `isUITest` from `ProcessInfo.processInfo.environment`.

## Teams

Teams has **no token injection path**. Always use UI login.

```bash
xcrun simctl terminate booted com.microsoft.skype.teams 2>/dev/null
xcrun simctl launch booted com.microsoft.skype.teams
sleep 5

# Use /simulator-navigating to find and tap "Sign in", then enter credentials
# MSAL web view requires manual password entry
```

## Token Expiry

| Token Type              | Validity            | Refresh               |
| ----------------------- | ------------------- | --------------------- |
| Azure CLI access token  | ~60-90 min          | Re-run token exchange |
| Azure CLI refresh token | ~90 days            | `az login`            |
| Yammer OAuth token      | ~2 hours            | Re-run token exchange |
| Simulator UserDefaults  | Until app reinstall | Persists              |

**Check expiry:** `az account get-access-token --query "expiresOn" -o tsv`

**Symptoms:** 401 errors, "Session expired", login screen reappears.

## Cleanup

```bash
# Clear YammerSDKDemoApp
xcrun simctl spawn booted defaults delete com.yammer.YammerSDKDemoApp token 2>/dev/null

# Clear Engage
xcrun simctl spawn booted defaults delete wefwef AutomationServiceURL 2>/dev/null
xcrun simctl spawn booted defaults delete wefwef AutomationLoginUserAccessToken 2>/dev/null

# Nuclear: uninstall
xcrun simctl uninstall booted com.yammer.YammerSDKDemoApp
xcrun simctl uninstall booted wefwef
```

## DOs and DON'Ts

### DO

- **DO** terminate YammerSDKDemoApp before launching Engage — both use accessibility, and the SDK app's tree shadows Engage's
- **DO** use `SIMCTL_CHILD_` prefix for environment variables (e.g. `SIMCTL_CHILD_isUITest=1`), NOT `--env`
- **DO** run token exchange fresh each session — Yammer OAuth tokens expire in ~2 hours
- **DO** uninstall and reinstall Engage (`xcrun simctl uninstall`) for a clean first-launch if auth fails
- **DO** suppress teaching bubbles and rebranding dialogs via UserDefaults before launching
- **DO** wait ~10 seconds after launch before inspecting — the app needs time for token injection + network fetch
- **DO** use `bundle exec pod install` (with Ruby 3.3.1 via mise) after adding new Swift files to pod source directories
- **DO** build with the `Yammer` scheme (NOT `wefwef` — that's the bundle ID, not a scheme)

### DON'T

- **DON'T** call `injectUserToken:serviceURL:` multiple times — each call triggers `synchronouslyLogoutWithType:Completely` which async-deletes the entire CoreData persistent store, racing with in-flight network parses
- **DON'T** use `--env` flag with `xcrun simctl launch` — it does not exist; use `SIMCTL_CHILD_` prefix instead
- **DON'T** assume the token is still valid from a previous session — always re-exchange
- **DON'T** skip the `pod install` step after adding files to pod source directories — the Pods project won't pick them up
- **DON'T** use Ruby 3.3.10 with the vendor bundle compiled for 3.3.1 — native extensions are incompatible
- **DON'T** leave both YammerSDKDemoApp and Engage running simultaneously — AXe will inspect the wrong app

## Troubleshooting

| Issue                                            | Cause                                                                                                           | Fix                                                                                                                     |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| "Run 'az login' first"                           | Azure CLI expired                                                                                               | `az login`                                                                                                              |
| "No simulator is booted"                         | No simulator                                                                                                    | Boot one first                                                                                                          |
| Buttons grayed out (SDK demo)                    | Token not loaded                                                                                                | Terminate and relaunch                                                                                                  |
| Buttons grayed out (SDK demo)                    | Raw AAD JWT used                                                                                                | Run token exchange step                                                                                                 |
| Engage shows login screen                        | Token not injected                                                                                              | Check `SIMCTL_CHILD_isUITest=1` syntax                                                                                  |
| Engage shows login screen                        | Stale token                                                                                                     | Re-run token exchange                                                                                                   |
| Engage shows login screen                        | CoreData race on first launch                                                                                   | Uninstall app first (`xcrun simctl uninstall`), then reinstall fresh                                                    |
| Token exchange returns null                      | AAD token expired                                                                                               | `az login` or fresh token                                                                                               |
| Token length is 0                                | Azure CLI issue                                                                                                 | Check `az account get-access-token`                                                                                     |
| Engage crashes on Communities tab                | `hasAuthenticated` re-injects token on each call, triggering async CoreData purge that races with network fetch | Fixed: `didInjectAutomationToken` guard in `YKAuthenticationCenter.m` prevents re-injection after first successful call |
| Build error: `cannot find 'UnseenIndicatorView'` | New Swift file not in Pods project                                                                              | Run `bundle exec pod install` with Ruby 3.3.1                                                                           |
| `bundler: failed to load command: pod`           | Ruby version mismatch in vendor bundle                                                                          | Use Ruby 3.3.1 via mise: `mise use ruby@3.3.1`                                                                          |
