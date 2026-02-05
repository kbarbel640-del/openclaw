#!/usr/bin/env bash
#
# samantha-code - Smart wrapper for coding agents
# Auto-detects project type, handles setup, passes context
#
# Usage: samantha-code [options] <project-dir> <prompt>
#
# Options:
#   --agent <claude|codex|pi>  Force specific agent (default: auto-detect)
#   --setup                    Run setup before task (install deps)
#   --verify                   Run verification after task (lint, test, build)
#   --context <file>           Additional context file to inject
#   --memory <json>            Samantha memories as JSON string
#   --retries <n>              Max retries on failure (default: 2)
#   --timeout <seconds>        Task timeout (default: 600)
#   --quiet                    Suppress progress output
#   --json                     Output structured JSON result
#

set -euo pipefail

# Defaults
AGENT="auto"
SETUP=false
VERIFY=false
CONTEXT_FILE=""
MEMORY_JSON=""
MAX_RETRIES=2
TIMEOUT=600
QUIET=false
JSON_OUTPUT=false
PROJECT_DIR=""
PROMPT=""

# Colors (if terminal)
if [[ -t 1 ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BLUE='\033[0;34m'
  NC='\033[0m'
else
  RED='' GREEN='' YELLOW='' BLUE='' NC=''
fi

log() { [[ "$QUIET" == "false" ]] && echo -e "${BLUE}[samantha-code]${NC} $*" >&2 || true; }
warn() { echo -e "${YELLOW}[warn]${NC} $*" >&2; }
err() { echo -e "${RED}[error]${NC} $*" >&2; }
ok() { [[ "$QUIET" == "false" ]] && echo -e "${GREEN}[ok]${NC} $*" >&2 || true; }

usage() {
  grep '^#' "$0" | grep -v '#!/' | sed 's/^# \?//'
  exit 1
}

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent) AGENT="$2"; shift 2 ;;
    --setup) SETUP=true; shift ;;
    --verify) VERIFY=true; shift ;;
    --context) CONTEXT_FILE="$2"; shift 2 ;;
    --memory) MEMORY_JSON="$2"; shift 2 ;;
    --retries) MAX_RETRIES="$2"; shift 2 ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    --quiet) QUIET=true; shift ;;
    --json) JSON_OUTPUT=true; shift ;;
    -h|--help) usage ;;
    *)
      if [[ -z "$PROJECT_DIR" ]]; then
        PROJECT_DIR="$1"
      elif [[ -z "$PROMPT" ]]; then
        PROMPT="$1"
      else
        PROMPT="$PROMPT $1"
      fi
      shift
      ;;
  esac
done

[[ -z "$PROJECT_DIR" || -z "$PROMPT" ]] && usage

# Resolve project dir
PROJECT_DIR=$(realpath "$PROJECT_DIR" 2>/dev/null || echo "$PROJECT_DIR")
[[ ! -d "$PROJECT_DIR" ]] && { err "Directory not found: $PROJECT_DIR"; exit 1; }

cd "$PROJECT_DIR"
log "Working in: $PROJECT_DIR"

# Detect project type
detect_project_type() {
  if [[ -f "package.json" ]]; then
    if [[ -f "bun.lockb" ]]; then
      echo "bun"
    elif [[ -f "pnpm-lock.yaml" ]]; then
      echo "pnpm"
    elif [[ -f "yarn.lock" ]]; then
      echo "yarn"
    else
      echo "npm"
    fi
  elif [[ -f "Cargo.toml" ]]; then
    echo "cargo"
  elif [[ -f "go.mod" ]]; then
    echo "go"
  elif [[ -f "pyproject.toml" || -f "requirements.txt" ]]; then
    echo "python"
  elif [[ -f "Gemfile" ]]; then
    echo "ruby"
  elif [[ -f "build.gradle" || -f "pom.xml" ]]; then
    echo "java"
  else
    echo "unknown"
  fi
}

