#!/usr/bin/env python3
"""Convert sticker designs to print-ready 300 DPI 4x7" format"""
import sys
from pathlib import Path

def convert_to_print_ready(input_path: str, output_path: str):
    try:
        from PIL import Image
    except ImportError:
        print("Installing Pillow...")
        import subprocess
        subprocess.run([sys.executable, "-m", "pip", "install", "Pillow", "-q"], check=True)
        from PIL import Image
    
    # Open image
    img = Image.open(input_path)
    
    # Print-ready specs: 4x7 inches at 300 DPI = 1200x2100 pixels
    target_width = 1200
    target_height = 2100
    
    # Resize maintaining aspect ratio, then crop/pad to exact size
    img_ratio = img.width / img.height
    target_ratio = target_width / target_height
    
    if img_ratio > target_ratio:
        # Image is wider, fit height
        new_height = target_height
        new_width = int(new_height * img_ratio)
    else:
        # Image is taller, fit width
        new_width = target_width
        new_height = int(new_width / img_ratio)
    
    img_resized = img.resize((new_width, new_height), Image.LANCZOS)
    
    # Crop to center for exact dimensions
    left = (new_width - target_width) // 2
    top = (new_height - target_height) // 2
    right = left + target_width
    bottom = top + target_height
    
    img_cropped = img_resized.crop((left, top, right, bottom))
    
    # Set DPI metadata
    img_cropped.save(output_path, dpi=(300, 300))
    print(f"Print-ready: {output_path} ({target_width}x{target_height} @ 300 DPI)")

if __name__ == "__main__":
    import os
    base_dir = "/home/liam/clawd/dopamine-depot/stickers"
    
    designs = [
        "01-bug-feature.png",
        "02-hyperfocus.png", 
        "03-dopamine-loading.png",
        "04-will-code.png",
        "05-overwhelmed.png"
    ]
    
    os.makedirs(f"{base_dir}/print-ready", exist_ok=True)
    
    for design in designs:
        input_path = f"{base_dir}/designs/{design}"
        output_path = f"{base_dir}/print-ready/{design}"
        convert_to_print_ready(input_path, output_path)
    
    print("\nAll print-ready files created!")
