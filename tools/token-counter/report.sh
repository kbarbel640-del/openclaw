#!/bin/bash
# Quick token report - call with: ./report.sh "input" "output" tool_count
# Or just: ./report.sh report

TOOL_DIR="$HOME/.openclaw/tools/token-counter"

if [ "$1" = "report" ]; then
    node "$TOOL_DIR/track.js" --report
elif [ "$1" = "init" ]; then
    node "$TOOL_DIR/track.js" --init
elif [ "$#" -ge 2 ]; then
    INPUT="$1"
    OUTPUT="$2"
    TOOLS="${3:-1}"
    
    node "$TOOL_DIR/track.js" --add-input "$INPUT" 2>/dev/null
    node "$TOOL_DIR/track.js" --add-output "$OUTPUT" 2>/dev/null
    node "$TOOL_DIR/track.js" --add-tool "$TOOLS" 2>/dev/null
    node "$TOOL_DIR/track.js" --report
else
    node "$TOOL_DIR/track.js" --report
fi
