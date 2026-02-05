#!/usr/bin/env python3
"""Test Nano Banana (Gemini 2.5 Flash Image) - 圖片生成"""

from google import genai
import base64
import os

API_KEY = "AIzaSyAIfdw1ZO0XhUgaXKrasXV1v-tIsFyuT5M"
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

def generate_image(prompt: str, output_path: str = None):
    """生成圖片"""
    client = genai.Client(api_key=API_KEY)
    
    print(f"🎨 生成中: {prompt}")
    
    response = client.models.generate_content(
        model="gemini-2.5-flash-image",
        contents=prompt,
    )
    
    # 提取圖片
    for part in response.candidates[0].content.parts:
        if hasattr(part, 'inline_data') and part.inline_data:
            image_data = part.inline_data.data
            mime_type = part.inline_data.mime_type or "image/png"
            
            # 決定輸出路徑
            ext = "png" if "png" in mime_type else "jpg"
            if not output_path:
                output_path = os.path.join(OUTPUT_DIR, f"test_output.{ext}")
            
            # 保存
            with open(output_path, "wb") as f:
                f.write(base64.b64decode(image_data))
            
            print(f"✅ 已保存: {output_path}")
            return output_path
    
    print("❌ 沒有生成圖片")
    return None

if __name__ == "__main__":
    # 測試：生成一個簡單的圖
    prompt = """
    A cute cartoon character holding a coffee cup, 
    minimalist style, soft pastel colors, 
    perfect for social media avatar
    """
    
    generate_image(prompt)
