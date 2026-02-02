# feat(matrix): Add multi-account support

## Summary

This PR adds support for running **multiple Matrix accounts** in parallel from a single OpenClaw instance. Each account gets its own SDK client instance with proper isolation.

## Motivation

Currently, OpenClaw's Matrix extension supports only a single account. Users running multiple bots or wanting to separate concerns (e.g., work vs personal, different rooms) need separate OpenClaw instances.

This PR enables multi-account operation with:
- Shared client management via `sharedClients` Map
- Account-specific credentials and homeservers
- Proper cleanup on stop/restart
- Account resolution from bindings configuration

## Changes

### Core Changes

| File | Change |
|------|--------|
| `extensions/matrix/src/matrix/client/shared.ts` | Replace single `sharedClientState` with `sharedClients` Map |
| `extensions/matrix/src/matrix/client/config.ts` | `resolveMatrixAuth()` accepts `accountId` parameter |
| `extensions/matrix/src/matrix/accounts.ts` | `listMatrixAccountIds()` reads from config + bindings |
| `extensions/matrix/src/matrix/monitor/index.ts` | Pass `accountId` to auth + stopSharedClient |
| `extensions/matrix/src/types.ts` | Add `accounts?: Record<string, MatrixAccountConfig>` |

### Supporting Changes

- Added `import-mutex.ts` for thread-safe SDK imports
- Added `debug-log.ts` for account-aware logging
- Updated all client access points to use account-keyed lookups
- Updated tests for multi-account scenarios

## Configuration

```yaml
matrix:
  accounts:
    main:
      homeserver: matrix.example.com
      userId: "@bot1:example.com"
      accessToken: "syt_..."
    secondary:
      homeserver: matrix.other.com
      userId: "@bot2:other.com"
      accessToken: "syt_..."
  
  bindings:
    - account: main
      rooms: ["!room1:example.com"]
    - account: secondary
      rooms: ["!room2:other.com"]
```

## Backwards Compatibility

- Single-account configs continue to work unchanged
- Default account is used when `accountId` not specified
- No breaking changes to existing Matrix setups

## Testing

Tested with:
- 2 Matrix accounts on different homeservers
- Concurrent message handling in different rooms
- Clean shutdown and restart
- Account isolation (messages route to correct account)

---

Co-authored-by: Albert Hild <albert@vainplex.de>
Co-authored-by: Claudia <claudia.keller0001@gmail.com>
