#!/bin/bash
# Splice using Dofu's AI clip

OUTPUT_DIR="/Users/sulaxd/clawd/skills/threads-video/output"
CLIPS_DIR="/Users/sulaxd/clawd/skills/threads-video/clips"
YUNJHE="$OUTPUT_DIR/voice_yunjhe.mp3"
AI_CLIP="$CLIPS_DIR/dofu_AI.mp3"
OUTPUT="$OUTPUT_DIR/voice_dofu_splice.mp3"

echo "🎯 Using Dofu's AI clip..."

# Segment 1: 0 to 6.36s (before second AI)
ffmpeg -y -i "$YUNJHE" -af "afade=t=out:st=6.30:d=0.06" -ss 0 -t 6.36 -acodec pcm_s16le -ar 44100 "$OUTPUT_DIR/seg1.wav" 2>/dev/null

# Dofu's AI clip with slight fade
ffmpeg -y -i "$AI_CLIP" -af "afade=t=in:st=0:d=0.02,afade=t=out:st=0.26:d=0.04" -acodec pcm_s16le -ar 44100 "$OUTPUT_DIR/ai_faded.wav" 2>/dev/null

# Segment 2: 6.72 to end (after second AI)
ffmpeg -y -i "$YUNJHE" -af "afade=t=in:st=0:d=0.06" -ss 6.72 -acodec pcm_s16le -ar 44100 "$OUTPUT_DIR/seg2.wav" 2>/dev/null

# Concat
ffmpeg -y \
  -i "$OUTPUT_DIR/seg1.wav" \
  -i "$OUTPUT_DIR/ai_faded.wav" \
  -i "$OUTPUT_DIR/seg2.wav" \
  -filter_complex "[0:a][1:a][2:a]concat=n=3:v=0:a=1[out]" \
  -map "[out]" \
  -acodec libmp3lame -ar 44100 -b:a 192k \
  "$OUTPUT" 2>/dev/null

rm -f "$OUTPUT_DIR/seg1.wav" "$OUTPUT_DIR/seg2.wav" "$OUTPUT_DIR/ai_faded.wav"

echo "✅ Done! $OUTPUT"
ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$OUTPUT"
