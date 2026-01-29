#!/usr/bin/env python3
"""
Photo Organization Script for Ceramics
Handles batch photo processing, resizing, and organization
Location: ~/clawd/skills/ceramics/photo-organizer.py
"""

import os
import sys
import shutil
import argparse
from datetime import datetime
from pathlib import Path

# Try to import PIL for image processing, but make it optional
try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False
    print("⚠️  PIL/Pillow not installed. Photo processing features disabled.")
    print("   Install with: pip install Pillow")

# Paths
PHOTO_DIR = os.path.expanduser("~/clawd/ceramics/photos")
DB_PATH = os.path.expanduser("~/clawd/ceramics/ceramics.sqlite")

# Standard dimensions for web/social
SIZES = {
    'web': (1200, 1200),
    'social': (1080, 1080),
    'thumbnail': (300, 300),
    'etsy': (2000, 2000),
}

PHOTO_ANGLES = ['front', 'side', 'detail', 'studio', 'lifestyle', 'back', 'top', 'bottom', 'other']

def get_year_dir(year=None):
    """Get photo directory for year"""
    if year is None:
        year = datetime.now().strftime('%Y')
    year_dir = os.path.join(PHOTO_DIR, str(year))
    Path(year_dir).mkdir(parents=True, exist_ok=True)
    return year_dir

def generate_filename(piece_id, angle, timestamp=None):
    """Generate standardized photo filename"""
    if timestamp is None:
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    return f"{piece_id}-{angle}-{timestamp}.jpg"

def process_image(input_path, output_path, size=None, quality=90):
    """Process image - resize and optimize"""
    if not HAS_PIL:
        print(f"⚠️  PIL not available, copying without processing: {os.path.basename(input_path)}")
        shutil.copy2(input_path, output_path)
        return True
    
    try:
        with Image.open(input_path) as img:
            # Convert to RGB if necessary
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
            
            # Resize if size specified
            if size:
                img.thumbnail(size, Image.LANCZOS)
            
            # Save with optimization
            img.save(output_path, 'JPEG', quality=quality, optimize=True)
            
        return True
    except Exception as e:
        print(f"Error processing {input_path}: {e}")
        return False

def cmd_add(args):
    """Add photos for a piece"""
    piece_id = args.piece_id
    input_files = args.files
    
    print(f"📸 Adding photos for: {piece_id}")
    print(f"   Input files: {len(input_files)}")
    
    # Get year from args or use current
    year = args.year or datetime.now().strftime('%Y')
    piece_dir = os.path.join(PHOTO_DIR, str(year), piece_id)
    Path(piece_dir).mkdir(parents=True, exist_ok=True)
    
    # Import sqlite3 for database updates
    import sqlite3
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check piece exists
    cursor.execute("SELECT id FROM pieces WHERE id = ?", (piece_id,))
    if not cursor.fetchone():
        print(f"❌ Piece not found: {piece_id}")
        conn.close()
        return 1
    
    added = 0
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    
    for i, input_file in enumerate(input_files):
        if not os.path.exists(input_file):
            print(f"  ⚠️  Skipping (not found): {input_file}")
            continue
        
        # Determine angle
        if args.angles and i < len(args.angles):
            angle = args.angles[i]
        else:
            angle = args.angle or 'other'
        
        # Generate filename
        filename = generate_filename(piece_id, angle, timestamp)
        output_path = os.path.join(piece_dir, filename)
        
        # Copy/process original
        if args.process:
            size = SIZES.get(args.size)
            if process_image(input_file, output_path, size):
                print(f"  ✓ Added: {filename} ({angle})")
                added += 1
        else:
            shutil.copy2(input_file, output_path)
            print(f"  ✓ Added: {filename} ({angle})")
            added += 1
        
        # Add to database
        rel_path = os.path.join(str(year), piece_id, filename)
        is_primary = 1 if (args.primary and i == 0) else 0
        
        cursor.execute("""
            INSERT INTO photos (piece_id, path, angle, is_primary)
            VALUES (?, ?, ?, ?)
        """, (piece_id, rel_path, angle, is_primary))
    
    conn.commit()
    conn.close()
    
    print(f"\n✅ Added {added} photos to {piece_id}")
    print(f"   Location: {piece_dir}")
    
    return 0

