#!/usr/bin/env bash
set -euo pipefail

# Diabolus Ex Machina — OpenClaw Setup
# Installs OpenClaw, deploys agent config, and verifies connectivity.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[DEM]${NC} $1"; }
warn()  { echo -e "${YELLOW}[DEM]${NC} $1"; }
error() { echo -e "${RED}[DEM]${NC} $1"; }

# Check Node.js version
check_node() {
  if ! command -v node &>/dev/null; then
    error "Node.js not found. Install Node.js 22+ first."
    exit 1
  fi
  NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
  if (( NODE_VERSION < 22 )); then
    error "Node.js $NODE_VERSION found. OpenClaw requires Node.js 22+."
    exit 1
  fi
  info "Node.js $(node -v) OK"
}

# Install OpenClaw globally
install_openclaw() {
  if command -v openclaw &>/dev/null; then
    info "OpenClaw already installed: $(openclaw --version 2>/dev/null || echo 'unknown version')"
  else
    info "Installing OpenClaw..."
    npm install -g openclaw@latest
    info "OpenClaw installed: $(openclaw --version)"
  fi
}

# Deploy openclaw.json config
deploy_config() {
  local DEST="$HOME/.openclaw"
  mkdir -p "$DEST"

  if [[ -f "$DEST/openclaw.json" ]]; then
    warn "Existing openclaw.json found — backing up to openclaw.json.bak"
    cp "$DEST/openclaw.json" "$DEST/openclaw.json.bak"
  fi

  cp "$SCRIPT_DIR/openclaw.json" "$DEST/openclaw.json"
  info "Deployed openclaw.json to $DEST/"

  # Deploy agent workspaces
  for AGENT in ceo coo cfo research; do
    local WORKSPACE="$DEST/workspaces/$AGENT"
    mkdir -p "$WORKSPACE"
    cp "$SCRIPT_DIR/workspaces/$AGENT/"*.md "$WORKSPACE/"
    info "Deployed $AGENT workspace"
  done

  # Deploy dem-auth skill
  if [[ -d "$PROJECT_DIR/skills/dem-auth" ]]; then
    local SKILL_DEST="$DEST/skills/dem-auth"
    mkdir -p "$SKILL_DEST"
    cp -r "$PROJECT_DIR/skills/dem-auth/"* "$SKILL_DEST/"
    info "Deployed dem-auth skill"
  fi
}

# Install daemon and start Gateway
setup_daemon() {
  info "Setting up OpenClaw daemon..."
  openclaw onboard --install-daemon 2>/dev/null || {
    warn "Daemon setup requires interactive onboarding. Run: openclaw onboard --install-daemon"
  }
}

# Verify GPU server connectivity
verify_models() {
  local SERVERS=("maximus:11434" "tiberius:11434" "claudius:11434")

  for SERVER in "${SERVERS[@]}"; do
    HOST=$(echo "$SERVER" | cut -d: -f1)
    PORT=$(echo "$SERVER" | cut -d: -f2)
    if curl -s --connect-timeout 3 "http://$SERVER/api/tags" &>/dev/null; then
      MODEL_COUNT=$(curl -s "http://$SERVER/api/tags" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('models',[])))" 2>/dev/null || echo "?")
      info "$HOST: reachable ($MODEL_COUNT models)"
    else
      warn "$HOST: not reachable (check network/firewall)"
    fi
  done
}

# Verify MCP servers
verify_mcp() {
  local MCP_PORTS=(8811 8812 8813 8814 8815 8816 8819)
  local MCP_NAMES=("grafana" "wikijs" "postgres" "redis" "n8n" "docker" "ollama")

  for i in "${!MCP_PORTS[@]}"; do
    PORT=${MCP_PORTS[$i]}
    NAME=${MCP_NAMES[$i]}
    if curl -s --connect-timeout 3 "http://192.168.2.50:$PORT/sse" | head -1 | grep -q "event"; then
      info "MCP $NAME (:$PORT): OK"
    else
      warn "MCP $NAME (:$PORT): not responding"
    fi
  done
}

# Verify Gateway
verify_gateway() {
  if curl -s --connect-timeout 3 "http://127.0.0.1:18789/" &>/dev/null; then
    info "Gateway: running at http://127.0.0.1:18789/"
  else
    warn "Gateway: not running. Start with: openclaw gateway start"
  fi
}

# Main
main() {
  info "=== Diabolus Ex Machina — OpenClaw Setup ==="
  echo

  case "${1:-all}" in
    install)
      check_node
      install_openclaw
      ;;
    deploy)
      deploy_config
      ;;
    verify)
      verify_models
      verify_mcp
      verify_gateway
      ;;
    daemon)
      setup_daemon
      ;;
    all)
      check_node
      install_openclaw
      deploy_config
      setup_daemon
      verify_models
      verify_mcp
      verify_gateway
      ;;
    *)
      echo "Usage: $0 {install|deploy|verify|daemon|all}"
      exit 1
      ;;
  esac

  echo
  info "=== Setup complete ==="
}

main "$@"
