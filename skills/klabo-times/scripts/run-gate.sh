#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${1:-/tmp/klabo-times}"
STRICT_FLAG="${2:-}"

if ! command -v pdftoppm >/dev/null 2>&1; then
  echo "Gate error: pdftoppm is required (poppler-utils)"
  exit 2
fi

FRONT_PDF="$OUTPUT_DIR/front.pdf"
BACK_PDF="$OUTPUT_DIR/back.pdf"

if [[ ! -f "$FRONT_PDF" || ! -f "$BACK_PDF" ]]; then
  echo "Gate error: missing front/back PDFs in $OUTPUT_DIR"
  exit 2
fi

FRONT_PGM="$OUTPUT_DIR/front-gate.pgm"
BACK_PGM="$OUTPUT_DIR/back-gate.pgm"

pdftoppm -gray -r 150 -singlefile "$FRONT_PDF" "${FRONT_PGM%.pgm}" >/dev/null
pdftoppm -gray -r 150 -singlefile "$BACK_PDF" "${BACK_PGM%.pgm}" >/dev/null

echo "Gate: checking front page"
python3 "$SCRIPT_DIR/layout_gate.py" "$FRONT_PGM" $STRICT_FLAG --columns 0

echo "Gate: checking back page"
python3 "$SCRIPT_DIR/layout_gate.py" "$BACK_PGM" $STRICT_FLAG --columns 0
