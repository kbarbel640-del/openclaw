#!/usr/bin/env sh
set -e

# Ensure Homebrew-installed CLIs are available to the non-root 'node' user
export PATH="/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:$PATH"

CONFIG_PATH="${OPENCLAW_CONFIG_PATH:-/home/node/.openclaw/openclaw.json}"

if [ ! -f "$CONFIG_PATH" ]; then
  mkdir -p "$(dirname "$CONFIG_PATH")"

  if [ -n "${OPENCLAW_BROWSER_EXECUTABLE:-}" ]; then
    CHROME_PATH="$OPENCLAW_BROWSER_EXECUTABLE"
  else
    CHROME_PATH="$(ls -d /home/node/.cache/ms-playwright/chromium-*/chrome-linux/chrome 2>/dev/null | head -n 1 || true)"
  fi

  if [ -n "$CHROME_PATH" ]; then
    cat > "$CONFIG_PATH" <<EOF
{
  browser: {
    enabled: true,
    defaultProfile: "openclaw",
    headless: true,
    noSandbox: true,
    executablePath: "${CHROME_PATH}"
  }
}
EOF
  else
    echo "OpenClaw: no Playwright Chromium detected; skip browser defaults." >&2
  fi
fi

exec "$@"
