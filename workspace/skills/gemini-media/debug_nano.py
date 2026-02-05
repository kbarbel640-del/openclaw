#!/usr/bin/env python3
"""Debug Nano Banana response structure"""

from google import genai
import base64
import os

API_KEY = "AIzaSyAIfdw1ZO0XhUgaXKrasXV1v-tIsFyuT5M"
client = genai.Client(api_key=API_KEY)

print("Generating image...")
response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents="A cute cartoon cat holding a coffee cup, minimalist flat design style",
)

# Debug: 查看 response 結構
print(f"Response type: {type(response)}")
print(f"Candidates: {len(response.candidates)}")

if response.candidates:
    c = response.candidates[0]
    print(f"Content parts: {len(c.content.parts)}")
    
    for i, part in enumerate(c.content.parts):
        print(f"Part {i}: {type(part)}")
        
        if hasattr(part, "text") and part.text:
            print(f"  Text: {part.text[:200]}...")
        
        if hasattr(part, "inline_data") and part.inline_data:
            data = part.inline_data.data
            mime = part.inline_data.mime_type
            print(f"  InlineData: mime={mime}")
            print(f"  Data type: {type(data)}, len={len(data) if data else 0}")
            
            # 保存圖片
            if data:
                output_path = "/Users/sulaxd/clawd/skills/gemini-media/debug_output.png"
                
                # 檢查是否已經是 bytes
                if isinstance(data, bytes):
                    img_bytes = data
                else:
                    # 嘗試 base64 解碼
                    try:
                        img_bytes = base64.b64decode(data)
                    except:
                        img_bytes = data.encode() if isinstance(data, str) else data
                
                with open(output_path, "wb") as f:
                    f.write(img_bytes)
                
                print(f"  Saved to: {output_path} ({len(img_bytes)} bytes)")