def cmd_batch(args):
    """Batch process photos in a directory"""
    input_dir = args.input_dir
    piece_id = args.piece_id
    
    if not os.path.isdir(input_dir):
        print(f"❌ Directory not found: {input_dir}")
        return 1
    
    # Find image files
    image_exts = {'.jpg', '.jpeg', '.png', '.tiff', '.tif'}
    files = [f for f in os.listdir(input_dir) 
             if os.path.splitext(f.lower())[1] in image_exts]
    files.sort()
    
    if not files:
        print(f"❌ No images found in: {input_dir}")
        return 1
    
    print(f"📁 Found {len(files)} images in: {input_dir}")
    
    # Convert to full paths
    full_paths = [os.path.join(input_dir, f) for f in files]
    
    # Use add command
    args.files = full_paths
    args.year = args.year or datetime.now().strftime('%Y')
    args.angle = args.angle or 'front'
    args.angles = None
    args.process = not args.no_process
    args.size = args.size or 'web'
    args.primary = True
    
    return cmd_add(args)

def cmd_list(args):
    """List photos for a piece"""
    piece_id = args.piece_id
    
    import sqlite3
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM photos WHERE piece_id = ? ORDER BY timestamp", (piece_id,))
    photos = cursor.fetchall()
    
    if not photos:
        print(f"📭 No photos found for: {piece_id}")
        conn.close()
        return 0
    
    print(f"📸 Photos for {piece_id}:")
    print("-" * 60)
    
    for ph in photos:
        primary = "⭐" if ph['is_primary'] else "  "
        print(f"{primary} {ph['angle']:10} | {ph['path']}")
    
    conn.close()
    return 0

def cmd_info(args):
    """Show photo directory info"""
    print("📁 Photo Organization System")
    print("=" * 50)
    print(f"Base directory: {PHOTO_DIR}")
    print(f"PIL/Pillow: {'✅ Available' if HAS_PIL else '❌ Not installed (pip install Pillow)'}")
    print("")
    
    # List years
    if os.path.exists(PHOTO_DIR):
        years = [d for d in os.listdir(PHOTO_DIR) 
                 if os.path.isdir(os.path.join(PHOTO_DIR, d)) and d.isdigit()]
        years.sort()
        
        for year in years:
            year_dir = os.path.join(PHOTO_DIR, year)
            pieces = [d for d in os.listdir(year_dir) 
                     if os.path.isdir(os.path.join(year_dir, d))]
            
            # Count photos
            photo_count = 0
            for piece in pieces:
                piece_dir = os.path.join(year_dir, piece)
                photo_count += len([f for f in os.listdir(piece_dir) 
                                   if f.endswith('.jpg')])
            
            print(f"📅 {year}: {len(pieces)} pieces, {photo_count} photos")
    
    print("")
    print("Standard angles:", ", ".join(PHOTO_ANGLES))
    print("Standard sizes:")
    for name, dims in SIZES.items():
        print(f"  - {name}: {dims[0]}x{dims[1]}px")
    
    return 0

def main():
    parser = argparse.ArgumentParser(
        description="Ceramics Photo Organization",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  ceramics-photo add piece-123 photo1.jpg photo2.jpg --angle front
  ceramics-photo add piece-123 *.jpg --angles front side detail
  ceramics-photo batch piece-123 ./raw-photos/ --size web
  ceramics-photo list piece-123
  ceramics-photo info
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Command to run')
    
    # Add command
    add_parser = subparsers.add_parser('add', help='Add photos for a piece')
    add_parser.add_argument('piece_id', help='Piece ID')
    add_parser.add_argument('files', nargs='+', help='Photo files')
    add_parser.add_argument('--angle', choices=PHOTO_ANGLES, default='other',
                           help='Photo angle')
    add_parser.add_argument('--angles', nargs='+', help='Angles for each photo')
    add_parser.add_argument('--year', help='Year directory (default: current)')
    add_parser.add_argument('--process', action='store_true', help='Process/resize')
    add_parser.add_argument('--size', choices=list(SIZES.keys()), default='web',
                           help='Target size')
    add_parser.add_argument('--primary', action='store_true', 
                           help='First photo is primary')
    
    # Batch command
    batch_parser = subparsers.add_parser('batch', help='Batch process directory')
    batch_parser.add_argument('piece_id', help='Piece ID')
    batch_parser.add_argument('input_dir', help='Input directory')
    batch_parser.add_argument('--year', help='Year directory')
    batch_parser.add_argument('--angle', choices=PHOTO_ANGLES, default='front')
    batch_parser.add_argument('--no-process', action='store_true',
                             help='Skip processing')
    batch_parser.add_argument('--size', choices=list(SIZES.keys()), default='web')
    
    # List command
    list_parser = subparsers.add_parser('list', help='List photos for piece')
    list_parser.add_argument('piece_id', help='Piece ID')
    
    # Info command
    info_parser = subparsers.add_parser('info', help='Show photo system info')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    commands = {
        'add': cmd_add,
        'batch': cmd_batch,
        'list': cmd_list,
        'info': cmd_info,
    }
    
    return commands[args.command](args)

if __name__ == '__main__':
    sys.exit(main())
