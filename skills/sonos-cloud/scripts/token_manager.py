#!/usr/bin/env python3
"""Sonos Cloud API token manager — stores, refreshes, and retrieves OAuth tokens."""

import json
import os
import sys
import time
import base64
import urllib.request
import urllib.parse
import urllib.error

CONFIG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config")
CREDENTIALS_FILE = os.path.join(CONFIG_DIR, "credentials.json")
TOKENS_FILE = os.path.join(CONFIG_DIR, "tokens.json")

SONOS_TOKEN_URL = "https://api.sonos.com/login/v3/oauth/access"


def load_credentials():
    """Load client_id and client_secret from credentials file."""
    if not os.path.exists(CREDENTIALS_FILE):
        print(f"Error: No credentials file at {CREDENTIALS_FILE}", file=sys.stderr)
        print("Create it with: python3 token_manager.py setup <client_id> <client_secret> <redirect_uri>", file=sys.stderr)
        sys.exit(1)
    with open(CREDENTIALS_FILE) as f:
        return json.load(f)


def load_tokens():
    """Load all household tokens. Returns dict of {household_name: token_data}."""
    if not os.path.exists(TOKENS_FILE):
        return {}
    with open(TOKENS_FILE) as f:
        return json.load(f)


def save_tokens(tokens):
    """Save tokens to disk."""
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(TOKENS_FILE, "w") as f:
        json.dump(tokens, f, indent=2)


def get_auth_header(creds):
    """Build Basic auth header from client credentials."""
    pair = f"{creds['client_id']}:{creds['client_secret']}"
    encoded = base64.b64encode(pair.encode()).decode()
    return f"Basic {encoded}"


def exchange_code(auth_code, household_name="default"):
    """Exchange authorization code for access + refresh tokens."""
    creds = load_credentials()
    data = urllib.parse.urlencode({
        "grant_type": "authorization_code",
        "code": auth_code,
        "redirect_uri": creds["redirect_uri"],
    }).encode()

    req = urllib.request.Request(SONOS_TOKEN_URL, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded;charset=utf-8")
    req.add_header("Authorization", get_auth_header(creds))

    try:
        with urllib.request.urlopen(req) as resp:
            token_data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"Error exchanging code: {e.code} — {body}", file=sys.stderr)
        sys.exit(1)

    tokens = load_tokens()
    tokens[household_name] = {
        "access_token": token_data["access_token"],
        "refresh_token": token_data["refresh_token"],
        "expires_at": time.time() + token_data.get("expires_in", 86400),
        "scope": token_data.get("scope", "playback-control-all"),
        "updated_at": time.time(),
    }
    save_tokens(tokens)
    print(f"✅ Tokens saved for household '{household_name}'")
    return tokens[household_name]


def refresh_token(household_name="default"):
    """Refresh an expired access token."""
    creds = load_credentials()
    tokens = load_tokens()

    if household_name not in tokens:
        print(f"Error: No tokens for household '{household_name}'", file=sys.stderr)
        sys.exit(1)

    data = urllib.parse.urlencode({
        "grant_type": "refresh_token",
        "refresh_token": tokens[household_name]["refresh_token"],
    }).encode()

    req = urllib.request.Request(SONOS_TOKEN_URL, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded;charset=utf-8")
    req.add_header("Authorization", get_auth_header(creds))

    try:
        with urllib.request.urlopen(req) as resp:
            token_data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"Error refreshing token for '{household_name}': {e.code} — {body}", file=sys.stderr)
        return False

    tokens[household_name] = {
        "access_token": token_data["access_token"],
        "refresh_token": token_data["refresh_token"],
        "expires_at": time.time() + token_data.get("expires_in", 86400),
        "scope": token_data.get("scope", "playback-control-all"),
        "updated_at": time.time(),
    }
    save_tokens(tokens)
    print(f"✅ Token refreshed for household '{household_name}'")
    return True


