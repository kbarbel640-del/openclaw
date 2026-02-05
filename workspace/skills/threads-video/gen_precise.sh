#!/bin/bash
# Precise timing based on Whisper transcription
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

echo "🎨 Generating 7 images (matching Whisper segments)..."

NORMAL=72
EMPHASIS=96

# Whisper timing:
# [00:00.000 --> 00:02.980] 你用AI省下的时间最后都去刷抖音了
# [00:02.980 --> 00:04.760] 别骗自己
# [00:04.760 --> 00:07.100] AI不是让你变强
# [00:07.100 --> 00:08.460] 是让你更会逃避
# [00:08.460 --> 00:10.440] 真正的用法
# [00:10.440 --> 00:12.280] 买回注意力
# [00:12.280 --> 00:13.240] 不是时间

magick -size ${WIDTH}x${HEIGHT} xc:black -font "$FONT" -pointsize $NORMAL -fill white -gravity center -annotate +0+0 "你用 AI 省下的時間\n最後都去刷抖音了" "$WORK_DIR/s1.png"
magick -size ${WIDTH}x${HEIGHT} xc:black -font "$FONT" -pointsize $EMPHASIS -fill white -gravity center -annotate +0+0 "別騙自己" "$WORK_DIR/s2.png"
magick -size ${WIDTH}x${HEIGHT} xc:black -font "$FONT" -pointsize $NORMAL -fill white -gravity center -annotate +0+0 "AI 不是讓你變強" "$WORK_DIR/s3.png"
magick -size ${WIDTH}x${HEIGHT} xc:black -font "$FONT" -pointsize $NORMAL -fill white -gravity center -annotate +0+0 "是讓你更會逃避" "$WORK_DIR/s4.png"
magick -size ${WIDTH}x${HEIGHT} xc:black -font "$FONT" -pointsize $NORMAL -fill white -gravity center -annotate +0+0 "真正的用法？" "$WORK_DIR/s5.png"
magick -size ${WIDTH}x${HEIGHT} xc:black -font "$FONT" -pointsize $EMPHASIS -fill white -gravity center -annotate +0+0 "買回注意力" "$WORK_DIR/s6.png"
magick -size ${WIDTH}x${HEIGHT} xc:black -font "$FONT" -pointsize $EMPHASIS -fill white -gravity center -annotate +0+0 "不是時間" "$WORK_DIR/s7.png"

echo "🎬 Creating 7 PRECISE segments..."

create_seg() {
    local img=$1
    local out=$2
    local dur=$3
    local frames=$(echo "$dur * 30" | bc | cut -d. -f1)
    
    ffmpeg -y -loop 1 -i "$img" -t $dur -r 30 \
        -vf "scale=8000:-1,zoompan=z='min(zoom+0.0002,1.03)':d=$frames:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${WIDTH}x${HEIGHT},fade=t=in:st=0:d=0.15,fade=t=out:st=$(echo "$dur - 0.15" | bc):d=0.15" \
        -c:v libx264 -pix_fmt yuv420p "$out" 2>/dev/null
}

# Exact durations from Whisper
create_seg "$WORK_DIR/s1.png" "$WORK_DIR/v1.mp4" 2.98   # 0-2.98
create_seg "$WORK_DIR/s2.png" "$WORK_DIR/v2.mp4" 1.78   # 2.98-4.76
create_seg "$WORK_DIR/s3.png" "$WORK_DIR/v3.mp4" 2.34   # 4.76-7.10
create_seg "$WORK_DIR/s4.png" "$WORK_DIR/v4.mp4" 1.36   # 7.10-8.46
create_seg "$WORK_DIR/s5.png" "$WORK_DIR/v5.mp4" 1.98   # 8.46-10.44
create_seg "$WORK_DIR/s6.png" "$WORK_DIR/v6.mp4" 1.84   # 10.44-12.28
create_seg "$WORK_DIR/s7.png" "$WORK_DIR/v7.mp4" 1.90   # 12.28-14.18 (extended to end)

echo "📦 Concatenating..."

cat > "$WORK_DIR/concat.txt" << EOF
file 'v1.mp4'
file 'v2.mp4'
file 'v3.mp4'
file 'v4.mp4'
file 'v5.mp4'
file 'v6.mp4'
file 'v7.mp4'
EOF

ffmpeg -y -f concat -safe 0 -i "$WORK_DIR/concat.txt" -c copy "$WORK_DIR/video.mp4" 2>/dev/null

echo "🔊 Final merge..."

ffmpeg -y \
    -i "$WORK_DIR/video.mp4" \
    -i "$WORK_DIR/voice_mixed.mp3" \
    -c:v copy \
    -c:a aac -b:a 128k \
    -shortest \
    "$OUTPUT_DIR/video-02-precise.mp4" 2>/dev/null

echo ""
echo "✅ Done!"
ls -lh "$OUTPUT_DIR/video-02-precise.mp4"
