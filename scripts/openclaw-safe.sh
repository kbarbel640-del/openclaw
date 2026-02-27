#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  openclaw-safe.sh [--dry-run] [--no-health-check] <openclaw args...>

Examples:
  ./scripts/openclaw-safe.sh gateway restart
  ./scripts/openclaw-safe.sh plugins update dingtalk-connector
  ./scripts/openclaw-safe.sh --dry-run config set channels.dingtalk-connector.dmPolicy pairing

Behavior:
  - Detects high-risk OpenClaw operations.
  - Creates a timestamped backup of ~/.openclaw/openclaw.json before risky changes.
  - Runs post-change health checks.
  - On failure, restores config from backup and restarts gateway.
EOF
}

log() {
  printf '[openclaw-safe] %s\n' "$*"
}

is_high_risk() {
  local args="$*"
  [[ "$args" =~ (^|[[:space:]])gateway[[:space:]]+(restart|start|stop|install|uninstall|run|status)($|[[:space:]]) ]] && return 0
  [[ "$args" =~ (^|[[:space:]])config[[:space:]]+(set|unset)($|[[:space:]]) ]] && return 0
  [[ "$args" =~ (^|[[:space:]])plugins[[:space:]]+(install|update|uninstall|enable|disable)($|[[:space:]]) ]] && return 0
  [[ "$args" =~ openclaw\.json ]] && return 0
  return 1
}

DRY_RUN=0
NO_HEALTH_CHECK=0
POSITIONAL=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --no-health-check)
      NO_HEALTH_CHECK=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      POSITIONAL+=("$1")
      shift
      ;;
  esac
done

if [[ ${#POSITIONAL[@]} -eq 0 ]]; then
  usage
  exit 1
fi

STATE_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
CONFIG_PATH="${OPENCLAW_CONFIG_PATH:-$STATE_DIR/openclaw.json}"
TS="$(date +%Y%m%d-%H%M%S)"
SAFE_BACKUP="$STATE_DIR/openclaw.json.safe.${TS}.bak"
BACKUP_CREATED=0
CMD_STR="${POSITIONAL[*]}"

if is_high_risk "$CMD_STR"; then
  if [[ -f "$CONFIG_PATH" ]]; then
    log "High-risk command detected: $CMD_STR"
    log "Creating backup: $SAFE_BACKUP"
    if [[ "$DRY_RUN" -eq 0 ]]; then
      cp "$CONFIG_PATH" "$SAFE_BACKUP"
      BACKUP_CREATED=1
    fi
  else
    log "Config file not found at $CONFIG_PATH; skipping manual backup."
  fi
else
  log "Command not flagged as high-risk; running directly."
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  log "Dry-run: would run -> pnpm openclaw ${POSITIONAL[*]}"
  exit 0
fi

set +e
pnpm openclaw "${POSITIONAL[@]}"
CMD_EXIT=$?
set -e

health_check() {
  if [[ "$NO_HEALTH_CHECK" -eq 1 ]]; then
    log "Skipping health checks (--no-health-check)."
    return 0
  fi

  log "Running health checks..."
  pnpm openclaw channels status --probe >/dev/null
  pnpm openclaw status --deep >/dev/null
}

if [[ "$CMD_EXIT" -ne 0 ]]; then
  log "Command failed with exit code $CMD_EXIT."
  if [[ "$BACKUP_CREATED" -eq 1 && -f "$SAFE_BACKUP" ]]; then
    log "Restoring config from backup: $SAFE_BACKUP"
    cp "$SAFE_BACKUP" "$CONFIG_PATH"
    log "Restarting gateway after rollback..."
    pnpm openclaw gateway restart >/dev/null || true
  fi
  exit "$CMD_EXIT"
fi

if ! health_check; then
  log "Post-change health check failed."
  if [[ "$BACKUP_CREATED" -eq 1 && -f "$SAFE_BACKUP" ]]; then
    log "Rolling back config: $SAFE_BACKUP"
    cp "$SAFE_BACKUP" "$CONFIG_PATH"
    log "Restarting gateway after rollback..."
    pnpm openclaw gateway restart >/dev/null || true
  fi
  exit 2
fi

log "Command and health checks succeeded."
if [[ "$BACKUP_CREATED" -eq 1 ]]; then
  log "Backup kept at: $SAFE_BACKUP"
fi
