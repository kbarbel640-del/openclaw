#!/bin/bash
# Klabo Times Daily Newspaper Generator
# Generates front and back pages, converts to PDF, optionally prints

set -euo pipefail

SKILL_DIR="$(dirname "$(dirname "$(realpath "$0")")")"
OUTPUT_DIR="${OUTPUT_DIR:-/tmp/klabo-times}"
PRINTER="Brother_HL_L2370DW_series"
DATE_FULL="$(date +"%A, %B %-d, %Y")"
EDITION="$(date +"%j")"
TODAY_STAMP="$(date +%Y%m%d)"

COMMAND="${1:-print}"
shift || true

RUN_GATE=1
STRICT_FLAG=""
STYLE="classic"
STYLE_SET="single"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-gate)
      RUN_GATE=0
      shift
      ;;
    --strict)
      STRICT_FLAG="--strict"
      shift
      ;;
    --style)
      STYLE="${2:-classic}"
      shift 2
      ;;
    --styles)
      STYLE_SET="${2:-single}"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

mkdir -p "$OUTPUT_DIR"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing dependency: $1"
    exit 2
  fi
}

find_chromium() {
  if command -v chromium >/dev/null 2>&1; then
    echo "chromium"
  elif command -v chromium-browser >/dev/null 2>&1; then
    echo "chromium-browser"
  elif command -v google-chrome >/dev/null 2>&1; then
    echo "google-chrome"
  else
    return 1
  fi
}

fetch_weather() {
  local raw
  raw=$(curl -s "wttr.in/Petaluma?format=%t|%h|%w" 2>/dev/null || true)
  if [[ -z "$raw" ]]; then
    echo "Check weather app|--|--"
    return
  fi
  echo "$raw"
}

fetch_bitcoin() {
  if ! command -v jq >/dev/null 2>&1; then
    echo "N/A|N/A"
    return
  fi
  local price
  local height
  price=$(curl -s "https://mempool.space/api/v1/prices" 2>/dev/null | jq -r '.USD // "N/A"')
  height=$(curl -s "https://mempool.space/api/blocks/tip/height" 2>/dev/null || echo "N/A")
  echo "$price|$height"
}

render_pdf() {
  local html_file="$1"
  local pdf_file="$2"
  local chromium_bin
  chromium_bin=$(find_chromium) || { echo "Missing dependency: chromium"; exit 2; }

  "$chromium_bin" \
    --headless \
    --disable-gpu \
    --disable-extensions \
    --disable-background-networking \
    --disable-sync \
    --disable-translate \
    --disable-features=TranslateUI \
    --no-first-run \
    --no-default-browser-check \
    --disable-renderer-backgrounding \
    --disable-backgrounding-occluded-windows \
    --disable-breakpad \
    --metrics-recording-only \
    --disable-ipc-flooding-protection \
    --run-all-compositor-stages-before-draw \
    --disable-threaded-animation \
    --disable-threaded-scrolling \
    --font-render-hinting=none \
    --print-to-pdf="$pdf_file" \
    --no-pdf-header-footer \
    "file://$html_file" >/dev/null 2>&1
}

case "$COMMAND" in
  schedule)
    echo "Add to crontab: 0 6 * * * $0 print"
    exit 0
    ;;
  preview|print)
    ;;
  *)
    echo "Usage: $0 [preview|print|schedule] [--no-gate] [--strict]"
    exit 1
    ;;
esac

weather_raw=$(fetch_weather)
weather_temp=$(echo "$weather_raw" | cut -d'|' -f1)
weather_humidity=$(echo "$weather_raw" | cut -d'|' -f2)
weather_wind=$(echo "$weather_raw" | cut -d'|' -f3)

btc_data=$(fetch_bitcoin)
btc_price=$(echo "$btc_data" | cut -d'|' -f1)
btc_height=$(echo "$btc_data" | cut -d'|' -f2)

sats_per_dollar=$(python3 - <<PY
value = "$btc_price"
try:
    price = float(value.replace(",", ""))
except Exception:
    print("N/A")
else:
    print(int(100000000 / price) if price > 0 else "N/A")
PY
)