PROJECT_TYPE=$(detect_project_type)
log "Detected project type: $PROJECT_TYPE"

# Detect best agent
detect_agent() {
  if command -v claude &>/dev/null; then
    echo "claude"
  elif command -v codex &>/dev/null; then
    echo "codex"
  elif command -v pi &>/dev/null; then
    echo "pi"
  else
    echo "none"
  fi
}

if [[ "$AGENT" == "auto" ]]; then
  AGENT=$(detect_agent)
  [[ "$AGENT" == "none" ]] && { err "No coding agent found (claude, codex, pi)"; exit 1; }
fi
log "Using agent: $AGENT"

# Setup phase
run_setup() {
  log "Running setup..."
  case "$PROJECT_TYPE" in
    npm)   npm install 2>&1 || warn "npm install had issues" ;;
    pnpm)  pnpm install 2>&1 || warn "pnpm install had issues" ;;
    yarn)  yarn install 2>&1 || warn "yarn install had issues" ;;
    bun)   bun install 2>&1 || warn "bun install had issues" ;;
    cargo) cargo fetch 2>&1 || warn "cargo fetch had issues" ;;
    go)    go mod download 2>&1 || warn "go mod download had issues" ;;
    python)
      if [[ -f "requirements.txt" ]]; then
        pip install -r requirements.txt 2>&1 || warn "pip install had issues"
      fi
      ;;
    *)     log "No setup needed for $PROJECT_TYPE" ;;
  esac
  ok "Setup complete"
}

[[ "$SETUP" == "true" ]] && run_setup

# Build context prefix
build_context() {
  local ctx=""
  
  # Project type context
  ctx+="Project type: $PROJECT_TYPE\n"
  ctx+="Working directory: $PROJECT_DIR\n\n"
  
  # Samantha memories
  if [[ -n "$MEMORY_JSON" ]]; then
    ctx+="## Relevant Context from Memory:\n$MEMORY_JSON\n\n"
  fi
  
  # External context file
  if [[ -n "$CONTEXT_FILE" && -f "$CONTEXT_FILE" ]]; then
    ctx+="## Additional Context:\n$(cat "$CONTEXT_FILE")\n\n"
  fi
  
  # Coding standards (if present)
  for f in .coding-standards.md CONTRIBUTING.md .editorconfig; do
    if [[ -f "$f" ]]; then
      ctx+="## Coding standards ($f exists - follow them)\n"
      break
    fi
  done
  
  echo -e "$ctx"
}

CONTEXT=$(build_context)

# Build final prompt
FULL_PROMPT="$CONTEXT

## Task:
$PROMPT"

# Run agent
run_agent() {
  local attempt=$1
  log "Attempt $attempt/$MAX_RETRIES"
  
  local tmplog=$(mktemp)
  local exit_code=0
  
  case "$AGENT" in
    claude)
      timeout "$TIMEOUT" claude --print "$FULL_PROMPT" 2>&1 | tee "$tmplog" || exit_code=$?
      ;;
    codex)
      # Codex needs git repo
      if [[ ! -d ".git" ]]; then
        warn "Codex requires git repo - initializing"
        git init -q
      fi
      timeout "$TIMEOUT" codex exec --full-auto "$FULL_PROMPT" 2>&1 | tee "$tmplog" || exit_code=$?
      ;;
    pi)
      timeout "$TIMEOUT" pi -p "$FULL_PROMPT" 2>&1 | tee "$tmplog" || exit_code=$?
      ;;
  esac
  
  LAST_OUTPUT=$(cat "$tmplog")
  rm -f "$tmplog"
  return $exit_code
}

