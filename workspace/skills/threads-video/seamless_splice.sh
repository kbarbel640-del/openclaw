#!/bin/bash
# Seamless audio splice using ffmpeg filter_complex
# This avoids the "pop" sound from simple concat

OUTPUT_DIR="/Users/sulaxd/clawd/skills/threads-video/output"
CLIPS_DIR="/Users/sulaxd/clawd/skills/threads-video/clips"
YUNJHE="$OUTPUT_DIR/voice_yunjhe.mp3"
AI_CLIP="$CLIPS_DIR/yunjhe_AI.mp3"
OUTPUT="$OUTPUT_DIR/voice_seamless.mp3"

echo "🎯 Seamless splice using filter_complex..."
echo ""

# YunJhe timestamps:
# - First AI: 0.70-0.92s (0.22s) - KEEP
# - Second AI: 6.36-6.72s (0.36s) - REPLACE with first AI clip

# Using filter_complex to:
# 1. Take 0-6.36s from original
# 2. Insert the AI clip with crossfade
# 3. Take 6.72-end from original with crossfade

# First, let's create the segments properly
echo "📦 Creating segments..."

# Segment 1: 0 to 6.36s (before second AI)
ffmpeg -y -i "$YUNJHE" -af "afade=t=out:st=6.30:d=0.06" -ss 0 -t 6.36 -acodec pcm_s16le -ar 44100 "$OUTPUT_DIR/seg1.wav" 2>/dev/null

# AI clip with fade in/out for smooth transition
ffmpeg -y -i "$AI_CLIP" -af "afade=t=in:st=0:d=0.02,afade=t=out:st=0.18:d=0.04" -acodec pcm_s16le -ar 44100 "$OUTPUT_DIR/ai_faded.wav" 2>/dev/null

# Segment 2: 6.72 to end (after second AI) with fade in
ffmpeg -y -i "$YUNJHE" -af "afade=t=in:st=0:d=0.06" -ss 6.72 -acodec pcm_s16le -ar 44100 "$OUTPUT_DIR/seg2.wav" 2>/dev/null

echo "🔗 Concatenating with filter_complex..."

# Use filter_complex for seamless concat
ffmpeg -y \
  -i "$OUTPUT_DIR/seg1.wav" \
  -i "$OUTPUT_DIR/ai_faded.wav" \
  -i "$OUTPUT_DIR/seg2.wav" \
  -filter_complex "[0:a][1:a][2:a]concat=n=3:v=0:a=1[out]" \
  -map "[out]" \
  -acodec libmp3lame -ar 44100 -b:a 192k \
  "$OUTPUT" 2>/dev/null

# Cleanup
rm -f "$OUTPUT_DIR/seg1.wav" "$OUTPUT_DIR/seg2.wav" "$OUTPUT_DIR/ai_faded.wav"

echo ""
echo "✅ Done! $OUTPUT"
ls -la "$OUTPUT"
echo ""
echo "📏 Duration:"
ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$OUTPUT"
