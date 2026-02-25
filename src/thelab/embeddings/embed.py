#!/usr/bin/env python3
"""
Image Embedding Sidecar — CLIP Embeddings via MLX

Computes 768-dimensional CLIP image embeddings for photo-RAG
(finding similar past edits by visual similarity).

Usage:
  python3 embed.py --image /path/to/photo.jpg
  python3 embed.py --batch /path/to/images.txt   (one path per line)

Output: JSON to stdout with base64-encoded float32 embedding
"""

import argparse
import base64
import json
import struct
import sys
from pathlib import Path


def compute_embedding(image_path: str) -> dict:
    """
    Compute a 768-dim CLIP embedding for the given image.
    Uses the open_clip library with MLX backend when available.
    """
    try:
        import numpy as np
        import torch
        from PIL import Image
        from transformers import CLIPModel, CLIPProcessor

        device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")

        model_id = "openai/clip-vit-large-patch14"
        processor = CLIPProcessor.from_pretrained(model_id)
        model = CLIPModel.from_pretrained(model_id).to(device)

        img = Image.open(image_path).convert("RGB")
        inputs = processor(images=img, return_tensors="pt").to(device)

        with torch.no_grad():
            image_features = model.get_image_features(**inputs)
            # Normalize to unit vector for cosine similarity
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)

        embedding = image_features.cpu().numpy().flatten()

        # Encode as base64 float32 for efficient transfer
        raw_bytes = struct.pack(f"{len(embedding)}f", *embedding)
        b64 = base64.b64encode(raw_bytes).decode("ascii")

        return {
            "embedding_b64": b64,
            "dimensions": len(embedding),
            "model": model_id,
        }

    except ImportError:
        return {
            "error": "transformers not installed. Install via: pip install transformers torch",
            "embedding_b64": None,
            "dimensions": 0,
        }
    except Exception as e:
        return {"error": str(e), "embedding_b64": None, "dimensions": 0}


def main():
    parser = argparse.ArgumentParser(description="Image Embedding Sidecar")
    parser.add_argument("--image", help="Path to a single image file")
    parser.add_argument("--batch", help="Path to a text file with one image path per line")
    args = parser.parse_args()

    if args.image:
        image_path = args.image
        if not Path(image_path).exists():
            print(json.dumps({"error": f"Image not found: {image_path}"}))
            sys.exit(1)

        result = compute_embedding(image_path)
        result["image"] = image_path
        print(json.dumps(result))

    elif args.batch:
        batch_file = args.batch
        if not Path(batch_file).exists():
            print(json.dumps({"error": f"Batch file not found: {batch_file}"}))
            sys.exit(1)

        with open(batch_file, "r") as f:
            paths = [line.strip() for line in f if line.strip()]

        results = []
        for p in paths:
            if not Path(p).exists():
                results.append({"image": p, "error": f"Not found: {p}"})
                continue
            result = compute_embedding(p)
            result["image"] = p
            results.append(result)

        print(json.dumps({"results": results, "total": len(results)}))

    else:
        print(json.dumps({"error": "Provide --image or --batch"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
