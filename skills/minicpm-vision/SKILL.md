---
name: minicpm-vision
description: Use when you need to analyze images with MiniCPM-V 4.5: image captioning, OCR text extraction, or visual question answering (VQA).
metadata:
  openclaw:
    emoji: 👁️
    requires:
      python: ">=3.10"
      gpu: "Recommended (RTX 3070+ for best performance)"
    install:
      - label: "Install dependencies"
        command: "uv pip install -r requirements.txt"
    run:
      - label: "Analyze image (auto-detect task)"
        command: "python scripts/analyze.py \"图片路径\""
---

# MiniCPM-Vision Skill

使用MiniCPM-V 4.5进行图像理解和OCR识别。

## 模型信息

- **模型**: openbmb/MiniCPM-V-4_5
- **大小**: 约8GB
- **功能**: 图像描述、OCR文字识别、问答
- **设备**: 支持CPU/GPU (推荐RTX 3070 GPU)

## 使用方法

```
识图: [图片路径]
ocr: [图片路径]
describe: [图片路径]
```

示例:
```
识图: C:\Users\User\Pictures\test.jpg
ocr: screenshot.png
```

## 手动运行

```bash
python scripts/analyze.py "图片路径"
```

## 配置

模型路径: `C:\Users\User\.openclaw\models\MiniCPM-4.5V`

## 支持的图片格式

- JPG/JPEG
- PNG
- BMP
- GIF
- WEBP
- HEIC (需要额外转换)

## 功能

1. **图像描述**: 描述图片内容
2. **OCR识别**: 识别图片中的文字
3. **图像问答**: 根据图片回答问题
4. **多语言**: 支持中英文

## 性能

- **CPU**: 较慢（约2-5秒/图）
- **GPU (RTX 3070)**: 快（约0.5-1秒/图）