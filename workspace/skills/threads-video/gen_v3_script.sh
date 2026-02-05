#!/bin/bash
set -e

SKILL_DIR="/Users/sulaxd/clawd/skills/threads-video"
OUTPUT_DIR="${SKILL_DIR}/output"
BGM_FILE="${SKILL_DIR}/assets/bgm.mp3"
VOICE_FILE="$OUTPUT_DIR/voice_v3_script.mp3"
FONT="/System/Library/Fonts/STHeiti Medium.ttc"
WIDTH=1080
HEIGHT=1920

WORK_DIR=$(mktemp -d)
trap "rm -rf $WORK_DIR" EXIT

echo "🎤 Processing voice..."

ffmpeg -y -i "$VOICE_FILE" \
    -af "aecho=0.8:0.7:40:0.3,loudnorm=I=-16:TP=-1.5:LRA=11" \
    "$WORK_DIR/voice_processed.mp3" 2>/dev/null

ffmpeg -y \
    -i "$WORK_DIR/voice_processed.mp3" \
    -i "$BGM_FILE" \
    -filter_complex "[1:a]volume=0.15[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[out]" \
    -map "[out]" \
    "$WORK_DIR/voice_mixed.mp3" 2>/dev/null

echo "🎨 Generating images..."

NORMAL=72
EMPHASIS=96

# v3 script - 4 sentences, punchy
magick -size ${WIDTH}x${HEIGHT} xc:black -font "$FONT" -pointsize $NORMAL -fill white -gravity center -annotate +0+0 "你用 AI 省下的時間\n最後都去刷抖音了" "$WORK_DIR/s1.png"
magick -size ${WIDTH}x${HEIGHT} xc:black -font "$FONT" -pointsize $EMPHASIS -fill white -gravity center -annotate +0+0 "別騙自己" "$WORK_DIR/s2.png"
magick -size ${WIDTH}x${HEIGHT} xc:black -font "$FONT" -pointsize $NORMAL -fill white -gravity center -annotate +0+0 "AI 不是讓你變強\n是讓你更會逃避" "$WORK_DIR/s3.png"
magick -size ${WIDTH}x${HEIGHT} xc:black -font "$FONT" -pointsize $EMPHASIS -fill white -gravity center -annotate +0+0 "真正的用法？\n買回注意力\n不是時間" "$WORK_DIR/s4.png"

echo "🎬 Creating segments..."

create_seg() {
    local img=$1
    local out=$2
    local dur=$3
    local frames=$(echo "$dur * 30" | bc | cut -d. -f1)
    
    ffmpeg -y -loop 1 -i "$img" -t $dur -r 30 \
        -vf "scale=8000:-1,zoompan=z='min(zoom+0.0003,1.05)':d=$frames:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${WIDTH}x${HEIGHT},fade=t=in:st=0:d=0.3,fade=t=out:st=$(echo "$dur - 0.3" | bc):d=0.3" \
        -c:v libx264 -pix_fmt yuv420p "$out" 2>/dev/null
}

# 4 segments, total ~12s
create_seg "$WORK_DIR/s1.png" "$WORK_DIR/v1.mp4" 3.5
create_seg "$WORK_DIR/s2.png" "$WORK_DIR/v2.mp4" 2
create_seg "$WORK_DIR/s3.png" "$WORK_DIR/v3.mp4" 3.5
create_seg "$WORK_DIR/s4.png" "$WORK_DIR/v4.mp4" 4

echo "📦 Concatenating..."

cat > "$WORK_DIR/concat.txt" << EOF
file 'v1.mp4'
file 'v2.mp4'
file 'v3.mp4'
file 'v4.mp4'
EOF

ffmpeg -y -f concat -safe 0 -i "$WORK_DIR/concat.txt" -c copy "$WORK_DIR/video.mp4" 2>/dev/null

echo "🔊 Final merge..."

ffmpeg -y \
    -i "$WORK_DIR/video.mp4" \
    -i "$WORK_DIR/voice_mixed.mp3" \
    -c:v copy \
    -c:a aac -b:a 128k \
    -shortest \
    "$OUTPUT_DIR/video-02-v3-final.mp4" 2>/dev/null

echo ""
echo "✅ Done!"
ls -lh "$OUTPUT_DIR/video-02-v3-final.mp4"
