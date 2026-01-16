#!/bin/bash
# Daily weather greeting with Steve image

STEVE_REF="/Users/steve/clawd/assets/steve-full.jpg"
OUTPUT="/tmp/steve-weather-$(date +%Y%m%d).png"

# Step 1: Fetch raw JSON
# Note: I added 'wind_speed_10m' to current to help with dynamic hair/fur movement
RAW_JSON=$(curl -s "https://api.open-meteo.com/v1/forecast?latitude=42.450055&longitude=-71.221305&daily=temperature_2m_min,temperature_2m_max,sunrise,sunset,rain_sum,weather_code&hourly=temperature_2m&current=temperature_2m,precipitation,wind_speed_10m&timezone=America%2FNew_York&forecast_days=1&wind_speed_unit=mph&temperature_unit=fahrenheit&precipitation_unit=inch")

# Step 2: Parse Data & Generate Art Direction with jq
read -d '' DISPLAY_TEXT ART_PROMPT <<EOF
$(echo "$RAW_JSON" | jq -r '
  .current as $curr |
  .daily as $day |
  ($day.weather_code[0] | tostring) as $code |

  # --- LOGIC: CREATE VISUAL ATMOSPHERE ---
  
  # 1. Temperature Visuals
  (if $curr.temperature_2m < 45 then "steam rising visibly from the hot coffee cup, frosty breath visible in the air, cozy atmosphere"
   elif $curr.temperature_2m > 80 then "bright heat haze, sun flare, ice cubes in the coffee cup"
   else "steam gently rising from the coffee" end) as $temp_viz |

  # 2. Weather Condition Visuals (Lighting & Texture)
  (if $code == "0" or $code == "1" then "bathed in warm golden morning sunlight, casting long dramatic shadows, vibrant colors"
   elif $code == "2" or $code == "3" then "soft diffused lighting from overhead clouds, no harsh shadows, balanced exposure"
   elif ($code | tonumber) >= 51 and ($code | tonumber) <= 67 then "glossy wet ground reflections, raindrops falling, damp fur texture"
   elif ($code | tonumber) >= 71 and ($code | tonumber) <= 77 then "soft snowflakes resting on his fur and hoodie, snowy background, magical winter atmosphere"
   elif ($code | tonumber) >= 95 then "dramatic dark storm clouds in background, cinematic lighting"
   else "outdoor morning lighting" end) as $weather_viz |

  # 3. Wind Visuals
  (if $curr.wind_speed_10m > 12 then "fur and hoodie strings blowing in the wind"
   else "still air" end) as $wind_viz |

  # --- OUTPUTS ---

  # Output 1: Human Readable Text
  "Condition:    \($code)
Current Temp: \($curr.temperature_2m)°F
High/Low:     \($day.temperature_2m_max[0])°F / \($day.temperature_2m_min[0])°F
Rain Today:   \($day.rain_sum[0]) in",

  # Output 2: The Art Prompt (concatenating the visuals)
  "\($weather_viz), \($temp_viz), \($wind_viz)"
')
EOF

# Separate the jq output (Head is text, Tail is art prompt)
# Note: This split relies on the specific line count or a delimiter. 
# A safer way using the read variable above is to just take the last line as prompt.
REAL_PROMPT=$(echo "$ART_PROMPT" | tail -n 1)
TEXT_REPORT=$(echo "$DISPLAY_TEXT" | head -n 4) 

# Step 3: Generate Image
# I replaced "$DATE time of day" (which renders as "20230101 time of day") with "early morning"
uv run /Users/steve/clawd/skills/nano-banana-pro/scripts/generate_image.py \
  --input-image "$STEVE_REF" \
  --prompt "Transform this character into a scene: Steve, the fox with taupe fur, somewhat brownish and somewhat grayish. He has no tail, and blue eyes that perfectly match the color of his blue hoodie. He wears cargo khakis if you can see his legs. Use the reference image. He is sitting outside in Lexington, MA. The scene features: $REAL_PROMPT. It is early morning. He has a friendly welcoming expression and pose, holding a cup of coffee, 3D Pixar-style." \
  --filename "$OUTPUT" > /dev/null 2>&1

# Step 4: Final Output
if [ -f "$OUTPUT" ]; then
  echo "🌤️ Good morning! Here is the weather for Lexington:"
  echo "$TEXT_REPORT"
  echo "MEDIA:$OUTPUT"
else
  echo "Error generating image."
fi