def refresh_all():
    """Refresh all stored tokens that are expiring within 2 hours."""
    tokens = load_tokens()
    threshold = time.time() + 7200  # 2 hours from now
    refreshed = 0
    failed = 0

    for name, data in tokens.items():
        if data.get("expires_at", 0) < threshold:
            print(f"Refreshing token for '{name}'...")
            if refresh_token(name):
                refreshed += 1
            else:
                failed += 1
        else:
            remaining = (data["expires_at"] - time.time()) / 3600
            print(f"'{name}' still valid ({remaining:.1f}h remaining)")

    print(f"\nDone: {refreshed} refreshed, {failed} failed, {len(tokens) - refreshed - failed} still valid")
    return failed == 0


def get_access_token(household_name="default"):
    """Get a valid access token, refreshing if needed."""
    tokens = load_tokens()
    if household_name not in tokens:
        print(f"Error: No tokens for '{household_name}'. Run authorization first.", file=sys.stderr)
        sys.exit(1)

    token_data = tokens[household_name]

    # Refresh if expiring within 5 minutes
    if token_data.get("expires_at", 0) < time.time() + 300:
        print(f"Token expiring soon, refreshing...", file=sys.stderr)
        refresh_token(household_name)
        tokens = load_tokens()
        token_data = tokens[household_name]

    return token_data["access_token"]


def get_auth_url():
    """Generate the OAuth authorization URL for a user to click."""
    creds = load_credentials()
    params = urllib.parse.urlencode({
        "client_id": creds["client_id"],
        "response_type": "code",
        "state": f"openclaw_{int(time.time())}",
        "scope": "playback-control-all",
        "redirect_uri": creds["redirect_uri"],
    })
    return f"https://api.sonos.com/login/v3/oauth?{params}"


def setup(client_id, client_secret, redirect_uri):
    """Save client credentials."""
    os.makedirs(CONFIG_DIR, exist_ok=True)
    creds = {
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
    }
    with open(CREDENTIALS_FILE, "w") as f:
        json.dump(creds, f, indent=2)
    print(f"✅ Credentials saved to {CREDENTIALS_FILE}")


def list_households():
    """List all authorized households."""
    tokens = load_tokens()
    if not tokens:
        print("No households authorized yet.")
        return
    for name, data in tokens.items():
        expires = data.get("expires_at", 0)
        remaining = (expires - time.time()) / 3600
        status = f"{remaining:.1f}h remaining" if remaining > 0 else "EXPIRED"
        updated = time.strftime("%Y-%m-%d %H:%M", time.localtime(data.get("updated_at", 0)))
        print(f"  {name}: {status} (last refreshed: {updated})")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  token_manager.py setup <client_id> <client_secret> <redirect_uri>")
        print("  token_manager.py auth-url              — Generate OAuth URL")
        print("  token_manager.py exchange <code> [name] — Exchange auth code for tokens")
        print("  token_manager.py refresh [name]         — Refresh a specific token")
        print("  token_manager.py refresh-all            — Refresh all expiring tokens")
        print("  token_manager.py get-token [name]       — Get valid access token")
        print("  token_manager.py list                   — List households")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "setup":
        if len(sys.argv) != 5:
            print("Usage: token_manager.py setup <client_id> <client_secret> <redirect_uri>")
            sys.exit(1)
        setup(sys.argv[2], sys.argv[3], sys.argv[4])

    elif cmd == "auth-url":
        print(get_auth_url())

    elif cmd == "exchange":
        code = sys.argv[2] if len(sys.argv) > 2 else input("Authorization code: ").strip()
        name = sys.argv[3] if len(sys.argv) > 3 else "default"
        exchange_code(code, name)

    elif cmd == "refresh":
        name = sys.argv[2] if len(sys.argv) > 2 else "default"
        refresh_token(name)

    elif cmd == "refresh-all":
        success = refresh_all()
        sys.exit(0 if success else 1)

    elif cmd == "get-token":
        name = sys.argv[2] if len(sys.argv) > 2 else "default"
        print(get_access_token(name))

    elif cmd == "list":
        list_households()

    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)
