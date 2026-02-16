---
name: dem-auth
description: Ed25519 wallet-based authentication for DEM operators. Handles challenge-response auth flow, session management, and command authorization.
user-invocable: false
disable-model-invocation: false
metadata: {"openclaw":{"requires":{"env":["DEM_AUTH_OPERATORS_PATH"]}}}
---
# DEM Authentication Skill

## Auth Flow

When an operator sends `AUTH`:
1. Generate a random nonce challenge (32 bytes hex)
2. Reply with: `CHALLENGE: <nonce>` and instructions to sign with dem-auth CLI
3. Operator signs with `dem-auth sign <nonce>` and sends back `AUTH_RESPONSE: <base64_signature>`
4. Verify signature against registered public keys in operators.json
5. On success: create 1-hour session, reply with session confirmation
6. On failure: reject with reason

## Session Check

For each incoming message:
1. Look up sender's phone number in active sessions
2. If valid session exists and not expired: allow
3. If no session or expired: prompt for AUTH

## Signed Commands

Messages prefixed with `SIGNED:<base64_sig>:<message>` require per-message verification:
- Used for sensitive operations (operator management, treasury, config changes)
- Verify the signature covers the exact message text
- Must have an active session AND valid per-message signature

## Commands Reference

- `AUTH` — Start authentication flow
- `AUTH_RESPONSE: <signature>` — Complete auth with signed challenge
- `SIGNED:<sig>:<message>` — Per-message signed command
- `AUTH STATUS` — Check current session status
- `AUTH REVOKE` — End current session
