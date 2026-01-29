#!/usr/bin/env python3
"""Create batch print sheet with all 5 stickers arranged for efficient cutting"""
from PIL import Image

# Sticker specs (at 300 DPI)
STICKER_SIZE = 700  # ~2.3 inches square stickers
MARGIN = 50         # Small margin between stickers
SHEET_WIDTH = 1200  # 4 inches
SHEET_HEIGHT = 2100 # 7 inches

def create_batch_sheet():
    base_dir = "/home/liam/clawd/dopamine-depot/stickers"
    
    # Create blank canvas (white background)
    sheet = Image.new('RGB', (SHEET_WIDTH, SHEET_HEIGHT), 'white')
    
    # Load and resize stickers
    designs = [
        "01-bug-feature.png",
        "02-hyperfocus.png", 
        "03-dopamine-loading.png",
        "04-will-code.png",
        "05-overwhelmed.png"
    ]
    
    positions = [
        (100, 100),      # Top-left
        (450, 100),      # Top-right
        (275, 500),      # Middle
        (100, 900),      # Bottom-left
        (450, 900),      # Bottom-right
    ]
    
    for i, design in enumerate(designs):
        img = Image.open(f"{base_dir}/designs/{design}")
        
        # Resize to uniform sticker size while maintaining aspect
        img.thumbnail((STICKER_SIZE, STICKER_SIZE), Image.LANCZOS)
        
        # Paste onto sheet at position
        x, y = positions[i]
        # Center the sticker in its allocated space
        offset_x = (STICKER_SIZE - img.width) // 2
        offset_y = (STICKER_SIZE - img.height) // 2
        sheet.paste(img, (x + offset_x, y + offset_y))
    
    # Save batch print file
    output_path = f"{base_dir}/print-ready/batch-print-sheet.png"
    sheet.save(output_path, dpi=(300, 300))
    print(f"Batch print sheet: {output_path}")
    print(f"  Dimensions: {SHEET_WIDTH}x{SHEET_HEIGHT} pixels (4x7 inches @ 300 DPI)")
    print(f"  Contains: {len(designs)} stickers arranged for PixCut S1")

if __name__ == "__main__":
    create_batch_sheet()
