#!/bin/bash
# Use YunJhe's first "AI" clip to replace the second one

OUTPUT_DIR="/Users/sulaxd/clawd/skills/threads-video/output"
CLIPS_DIR="/Users/sulaxd/clawd/skills/threads-video/clips"
YUNJHE="$OUTPUT_DIR/voice_yunjhe.mp3"
AI_CLIP="$CLIPS_DIR/yunjhe_AI.mp3"
OUTPUT="$OUTPUT_DIR/voice_clipped.mp3"
TMP="$OUTPUT_DIR/tmp_clip"

mkdir -p "$TMP"

echo "🎯 Using YunJhe's first AI clip to replace second AI..."
echo "   AI clip: $AI_CLIP (0.22s)"
echo ""
echo "   YunJhe timestamps:"
echo "   - First AI: 0.70-0.92s (KEEP)"
echo "   - Second AI: 6.36-6.72s (REPLACE with clip)"

# Split YunJhe
echo ""
echo "🔪 Splitting..."
# Part 1: 0 - 6.36s (everything before second AI)
ffmpeg -y -i "$YUNJHE" -ss 0 -t 6.36 -acodec libmp3lame -ar 44100 "$TMP/part1.mp3" 2>/dev/null
# Part 2: 6.72s - end (everything after second AI)
ffmpeg -y -i "$YUNJHE" -ss 6.72 -acodec libmp3lame -ar 44100 "$TMP/part2.mp3" 2>/dev/null

echo "🔧 Concatenating with AI clip..."
cat > "$TMP/list.txt" << EOF
file 'part1.mp3'
file '$AI_CLIP'
file 'part2.mp3'
EOF

ffmpeg -y -f concat -safe 0 -i "$TMP/list.txt" -acodec libmp3lame -ar 44100 "$OUTPUT" 2>/dev/null

rm -rf "$TMP"

echo ""
echo "✅ Done! $OUTPUT"
ls -la "$OUTPUT"
echo ""
echo "📏 Duration:"
ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$OUTPUT"
