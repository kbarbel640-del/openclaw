#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ $# -eq 0 ]]; then
  exit 0
fi

run_tool="$ROOT_DIR/scripts/pre-commit/run-node-tool.sh"
for f in "$@"; do
  [[ -f "$f" ]] || continue
  "$run_tool" oxlint --fix -- "$f" 2>/dev/null || true
done
"$run_tool" oxfmt --write -- "$@"
git add -- "$@"
