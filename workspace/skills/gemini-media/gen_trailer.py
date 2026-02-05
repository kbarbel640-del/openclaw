#!/usr/bin/env python3
"""
電影預告風格 Threads 影片
戲劇性 + 懸念感 + 史詩配樂
"""

from google import genai
from google.genai import types
import time

API_KEY = "AIzaSyAIfdw1ZO0XhUgaXKrasXV1v-tIsFyuT5M"
OUTPUT_DIR = "/Users/sulaxd/clawd/output/threads"

def generate_trailer(topic: str, hook: str):
    """生成電影預告風格影片"""
    client = genai.Client(api_key=API_KEY)
    timestamp = int(time.time())
    
    # 電影預告風格的 prompt
    prompt = f"""
    Cinematic movie trailer style, dramatic and epic atmosphere.
    
    [00:00-00:02] 
    Extreme close-up of eyes opening slowly in darkness,
    dramatic backlighting, lens flare.
    SFX: Deep bass drone, tension building.
    
    [00:02-00:04]
    Slow motion tracking shot, a person walking towards 
    a glowing screen in a dark room, silhouette against light.
    SFX: Heartbeat rhythm, building intensity.
    
    [00:04-00:06]
    Quick cut montage: hands typing, data flowing, 
    light trails, transformation happening.
    SFX: Rising orchestral strings, whoosh transitions.
    
    [00:06-00:08]
    Wide shot reveal: person standing triumphant,
    bathed in golden light, world transformed around them.
    SFX: Epic brass hit (inception horn style), then silence.
    
    9:16 vertical composition for mobile,
    high contrast cinematic color grading,
    teal and orange palette,
    anamorphic lens flare effects,
    film grain texture.
    """
    
    print("🎬 生成電影預告風格影片...")
    print(f"主題: {topic}")
    
    operation = client.models.generate_videos(
        model="veo-3.0-generate-001",
        prompt=prompt,
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
    
    video_path = f"{OUTPUT_DIR}/trailer_{timestamp}.mp4"
    if hasattr(operation, 'result') and operation.result:
        if hasattr(operation.result, 'generated_videos') and operation.result.generated_videos:
            video = operation.result.generated_videos[0]
            client.files.download(file=video.video)
            video.video.save(video_path)
            print(f"✅ 已保存: {video_path}")
            return video_path
    
    return None

if __name__ == "__main__":
    generate_trailer(
        topic="AI 時代的覺醒",
        hook="當你學會讓 AI 為你工作..."
    )
