#!/usr/bin/env python3
"""
Gemini Media - 圖片和影片生成
使用 Google Gemini API (Nano Banana + Veo 3)
"""

from google import genai
from google.genai import types
import time
import os

# API Key
API_KEY = "AIzaSyAIfdw1ZO0XhUgaXKrasXV1v-tIsFyuT5M"

# 模型
MODELS = {
    "image": "gemini-2.5-flash-image",
    "image_pro": "gemini-3-pro-image-preview",
    "video": "veo-3.0-generate-001",
    "video_fast": "veo-3.0-fast-generate-001",
    "video_latest": "veo-3.1-generate-preview",
}


def get_client():
    """獲取 Gemini client"""
    return genai.Client(api_key=API_KEY)


def generate_image(
    prompt: str,
    output_path: str = None,
    model: str = "gemini-2.5-flash-image"
) -> str:
    """
    生成圖片
    
    Args:
        prompt: 圖片描述
        output_path: 輸出路徑（可選）
        model: 模型名稱
    
    Returns:
        圖片路徑
    """
    client = get_client()
    
    print(f"🎨 生成圖片中...")
    
    response = client.models.generate_content(
        model=model,
        contents=prompt,
    )
    
    # 提取圖片
    for part in response.candidates[0].content.parts:
        if hasattr(part, 'inline_data') and part.inline_data:
            data = part.inline_data.data
            mime = part.inline_data.mime_type or "image/png"
            
            # 決定輸出路徑
            ext = "png" if "png" in mime else "jpg"
            if not output_path:
                output_path = f"/tmp/gemini_image_{int(time.time())}.{ext}"
            
            # 保存
            with open(output_path, "wb") as f:
                f.write(data)
            
            print(f"✅ 圖片已保存: {output_path}")
            return output_path
    
    raise Exception("圖片生成失敗")


def generate_video(
    prompt: str,
    output_path: str = None,
    image_path: str = None,
    aspect_ratio: str = "9:16",
    model: str = "veo-3.0-generate-001",
    negative_prompt: str = None,
) -> str:
    """
    生成影片
    
    Args:
        prompt: 影片描述
        output_path: 輸出路徑（可選）
        image_path: 起始圖片路徑（可選，用於圖片轉影片）
        aspect_ratio: 畫面比例 (9:16, 16:9, 1:1)
        model: 模型名稱
        negative_prompt: 不想要的元素
    
    Returns:
        影片路徑
    """
    client = get_client()
    
    print(f"🎬 開始生成影片...")
    
    # 構建配置
    config = types.GenerateVideosConfig(
        aspect_ratio=aspect_ratio,
    )
    if negative_prompt:
        config.negative_prompt = negative_prompt
    
    # 構建請求參數
    kwargs = {
        "model": model,
        "prompt": prompt,
        "config": config,
    }
    
    # 如果有起始圖片
    if image_path:
        with open(image_path, "rb") as f:
            image_bytes = f.read()
        
        # 判斷 mime type
        mime_type = "image/png" if image_path.endswith(".png") else "image/jpeg"
        
        kwargs["image"] = {
            "image_bytes": image_bytes,
            "mime_type": mime_type,
        }
        print(f"📷 使用起始圖片: {image_path}")
    
    # 發起生成請求
    operation = client.models.generate_videos(**kwargs)
    
    # 等待完成
    poll_count = 0
    while not operation.done:
        poll_count += 1
        print(f"⏳ 等待中... ({poll_count * 20}s)")
        time.sleep(20)
        operation = client.operations.get(operation)
    
    print(f"✅ 生成完成！")
    
    # 提取影片
    if hasattr(operation, 'result') and operation.result:
        result = operation.result
        
        if hasattr(result, 'generated_videos') and result.generated_videos:
            video = result.generated_videos[0]
            
            # 決定輸出路徑
            if not output_path:
                output_path = f"/tmp/gemini_video_{int(time.time())}.mp4"
            
            # 下載影片
            client.files.download(file=video.video)
            video.video.save(output_path)
            
            print(f"💾 影片已保存: {output_path}")
            return output_path
    
    raise Exception("影片生成失敗")


def image_to_video_workflow(
    image_prompt: str,
    video_prompt: str,
    output_dir: str = "/tmp",
    image_model: str = "gemini-2.5-flash-image",
    video_model: str = "veo-3.0-generate-001",
    aspect_ratio: str = "9:16",
) -> dict:
    """
    一站式工作流：生成圖片 → 圖片轉影片
    
    Args:
        image_prompt: 圖片描述
        video_prompt: 影片動作描述
        output_dir: 輸出目錄
        image_model: 圖片模型
        video_model: 影片模型
        aspect_ratio: 畫面比例
    
    Returns:
        {"image": 圖片路徑, "video": 影片路徑}
    """
    timestamp = int(time.time())
    
    # 1. 生成圖片
    image_path = os.path.join(output_dir, f"frame_{timestamp}.png")
    generate_image(image_prompt, image_path, image_model)
    
    # 2. 圖片轉影片
    video_path = os.path.join(output_dir, f"video_{timestamp}.mp4")
    generate_video(
        prompt=video_prompt,
        output_path=video_path,
        image_path=image_path,
        aspect_ratio=aspect_ratio,
        model=video_model,
    )
    
    return {
        "image": image_path,
        "video": video_path,
    }


if __name__ == "__main__":
    # 測試
    print("=== 測試圖片生成 ===")
    img = generate_image("A minimalist coffee cup, soft morning light")
    print(f"Image: {img}")
    
    print("\n=== 測試影片生成 ===")
    vid = generate_video("Steam rising from a coffee cup, gentle morning atmosphere")
    print(f"Video: {vid}")
