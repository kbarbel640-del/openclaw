#!/usr/bin/env python3
"""
Threads 影片一鍵生成器
純 AI 路線：Nano Banana 封面 → Veo 3 影片
"""

from google import genai
from google.genai import types
import time
import os
import json

API_KEY = "AIzaSyAIfdw1ZO0XhUgaXKrasXV1v-tIsFyuT5M"
OUTPUT_DIR = "/Users/sulaxd/clawd/output/threads"

# 預設風格模板
STYLES = {
    "tech_creator": {
        "scene": "minimalist home office with plants, warm morning sunlight through window",
        "mood": "warm and aspirational, shot like Apple commercial",
        "color": "cinematic color grading with warm tones",
    },
    "cyberpunk": {
        "scene": "futuristic workspace with holographic displays, neon city view through window",
        "mood": "high-tech and mysterious, blade runner aesthetic",
        "color": "teal and orange color grading, neon accents",
    },
    "cozy": {
        "scene": "comfortable coffee shop corner, soft afternoon light, books and plants",
        "mood": "relaxed and inviting, indie film aesthetic",
        "color": "warm vintage tones, slightly desaturated",
    },
    "professional": {
        "scene": "clean modern office, large windows with city skyline view",
        "mood": "confident and polished, corporate video style",
        "color": "clean neutral tones with subtle blue accents",
    },
}

# 內容類型模板
CONTENT_TYPES = {
    "tool_reveal": {
        "image_prompt": "A glowing laptop screen showing an amazing interface, dramatic lighting from screen, hands hovering over keyboard in anticipation",
        "video_prompt": "The screen illuminates the person's face with wonder, they lean in closer, fingers begin typing excitedly. SFX: magical chime, soft keyboard tapping",
        "hook": "發現神器的瞬間",
    },
    "productivity_hack": {
        "image_prompt": "Split screen showing cluttered chaos on left, organized zen workspace on right, dramatic before/after composition",
        "video_prompt": "Smooth transition from chaos to order, items flying into organized positions, satisfying transformation. SFX: whoosh sounds, satisfying click",
        "hook": "效率翻倍的秘密",
    },
    "ai_demo": {
        "image_prompt": "Futuristic AI interface with flowing data streams, human silhouette interacting with holographic display",
        "video_prompt": "Data streams respond to hand gestures, AI interface comes alive with animations, magical collaboration moment. SFX: soft electronic hums, data processing sounds",
        "hook": "AI 正在改變一切",
    },
    "mindset": {
        "image_prompt": "Person meditating at desk, soft golden particles floating around, peaceful morning atmosphere",
        "video_prompt": "Gentle breathing motion, light particles slowly orbit around the person, deep focus state. SFX: soft ambient music, gentle breath sounds",
        "hook": "高效的秘密不是更努力",
    },
}


def get_client():
    return genai.Client(api_key=API_KEY)


def generate_threads_content(
    topic: str,
    content_type: str = "tool_reveal",
    style: str = "tech_creator",
    custom_text: str = None,
) -> dict:
    """
    一鍵生成 Threads 影片內容
    
    Args:
        topic: 主題（如 "Veo 3 影片生成"）
        content_type: 內容類型 (tool_reveal/productivity_hack/ai_demo/mindset)
        style: 風格 (tech_creator/cyberpunk/cozy/professional)
        custom_text: 自定義文字（會渲染在圖片上）
    
    Returns:
        {"cover": 封面路徑, "video": 影片路徑, "caption": 建議文案}
    """
    client = get_client()
    
    # 確保輸出目錄存在
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    timestamp = int(time.time())
    style_config = STYLES.get(style, STYLES["tech_creator"])
    content_config = CONTENT_TYPES.get(content_type, CONTENT_TYPES["tool_reveal"])
    
    # ===== 1. 生成封面圖 =====
    print(f"🎨 生成封面圖...")
    
    cover_prompt = f"""
    {content_config['image_prompt']},
    {style_config['scene']},
    {style_config['mood']},
    {style_config['color']},
    9:16 vertical composition for mobile,
    cinematic quality, highly detailed.
    """
    
    if custom_text:
        cover_prompt += f"""
        The text "{custom_text}" rendered in bold, modern sans-serif font,
        positioned at bottom third with subtle shadow for readability.
        """
    
    cover_response = client.models.generate_content(
        model="gemini-2.5-flash-image",
        contents=cover_prompt,
    )
    
    cover_path = f"{OUTPUT_DIR}/cover_{timestamp}.png"
    for part in cover_response.candidates[0].content.parts:
        if hasattr(part, 'inline_data') and part.inline_data:
            with open(cover_path, "wb") as f:
                f.write(part.inline_data.data)
            print(f"✅ 封面已保存: {cover_path}")
            break
    
    # ===== 2. 生成影片 =====
    print(f"🎬 生成影片...")
    
    video_prompt = f"""
    Medium shot with shallow depth of field,
    {content_config['video_prompt']},
    {style_config['scene']},
    {style_config['mood']},
    {style_config['color']},
    9:16 vertical composition optimized for mobile viewing,
    smooth cinematic motion, professional quality.
    """
    
    operation = client.models.generate_videos(
        model="veo-3.0-generate-001",
        prompt=video_prompt,
        config=types.GenerateVideosConfig(
            aspect_ratio="9:16",
        ),
    )
    
    poll_count = 0
    while not operation.done:
        poll_count += 1
        print(f"⏳ 等待中... ({poll_count * 20}s)")
        time.sleep(20)
        operation = client.operations.get(operation)
    
    video_path = f"{OUTPUT_DIR}/video_{timestamp}.mp4"
    if hasattr(operation, 'result') and operation.result:
        if hasattr(operation.result, 'generated_videos') and operation.result.generated_videos:
            video = operation.result.generated_videos[0]
            client.files.download(file=video.video)
            video.video.save(video_path)
            print(f"✅ 影片已保存: {video_path}")
    
    # ===== 3. 生成文案建議 =====
    caption = f"""
{content_config['hook']}

{topic}

#AI #生產力 #效率 #工具推薦
"""
    
    result = {
        "cover": cover_path,
        "video": video_path,
        "caption": caption,
        "topic": topic,
        "style": style,
        "content_type": content_type,
    }
    
    # 保存 metadata
    meta_path = f"{OUTPUT_DIR}/meta_{timestamp}.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"\n📦 完成！")
    print(f"封面: {cover_path}")
    print(f"影片: {video_path}")
    print(f"文案: {caption}")
    
    return result


if __name__ == "__main__":
    # 測試：生成一個 "Veo 3 影片生成工具" 的內容
    result = generate_threads_content(
        topic="Veo 3 — Google 最強 AI 影片生成",
        content_type="tool_reveal",
        style="tech_creator",
    )
