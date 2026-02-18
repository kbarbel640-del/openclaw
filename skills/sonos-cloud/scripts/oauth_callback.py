#!/usr/bin/env python3
"""
Lightweight OAuth callback server for Sonos authorization.
Runs temporarily to catch the OAuth redirect, then shuts down.

Usage:
  python3 oauth_callback.py [--port 8732] [--household kellen]

The redirect_uri in your Sonos integration should point to:
  https://your-domain.com/callback  (proxied to this server)
  or for local testing: http://localhost:8732/callback
"""

import json
import os
import sys
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from token_manager import exchange_code, get_auth_url

HOUSEHOLD_NAME = "default"


class OAuthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/":
            # Show the auth link
            auth_url = get_auth_url()
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            html = f"""<!DOCTYPE html>
<html>
<head><title>Sonos Authorization — OpenClaw</title>
<style>
  body {{ font-family: -apple-system, sans-serif; max-width: 600px; margin: 80px auto; padding: 20px; background: #0a0a0a; color: #e0e0e0; }}
  a {{ color: #4fc3f7; text-decoration: none; font-size: 1.2em; }}
  a:hover {{ text-decoration: underline; }}
  .logo {{ font-size: 2em; margin-bottom: 20px; }}
  .card {{ background: #1a1a1a; border-radius: 12px; padding: 30px; border: 1px solid #333; }}
</style>
</head>
<body>
<div class="card">
  <div class="logo">🔊 🦞</div>
  <h2>Sonos × OpenClaw</h2>
  <p>Click below to authorize OpenClaw to control your Sonos speakers:</p>
  <p><a href="{auth_url}">→ Sign in with Sonos</a></p>
  <p style="color:#888; font-size:0.9em; margin-top:20px;">
    This will connect your Sonos household as: <strong>{HOUSEHOLD_NAME}</strong>
  </p>
</div>
</body>
</html>"""
            self.wfile.write(html.encode())

        elif parsed.path == "/callback":
            params = parse_qs(parsed.query)
            code = params.get("code", [None])[0]
            state = params.get("state", [None])[0]
            error = params.get("error", [None])[0]

            if error:
                self.send_response(400)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                self.wfile.write(f"<h2>Authorization failed: {error}</h2>".encode())
                return

            if not code:
                self.send_response(400)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                self.wfile.write(b"<h2>No authorization code received</h2>")
                return

            # Exchange the code for tokens
            try:
                exchange_code(code, HOUSEHOLD_NAME)
                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                html = f"""<!DOCTYPE html>
<html>
<head><title>Success — Sonos × OpenClaw</title>
<style>
  body {{ font-family: -apple-system, sans-serif; max-width: 600px; margin: 80px auto; padding: 20px; background: #0a0a0a; color: #e0e0e0; }}
  .card {{ background: #1a1a1a; border-radius: 12px; padding: 30px; border: 1px solid #2e7d32; }}
  .check {{ font-size: 3em; }}
</style>
</head>
<body>
<div class="card">
  <div class="check">✅</div>
  <h2>Sonos Connected!</h2>
  <p>Household <strong>'{HOUSEHOLD_NAME}'</strong> is now authorized.</p>
  <p>OpenClaw agents can now control your Sonos speakers.</p>
  <p style="color:#888; font-size:0.9em;">You can close this window.</p>
</div>
</body>
</html>"""
                self.wfile.write(html.encode())
                print(f"\n✅ Authorization complete for '{HOUSEHOLD_NAME}'! Shutting down server...")
                # Schedule shutdown
                import threading
                threading.Timer(1.0, lambda: os._exit(0)).start()

            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                self.wfile.write(f"<h2>Token exchange failed: {e}</h2>".encode())

        else:
            self.send_response(404)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Not found")

    def log_message(self, format, *args):
        print(f"[OAuth] {args[0]}")


def main():
    port = 8732
    global HOUSEHOLD_NAME

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--port" and i + 1 < len(args):
            port = int(args[i + 1])
            i += 2
        elif args[i] == "--household" and i + 1 < len(args):
            HOUSEHOLD_NAME = args[i + 1]
            i += 2
        else:
            i += 1

    auth_url = get_auth_url()
    print(f"🔊 Sonos OAuth Callback Server")
    print(f"   Household: {HOUSEHOLD_NAME}")
    print(f"   Listening: http://0.0.0.0:{port}")
    print(f"   Landing:   http://localhost:{port}/")
    print(f"   Callback:  http://localhost:{port}/callback")
    print(f"\n   Auth URL:  {auth_url}")
    print(f"\nWaiting for authorization...")

    server = HTTPServer(("0.0.0.0", port), OAuthHandler)
    server.serve_forever()


if __name__ == "__main__":
    main()
