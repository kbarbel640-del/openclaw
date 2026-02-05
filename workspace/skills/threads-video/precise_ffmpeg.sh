#!/bin/bash
# Precise replacement using ffmpeg with millisecond accuracy

OUTPUT_DIR="/Users/sulaxd/clawd/skills/threads-video/output"
GEORGE="$OUTPUT_DIR/voice_elevenlabs.mp3"
YUNJHE="$OUTPUT_DIR/voice_yunjhe.mp3"
OUTPUT="$OUTPUT_DIR/voice_precise.mp3"
TMP="$OUTPUT_DIR/tmp_precise"

mkdir -p "$TMP"

echo "🔪 Extracting segments with precise timing..."

# George's AI (ms accuracy)
# First AI: 400-700ms
ffmpeg -y -i "$GEORGE" -ss 0.400 -t 0.300 -acodec libmp3lame -ar 44100 "$TMP/g_ai1.mp3" 2>/dev/null
# Second AI: 5050-5350ms  
ffmpeg -y -i "$GEORGE" -ss 5.050 -t 0.300 -acodec libmp3lame -ar 44100 "$TMP/g_ai2.mp3" 2>/dev/null

# YunJhe parts (excluding his AI completely)
# Part 1: 你用 (0-500ms)
ffmpeg -y -i "$YUNJHE" -ss 0 -t 0.500 -acodec libmp3lame -ar 44100 "$TMP/y1.mp3" 2>/dev/null
# Part 2: 省下的時間...別騙自己 (850-5240ms)
ffmpeg -y -i "$YUNJHE" -ss 0.850 -t 4.390 -acodec libmp3lame -ar 44100 "$TMP/y2.mp3" 2>/dev/null
# Part 3: 不是讓你變強...結尾 (5600ms-end)
ffmpeg -y -i "$YUNJHE" -ss 5.600 -acodec libmp3lame -ar 44100 "$TMP/y3.mp3" 2>/dev/null

echo "🔧 Concatenating..."
cat > "$TMP/list.txt" << EOF
file 'y1.mp3'
file 'g_ai1.mp3'
file 'y2.mp3'
file 'g_ai2.mp3'
file 'y3.mp3'
EOF

ffmpeg -y -f concat -safe 0 -i "$TMP/list.txt" -acodec libmp3lame -ar 44100 "$OUTPUT" 2>/dev/null

# Cleanup
rm -rf "$TMP"

echo "✅ Done! $OUTPUT"
ls -la "$OUTPUT"
