#!/bin/bash
# Correct splice with EXACT word timestamps from whisper

OUTPUT_DIR="/Users/sulaxd/clawd/skills/threads-video/output"
GEORGE="$OUTPUT_DIR/voice_elevenlabs.mp3"
YUNJHE="$OUTPUT_DIR/voice_yunjhe.mp3"
OUTPUT="$OUTPUT_DIR/voice_correct.mp3"
TMP="$OUTPUT_DIR/tmp_correct"

mkdir -p "$TMP"

echo "🎯 Using EXACT word timestamps from whisper..."
echo "   YunJhe AI #1: 0.70-0.92s"
echo "   YunJhe AI #2: 6.36-6.72s"

# First, get George's AI timestamps
# From earlier analysis: George first AI around 0.40-0.70s
echo ""
echo "🔪 Extracting George's AI pronunciations..."
ffmpeg -y -i "$GEORGE" -ss 0.40 -t 0.25 -acodec libmp3lame -ar 44100 "$TMP/g_ai1.mp3" 2>/dev/null
ffmpeg -y -i "$GEORGE" -ss 5.05 -t 0.30 -acodec libmp3lame -ar 44100 "$TMP/g_ai2.mp3" 2>/dev/null

echo "🔪 Splitting YunJhe with CORRECT timestamps..."
# Part 1: "你用" (0 - 0.70s)
ffmpeg -y -i "$YUNJHE" -ss 0 -t 0.70 -acodec libmp3lame -ar 44100 "$TMP/y1.mp3" 2>/dev/null
# Part 2: "省下的時間...別騙自己" (0.92 - 6.36s)
ffmpeg -y -i "$YUNJHE" -ss 0.92 -t 5.44 -acodec libmp3lame -ar 44100 "$TMP/y2.mp3" 2>/dev/null
# Part 3: "不是讓你變強..." (6.72 - end)
ffmpeg -y -i "$YUNJHE" -ss 6.72 -acodec libmp3lame -ar 44100 "$TMP/y3.mp3" 2>/dev/null

echo "🔧 Concatenating..."
cat > "$TMP/list.txt" << EOF
file 'y1.mp3'
file 'g_ai1.mp3'
file 'y2.mp3'
file 'g_ai2.mp3'
file 'y3.mp3'
EOF

ffmpeg -y -f concat -safe 0 -i "$TMP/list.txt" -acodec libmp3lame -ar 44100 "$OUTPUT" 2>/dev/null

rm -rf "$TMP"

echo ""
echo "✅ Done! $OUTPUT"
ls -la "$OUTPUT"

# Verify with ffprobe
echo ""
echo "📏 Duration:"
ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$OUTPUT"