LOCATION="Petaluma, California"

export OUTPUT_DIR DATE_FULL EDITION LOCATION
export weather_temp weather_humidity weather_wind
export btc_price btc_height sats_per_dollar
export STYLE

build_one() {
  local style="$1"
  local suffix="$2"

  export STYLE="$style"

  python3 - <<'PY'
import json
import os
from pathlib import Path

output_path = Path(os.environ["OUTPUT_DIR"]) / "data.json"

payload = {
  "date": os.environ.get("DATE_FULL", ""),
  "edition": int(os.environ.get("EDITION", "1")),
  "location": os.environ.get("LOCATION", ""),
  "style": os.environ.get("STYLE", "classic"),
  "weather": {
    "summary": os.environ.get("weather_temp", ""),
    "humidity": os.environ.get("weather_humidity", ""),
    "wind": os.environ.get("weather_wind", "")
  },
  "bitcoin": {
    "price": os.environ.get("btc_price", "N/A"),
    "height": os.environ.get("btc_height", "N/A"),
    "sats": os.environ.get("sats_per_dollar", "N/A")
  },
  "honklab": [
    "Bitcoin Node: Syncing",
    "Machines Online: 6/6",
    "Skills Synced: OK",
    "Printer: Ready"
  ]
}

with output_path.open("w", encoding="utf-8") as f:
    arrow_chars = "←→↔↙↘↖↗"
    wind = payload["weather"]["wind"]
    if wind:
        for ch in arrow_chars:
            wind = wind.replace(ch, "")
        payload["weather"]["wind"] = " ".join(wind.split())
    json.dump(payload, f, indent=2)
PY

  python3 "$SKILL_DIR/scripts/layout_engine.py" \
    --data "$OUTPUT_DIR/data.json" \
    --library "$SKILL_DIR/content/library.json" \
    --output "$OUTPUT_DIR"

  render_pdf "$OUTPUT_DIR/front.html" "$OUTPUT_DIR/front.pdf"
  render_pdf "$OUTPUT_DIR/back.html" "$OUTPUT_DIR/back.pdf"

  if [[ "$RUN_GATE" == "1" ]]; then
    "$SKILL_DIR/scripts/run-gate.sh" "$OUTPUT_DIR" "$STRICT_FLAG"
  fi

  local output_pdf="$OUTPUT_DIR/klabo-times-$TODAY_STAMP${suffix}.pdf"
  if command -v pdfunite >/dev/null 2>&1; then
    pdfunite "$OUTPUT_DIR/front.pdf" "$OUTPUT_DIR/back.pdf" "$output_pdf"
  else
    cp "$OUTPUT_DIR/front.pdf" "$output_pdf"
    echo "Note: pdfunite not found. Combined PDF contains only the front page."
  fi

  LAST_OUTPUT_PDF="$output_pdf"
}

if [[ "$STYLE_SET" == "both" ]]; then
  if [[ "$COMMAND" == "print" ]]; then
    echo "Style set 'both' not supported for print. Using --style $STYLE."
    STYLE_SET="single"
  else
    build_one "classic" "-classic"
    pdf_classic="$LAST_OUTPUT_PDF"
    build_one "tabloid" "-tabloid"
    pdf_tabloid="$LAST_OUTPUT_PDF"
    echo "Preview generated: $pdf_classic"
    echo "Preview generated: $pdf_tabloid"
    exit 0
  fi
fi

build_one "$STYLE" ""
output_pdf="$LAST_OUTPUT_PDF"

if [[ "$COMMAND" == "print" ]]; then
  if command -v pdfunite >/dev/null 2>&1; then
    lp -d "$PRINTER" -o sides=two-sided-long-edge "$output_pdf"
  else
    echo "Printing front and back separately (pdfunite not available)."
    lp -d "$PRINTER" "$OUTPUT_DIR/front.pdf"
    lp -d "$PRINTER" "$OUTPUT_DIR/back.pdf"
  fi
else
  echo "Preview generated: $output_pdf"
fi
