#!/bin/bash
# Daily weather greeting with Steve image

export GEMINI_API_KEY="AIzaSyAHB0Uo-OkqcxV_c_Cp4iJaZ3e02-sc_7c"

# Step 1: Get weather
WEATHER=$(curl -s "wttr.in/Lexington+MA?format=%C+%t&u")

# Step 2: Generate Steve image (suppress output)
DATE=$(date +%Y%m%d)
OUTPUT="/tmp/steve-weather-$DATE.png"

uv run /Users/steve/clawd/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "Steve the wolf character (gray-brown fur, blue eyes, navy hoodie, 3D Pixar-style) standing outside in $WEATHER weather, friendly morning expression, warm lighting" \
  --filename "$OUTPUT" > /dev/null 2>&1

# Step 3: Output clean result
if [ -f "$OUTPUT" ]; then
  echo "🌤️ Good morning! $WEATHER in Lexington"
  echo "MEDIA:$OUTPUT"
else
  echo "🌤️ Good morning! $WEATHER in Lexington"
fi