# Verification phase
run_verify() {
  log "Running verification..."
  local failed=false
  
  case "$PROJECT_TYPE" in
    npm|pnpm|yarn|bun)
      # Try lint
      if grep -q '"lint"' package.json 2>/dev/null; then
        log "Running lint..."
        case "$PROJECT_TYPE" in
          npm)  npm run lint 2>&1 || failed=true ;;
          pnpm) pnpm lint 2>&1 || failed=true ;;
          yarn) yarn lint 2>&1 || failed=true ;;
          bun)  bun run lint 2>&1 || failed=true ;;
        esac
      fi
      # Try test
      if grep -q '"test"' package.json 2>/dev/null; then
        log "Running tests..."
        case "$PROJECT_TYPE" in
          npm)  npm test 2>&1 || failed=true ;;
          pnpm) pnpm test 2>&1 || failed=true ;;
          yarn) yarn test 2>&1 || failed=true ;;
          bun)  bun test 2>&1 || failed=true ;;
        esac
      fi
      # Try build
      if grep -q '"build"' package.json 2>/dev/null; then
        log "Running build..."
        case "$PROJECT_TYPE" in
          npm)  npm run build 2>&1 || failed=true ;;
          pnpm) pnpm build 2>&1 || failed=true ;;
          yarn) yarn build 2>&1 || failed=true ;;
          bun)  bun run build 2>&1 || failed=true ;;
        esac
      fi
      ;;
    cargo)
      log "Running cargo check..."
      cargo check 2>&1 || failed=true
      log "Running cargo test..."
      cargo test 2>&1 || failed=true
      ;;
    go)
      log "Running go vet..."
      go vet ./... 2>&1 || failed=true
      log "Running go test..."
      go test ./... 2>&1 || failed=true
      ;;
    python)
      if command -v ruff &>/dev/null; then
        log "Running ruff..."
        ruff check . 2>&1 || failed=true
      fi
      if command -v pytest &>/dev/null; then
        log "Running pytest..."
        pytest 2>&1 || failed=true
      fi
      ;;
  esac
  
  if [[ "$failed" == "true" ]]; then
    warn "Verification had failures"
    return 1
  fi
  ok "Verification passed"
  return 0
}

# Main execution with retry
LAST_OUTPUT=""
SUCCESS=false
ATTEMPT=1

while [[ $ATTEMPT -le $MAX_RETRIES ]]; do
  if run_agent $ATTEMPT; then
    SUCCESS=true
    break
  else
    warn "Agent failed on attempt $ATTEMPT"
    if [[ $ATTEMPT -lt $MAX_RETRIES ]]; then
      log "Retrying in 5 seconds..."
      sleep 5
      # Adjust prompt for retry
      FULL_PROMPT="$FULL_PROMPT

Note: Previous attempt failed. Please try again carefully."
    fi
  fi
  ((ATTEMPT++))
done

# Run verification if requested
VERIFY_PASSED=true
if [[ "$VERIFY" == "true" && "$SUCCESS" == "true" ]]; then
  run_verify || VERIFY_PASSED=false
fi

# Output result
if [[ "$JSON_OUTPUT" == "true" ]]; then
  # Parse output with our parser (if available)
  SCRIPT_DIR="$(dirname "$(realpath "$0")")"
  if [[ -f "$SCRIPT_DIR/parse-output.cjs" ]]; then
    echo "$LAST_OUTPUT" | node "$SCRIPT_DIR/parse-output.cjs"
  else
    # Fallback to basic JSON
    cat <<EOF
{
  "success": $( [[ "$SUCCESS" == "true" && "$VERIFY_PASSED" == "true" ]] && echo "true" || echo "false" ),
  "agent": "$AGENT",
  "projectType": "$PROJECT_TYPE",
  "attempts": $ATTEMPT,
  "verified": $( [[ "$VERIFY" == "true" ]] && echo "true" || echo "false" ),
  "verifyPassed": $( [[ "$VERIFY_PASSED" == "true" ]] && echo "true" || echo "false" )
}
EOF
  fi
else
  # Just output raw
  if [[ "$SUCCESS" == "true" ]]; then
    ok "Task completed successfully"
  else
    err "Task failed after $MAX_RETRIES attempts"
    exit 1
  fi
fi
