#!/bin/bash

# Ensure fnm/node PATH is available for gemini CLI
export PATH="/home/almaz/.local/share/fnm/node-versions/v22.21.1/installation/bin:$PATH"

# Enable error handling
set -e  # Exit on error
set -o pipefail  # Catch errors in pipelines

# Default values
MODEL="gemini-3-flash-preview"
OUTPUT_FORMAT="json"
SCRIPT_TIMEOUT=90  # Script-level timeout as safety net

# Debug logging (only if DEBUG env var is set)
[ -n "$DEBUG" ] && echo "[DEBUG] Script started with query" >&2

# Pre-flight check: Verify gemini CLI is accessible and configured
gemini --version >/dev/null 2>&1 || {
  echo "Error: gemini CLI not found or not configured" >&2
  exit 10
}

# Parse arguments
QUERY=""
while [[ $# -gt 0 ]]; do
  case $1 in
    -m|--model)
      MODEL="$2"
      shift 2
      ;;
    -o|--output-format)
      OUTPUT_FORMAT="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [options] 'Your question'"
      echo "Options:"
      echo "  -m, --model <model>          Model to use (default: $MODEL)"
      echo "  -o, --output-format <format> Output format (default: $OUTPUT_FORMAT)"
      exit 0
      ;;
    *)
      if [ -z "$QUERY" ]; then
        QUERY="$1"
      else
        QUERY="$QUERY $1"
      fi
      shift
      ;;
  esac
done

if [ -z "$QUERY" ]; then
  echo "Error: No query provided."
  echo "Usage: $0 [options] 'Your question'"
  exit 1
fi

# Load the specialized prompt tail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PROMPT_FILE="$PROJECT_ROOT/prompts/web-search-tail.yaml"
if [ ! -f "$PROMPT_FILE" ]; then
  echo "Error: Prompt file $PROMPT_FILE not found."
  exit 1
fi

# Extract the prompt_tail value - this TELLS gemini to use web search
TAIL=$(awk '/prompt_tail: \|/{flag=1; next} flag{print; exit}' "$PROMPT_FILE" | sed 's/^  //')

if [ -z "$TAIL" ]; then
  TAIL=$(grep "prompt_tail:" "$PROMPT_FILE" | sed 's/prompt_tail: //' | sed 's/^"//;s/"$//')
fi

# Combine query with the web search instruction
FULL_PROMPT="$QUERY $TAIL"

# Execute gemini CLI using positional argument (one-shot mode)
# IMPORTANT: Use positional args, not -p to avoid interactive mode
# Use timeout to prevent hanging
timeout $SCRIPT_TIMEOUT gemini "$FULL_PROMPT" -m "$MODEL" --output-format "$OUTPUT_FORMAT" 2>&1
EXIT_CODE=$?

# Handle timeout and errors
if [ $EXIT_CODE -eq 124 ]; then
  echo "Error: Search timed out after ${SCRIPT_TIMEOUT} seconds" >&2
  exit 124
elif [ $EXIT_CODE -ne 0 ]; then
  echo "Error: gemini CLI failed with exit code $EXIT_CODE" >&2
  exit $EXIT_CODE
fi
