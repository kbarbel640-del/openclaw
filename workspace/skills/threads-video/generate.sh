#!/bin/bash
# Threads 短影片生成腳本 v3
# Usage: ./generate.sh "你的文字內容" [output_name]
set -e

# === 配置 ===
SKILL_DIR="/Users/sulaxd/clawd/skills/threads-video"
OUTPUT_DIR="${SKILL_DIR}/output"
BGM_FILE="${SKILL_DIR}/assets/bgm.mp3"
FONT="/System/Library/Fonts/STHeiti Medium.ttc"
WIDTH=1080
HEIGHT=1920

# === 參數 ===
INPUT_TEXT="$1"
OUTPUT_NAME="${2:-video-$(date +%Y%m%d-%H%M%S)}"

if [ -z "$INPUT_TEXT" ]; then
    echo "Usage: $0 \"你的文字內容\" [output_name]"
    exit 1
fi

mkdir -p "$OUTPUT_DIR"
WORK_DIR=$(mktemp -d)
trap "rm -rf $WORK_DIR" EXIT

echo "📝 Input: $INPUT_TEXT"
echo "📁 Output: $OUTPUT_DIR/${OUTPUT_NAME}.mp4"
echo ""

# === 1. 生成字幕圖片 ===
echo "🎨 Generating subtitle images..."

# 將輸入文字按句號/問號/感嘆號分割成多行
IFS='。？！' read -ra SENTENCES <<< "$INPUT_TEXT"

NORMAL_SIZE=72
EMPHASIS_SIZE=100
IMG_COUNT=0

for sentence in "${SENTENCES[@]}"; do
    sentence=$(echo "$sentence" | xargs)  # trim
    if [ -n "$sentence" ]; then
        IMG_COUNT=$((IMG_COUNT + 1))
        
        # 最後一句用大字（通常是金句）
        if [ $IMG_COUNT -eq ${#SENTENCES[@]} ] || [ $IMG_COUNT -eq $((${#SENTENCES[@]} - 1)) ]; then
            SIZE=$EMPHASIS_SIZE
        else
            SIZE=$NORMAL_SIZE
        fi
        
        # 長句自動換行（超過10字）
        if [ ${#sentence} -gt 10 ]; then
            # 在中間位置插入換行
            mid=$((${#sentence} / 2))
            sentence="${sentence:0:$mid}\n${sentence:$mid}"
        fi
        
        magick -size ${WIDTH}x${HEIGHT} xc:black \
            -font "$FONT" \
            -pointsize $SIZE \
            -fill white \
            -gravity center \
            -annotate +0+0 "$sentence" \
            "$WORK_DIR/sub_${IMG_COUNT}.png"
        
        echo "   Created: sub_${IMG_COUNT}.png ($sentence)"
    fi
done

# === 2. 生成 TTS ===
echo "🎤 Generating TTS... (using Moltbot tts tool)"
# TTS 需要通過 Moltbot 的 tts 工具生成，這裡假設已經有 voice.mp3
# 實際使用時，這一步由 AI 調用 tts 工具完成

# === 3. 創建視頻片段 ===
echo "🎬 Creating video segments..."

DURATION_PER_SEGMENT=2.5
for i in $(seq 1 $IMG_COUNT); do
    # 最後一段稍長
    if [ $i -eq $IMG_COUNT ]; then
        DUR=3
    else
        DUR=$DURATION_PER_SEGMENT
    fi
    
    FRAMES=$(echo "$DUR * 30" | bc | cut -d. -f1)
    
    ffmpeg -y -loop 1 -i "$WORK_DIR/sub_${i}.png" -t $DUR -r 30 \
        -vf "scale=8000:-1,zoompan=z='min(zoom+0.0003,1.05)':d=$FRAMES:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${WIDTH}x${HEIGHT},fade=t=in:st=0:d=0.3,fade=t=out:st=$(echo "$DUR - 0.3" | bc):d=0.3" \
        -c:v libx264 -pix_fmt yuv420p "$WORK_DIR/seg_${i}.mp4" 2>/dev/null
    
    echo "   Created: seg_${i}.mp4 (${DUR}s)"
done

# === 4. 合併視頻 ===
echo "📦 Concatenating segments..."

for i in $(seq 1 $IMG_COUNT); do
    echo "file 'seg_${i}.mp4'" >> "$WORK_DIR/concat.txt"
done

ffmpeg -y -f concat -safe 0 -i "$WORK_DIR/concat.txt" -c copy "$WORK_DIR/video_only.mp4" 2>/dev/null

# === 5. 檢查是否有音頻文件 ===
VOICE_FILE="$WORK_DIR/voice.mp3"
if [ ! -f "$VOICE_FILE" ]; then
    echo "⚠️  No voice file found. Creating silent video."
    cp "$WORK_DIR/video_only.mp4" "$OUTPUT_DIR/${OUTPUT_NAME}.mp4"
else
    # === 6. 音頻後處理 ===
    echo "🔊 Processing audio..."
    
    ffmpeg -y -i "$VOICE_FILE" \
        -af "aecho=0.8:0.7:40:0.3,loudnorm=I=-16:TP=-1.5:LRA=11" \
        "$WORK_DIR/voice_processed.mp3" 2>/dev/null
    
    # === 7. 混入 BGM ===
    if [ -f "$BGM_FILE" ]; then
        echo "🎵 Mixing with BGM..."
        ffmpeg -y \
            -i "$WORK_DIR/voice_processed.mp3" \
            -i "$BGM_FILE" \
            -filter_complex "[1:a]volume=0.15[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[out]" \
            -map "[out]" \
            "$WORK_DIR/voice_mixed.mp3" 2>/dev/null
        FINAL_AUDIO="$WORK_DIR/voice_mixed.mp3"
    else
        FINAL_AUDIO="$WORK_DIR/voice_processed.mp3"
    fi
    
    # === 8. 合成最終視頻 ===
    echo "🎬 Creating final video..."
    
    ffmpeg -y \
        -i "$WORK_DIR/video_only.mp4" \
        -i "$FINAL_AUDIO" \
        -c:v copy \
        -c:a aac -b:a 128k \
        -shortest \
        "$OUTPUT_DIR/${OUTPUT_NAME}.mp4" 2>/dev/null
fi

echo ""
echo "✅ Done!"
ls -lh "$OUTPUT_DIR/${OUTPUT_NAME}.mp4"
