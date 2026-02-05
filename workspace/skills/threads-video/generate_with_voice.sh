#!/bin/bash
# Generate video with provided voice file
set -e

SKILL_DIR="/Users/sulaxd/clawd/skills/threads-video"
OUTPUT_DIR="${SKILL_DIR}/output"
BGM_FILE="${SKILL_DIR}/assets/bgm.mp3"
FONT="/System/Library/Fonts/STHeiti Medium.ttc"
WIDTH=1080
HEIGHT=1920

VOICE_FILE="$1"
OUTPUT_NAME="$2"

if [ -z "$VOICE_FILE" ] || [ -z "$OUTPUT_NAME" ]; then
    echo "Usage: $0 voice_file.mp3 output_name"
    exit 1
fi

WORK_DIR=$(mktemp -d)
trap "rm -rf $WORK_DIR" EXIT

echo "🎤 Processing voice..."
VOICE_DURATION=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$VOICE_FILE")
echo "   Duration: ${VOICE_DURATION}s"

# Audio processing
ffmpeg -y -i "$VOICE_FILE" \
    -af "aecho=0.8:0.7:40:0.3,loudnorm=I=-16:TP=-1.5:LRA=11" \
    "$WORK_DIR/voice_processed.mp3" 2>/dev/null

# Mix with BGM
ffmpeg -y \
    -i "$WORK_DIR/voice_processed.mp3" \
    -i "$BGM_FILE" \
    -filter_complex "[1:a]volume=0.15[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[out]" \
    -map "[out]" \
    "$WORK_DIR/voice_mixed.mp3" 2>/dev/null

FINAL_DURATION=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$WORK_DIR/voice_mixed.mp3")
echo "   Final audio: ${FINAL_DURATION}s"

echo "🎨 Generating images..."

NORMAL=72
EMPHASIS=100

# Subtitles for AI attention content
magick -size ${WIDTH}x${HEIGHT} xc:black -font "$FONT" -pointsize $NORMAL -fill white -gravity center -annotate +0+0 "大部分人覺得\nAI 是省時間的工具" "$WORK_DIR/s1.png"
magick -size ${WIDTH}x${HEIGHT} xc:black -font "$FONT" -pointsize $NORMAL -fill white -gravity center -annotate +0+0 "但其實..." "$WORK_DIR/s2.png"
magick -size ${WIDTH}x${HEIGHT} xc:black -font "$FONT" -pointsize $NORMAL -fill white -gravity center -annotate +0+0 "時間省下來\n你還是會拿去刷手機" "$WORK_DIR/s3.png"
magick -size ${WIDTH}x${HEIGHT} xc:black -font "$FONT" -pointsize $EMPHASIS -fill white -gravity center -annotate +0+0 "AI 真正的價值\n不是省時間" "$WORK_DIR/s4.png"
magick -size ${WIDTH}x${HEIGHT} xc:black -font "$FONT" -pointsize $EMPHASIS -fill white -gravity center -annotate +0+0 "是買回\n你的注意力" "$WORK_DIR/s5.png"
magick -size ${WIDTH}x${HEIGHT} xc:black -font "$FONT" -pointsize $NORMAL -fill white -gravity center -annotate +0+0 "讓你終於可以\n想你真正想想的事" "$WORK_DIR/s6.png"

echo "🎬 Creating segments..."

# Timing: total ~15s, 6 segments
# s1: 0-2.5, s2: 2.5-4, s3: 4-7, s4: 7-10, s5: 10-12.5, s6: 12.5-15
create_seg() {
    local img=$1
    local out=$2
    local dur=$3
    local frames=$(echo "$dur * 30" | bc | cut -d. -f1)
    
    ffmpeg -y -loop 1 -i "$img" -t $dur -r 30 \
        -vf "scale=8000:-1,zoompan=z='min(zoom+0.0003,1.05)':d=$frames:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${WIDTH}x${HEIGHT},fade=t=in:st=0:d=0.3,fade=t=out:st=$(echo "$dur - 0.3" | bc):d=0.3" \
        -c:v libx264 -pix_fmt yuv420p "$out" 2>/dev/null
}

create_seg "$WORK_DIR/s1.png" "$WORK_DIR/v1.mp4" 2.5
create_seg "$WORK_DIR/s2.png" "$WORK_DIR/v2.mp4" 1.5
create_seg "$WORK_DIR/s3.png" "$WORK_DIR/v3.mp4" 3
create_seg "$WORK_DIR/s4.png" "$WORK_DIR/v4.mp4" 3
create_seg "$WORK_DIR/s5.png" "$WORK_DIR/v5.mp4" 2.5
create_seg "$WORK_DIR/s6.png" "$WORK_DIR/v6.mp4" 2.5

echo "📦 Concatenating..."

cat > "$WORK_DIR/concat.txt" << EOF
file 'v1.mp4'
file 'v2.mp4'
file 'v3.mp4'
file 'v4.mp4'
file 'v5.mp4'
file 'v6.mp4'
EOF

ffmpeg -y -f concat -safe 0 -i "$WORK_DIR/concat.txt" -c copy "$WORK_DIR/video.mp4" 2>/dev/null

echo "🔊 Final merge..."

ffmpeg -y \
    -i "$WORK_DIR/video.mp4" \
    -i "$WORK_DIR/voice_mixed.mp3" \
    -c:v copy \
    -c:a aac -b:a 128k \
    -shortest \
    "$OUTPUT_DIR/${OUTPUT_NAME}.mp4" 2>/dev/null

echo ""
echo "✅ Done!"
ls -lh "$OUTPUT_DIR/${OUTPUT_NAME}.mp4"
