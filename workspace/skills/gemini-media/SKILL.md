# Gemini Media Skill

使用 Google Gemini API 生成圖片和影片。

## 能力

| 功能 | 模型 | 說明 |
|------|------|------|
| 圖片生成 | `gemini-2.5-flash-image` (Nano Banana) | 快速生成高品質圖片 |
| 圖片生成 Pro | `gemini-3-pro-image-preview` (Nano Banana Pro) | 更高品質，支持多圖參考 |
| 影片生成 | `veo-3.0-generate-001` (Veo 3) | 8 秒影片，支持對話和音效 |
| 影片生成 | `veo-3.1-generate-preview` (Veo 3.1) | 最新版，更高品質 |

## 使用方式

### 圖片生成

```python
from skills.gemini_media import generate_image

# 生成圖片
image_path = generate_image(
    prompt="A cute cartoon cat holding a coffee cup",
    output_path="output.png",
    model="gemini-2.5-flash-image"  # 或 gemini-3-pro-image-preview
)
```

### 影片生成

```python
from skills.gemini_media import generate_video

# 純文字生成影片
video_path = generate_video(
    prompt="A steaming cup of coffee, morning sunlight",
    output_path="output.mp4",
    aspect_ratio="9:16",  # 9:16, 16:9, 1:1
    model="veo-3.0-generate-001"
)

# 圖片轉影片（用生成的圖片作為起始幀）
video_path = generate_video(
    prompt="The cat slowly blinks and steam rises from the cup",
    image_path="cat_coffee.png",  # 起始圖片
    output_path="output.mp4"
)
```

### 圖片 → 影片 工作流

```python
from skills.gemini_media import image_to_video_workflow

# 一站式：生成圖片 → 圖片轉影片
video_path = image_to_video_workflow(
    image_prompt="A minimalist illustration of a person meditating",
    video_prompt="Gentle breathing motion, soft light particles floating",
    output_dir="./output"
)
```

## API Key

位置：`~/Documents/幣塔/Gemini_API_Keys.md`
Key：`AIzaSyAIfdw1ZO0XhUgaXKrasXV1v-tIsFyuT5M`

⚠️ 這是 **Paid Tier** Key，有配額限制，請合理使用。

## Threads 影片製作流程

1. **概念** → 用 Nano Banana 生成封面圖
2. **起始幀** → 用同一張圖作為 Veo 3 的起始幀
3. **生成影片** → Veo 3 生成 8 秒影片
4. **後製** → 用 ffmpeg 加字幕/音樂（如需要）

## 檔案結構

```
skills/gemini-media/
├── SKILL.md           # 本文件
├── gemini_media.py    # 主模組
├── test_nano_banana.py # 圖片生成測試
├── test_veo3.py       # 影片生成測試
└── output/            # 輸出目錄
```
