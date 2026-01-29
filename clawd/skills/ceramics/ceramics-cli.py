#!/usr/bin/env python3
"""
Ceramics Business Intelligence CLI
Phase 1: Foundation
Location: ~/clawd/skills/ceramics/ceramics-cli.py

Commands:
  add          - Add new piece with interactive prompts
  list         - View inventory with filters
  search       - Search pieces
  update       - Update piece metadata
  post         - Generate social post for piece
"""

import sqlite3
import argparse
import os
import sys
import json
import random
from datetime import datetime
from pathlib import Path

# Database path
DB_PATH = os.path.expanduser("~/clawd/ceramics/ceramics.sqlite")
PHOTO_DIR = os.path.expanduser("~/clawd/ceramics/photos")
SOCIAL_POSTS_FILE = os.path.expanduser("~/clawd/ceramics/social-posts.json")

# Status and type enums
STATUSES = ['in-progress', 'ready-for-sale', 'listed', 'sold', 'archived', 'gifted']
TYPES = ['vase', 'bowl', 'plate', 'mug', 'sculpture', 'planter', 'other']
FIRING_TYPES = ['bisque', 'glaze', 'raku', 'wood', 'gas', 'electric']
PLATFORMS = ['etsy', 'shopify', 'instagram', 'in-person', 'gallery', 'show', 'wholesale', 'custom', 'other']
PHOTO_ANGLES = ['front', 'side', 'detail', 'studio', 'lifestyle', 'back', 'top', 'bottom', 'other']

# Caption templates for post generation
CAPTION_STYLES = {
    'aesthetic': [
        "{name} — {glaze} on {materials}",
        "The way the {glaze} catches light on this {type}...",
        "Quiet moments with {glaze} and clay.",
        "Finding stillness in the details. {glaze} {type}.",
    ],
    'casual': [
        "Fresh out of the kiln! This {type} came out better than expected 🎉",
        "Experimenting with {glaze} on this {type} and I'm loving how it turned out!",
        "Late night studio vibes = this {type} in {glaze} 💫",
        "Just listed this {type}! The {glaze} turned out dreamy.",
    ],
    'storytelling': [
        "This {type} started as an experiment with {glaze}. Three firings later, it's exactly what I imagined.",
        "The journey of this piece: wedging clay at midnight, glazing at dawn, pulling it from the kiln with held breath.",
        "Every {type} teaches me something. This one taught me patience with {glaze}.",
        "There's a moment when you open the kiln and the light hits just right. This {type} was that moment.",
    ],
    'technical': [
        "{glaze} over {materials}. Fired to cone 6. Dimensions: {dimensions}.",
        "Exploring the interaction between {glaze} and this clay body. {type}, {dimensions}.",
        "Testing {glaze} application techniques on {type}. Results: promising.",
        "{materials} + {glaze} = this surface. Technical notes: slow cool, heavy application.",
    ],
    'sale': [
        "Now available! {name} — {dimensions} of {glaze} goodness. Link in bio ✨",
        "This {type} is looking for a home. {glaze}, {dimensions}, ready to ship.",
        "Shop update live! Starting with this {glaze} {type}. DM to claim.",
        "Flash sale: 20% off this {type} and others in the {series} series. Today only!",
    ],
}

HASHTAG_SETS = {
    'ceramics': ['#ceramics', '#pottery', '#handmade', '#ceramicart', '#clay'],
    'glazes': ['#glaze', '#glazetech', '#ceramicglaze', '#glazecombo', '#glazeexperiment'],
    'process': ['#wheelthrown', '#handbuilt', '#potterylife', '#studiopottery', '#makersgonnamake'],
    'community': ['#pottersofinstagram', '#ceramicist', '#potter', '#claycommunity', '#ceramicstudio'],
    'shop': ['#shopsmall', '#supportlocal', '#handmadesale', '#potterysale', '#ceramicsforsale'],
}

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def generate_piece_id(name):
    """Generate unique piece ID from name and timestamp"""
    prefix = name.lower().replace(' ', '-')[:15]
    timestamp = datetime.now().strftime('%Y%m%d%H%M')
    return f"{prefix}-{timestamp}"

def format_piece(row):
    """Format piece data for display"""
    status_icons = {
        'in-progress': '🔨',
        'ready-for-sale': '✨',
        'listed': '🏷️',
        'sold': '💰',
        'archived': '📦',
        'gifted': '🎁'
    }
    icon = status_icons.get(row['status'], '•')
    price_str = f"${row['price']:.2f}" if row['price'] else "N/A"
    return f"{icon} {row['id']} | {row['name']} ({row['type']}) | {row['glaze']} | {price_str} | {row['status']}"

def cmd_add(args):
    """Add new piece interactively"""
    print("🔨 Add New Ceramic Piece")
    print("=" * 50)
    
    # Get inputs
    name = input("Piece name: ").strip()
    if not name:
        print("❌ Name is required")
        return 1
    
    print(f"Types: {', '.join(TYPES)}")
    piece_type = input("Type: ").strip()
    if piece_type not in TYPES:
        print(f"❌ Invalid type. Must be one of: {', '.join(TYPES)}")
        return 1
    
    dimensions = input("Dimensions (e.g., '8x12x6 in'): ").strip()
    
    glaze = input("Glaze name: ").strip()
    if not glaze:
        print("❌ Glaze is required")
        return 1
    
    price_input = input("Price (USD): ").strip()
    price = float(price_input) if price_input else None
    
    cost_input = input("Production cost (USD): ").strip()
    cost = float(cost_input) if cost_input else None
    
    series = input("Series name (optional): ").strip() or None
    
    print(f"Firing types: {', '.join(FIRING_TYPES)}")
    firing = input("Firing type (optional): ").strip() or None
    
    materials = input("Materials (e.g., 'Stoneware, cone 6'): ").strip() or None
    notes = input("Notes: ").strip() or None
    
    # Generate ID and insert
    piece_id = generate_piece_id(name)
    
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            INSERT INTO pieces (id, name, type, dimensions, glaze, price, cost, 
                              series, firing_type, materials, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in-progress')
        """, (piece_id, name, piece_type, dimensions, glaze, price, cost, 
              series, firing, materials, notes))
        conn.commit()
        print(f"\n✅ Piece added: {piece_id}")
        print(f"   Status: in-progress")
        
        # Create photo directory for the year
        year = datetime.now().strftime('%Y')
        piece_photo_dir = os.path.join(PHOTO_DIR, year, piece_id)
        Path(piece_photo_dir).mkdir(parents=True, exist_ok=True)
        print(f"   Photo directory: {piece_photo_dir}")
        
    except sqlite3.IntegrityError as e:
        print(f"❌ Database error: {e}")
        return 1
    finally:
        conn.close()
    
    return 0

def cmd_list(args):
    """List inventory with filters"""
    conn = get_db()
    cursor = conn.cursor()
    
    query = "SELECT * FROM pieces WHERE 1=1"
    params = []
    
    if args.status:
        query += " AND status = ?"
        params.append(args.status)
    
    if args.series:
        query += " AND series = ?"
        params.append(args.series)
    
    if args.glaze:
        query += " AND glaze LIKE ?"
        params.append(f"%{args.glaze}%")
    
    if args.type:
        query += " AND type = ?"
        params.append(args.type)
    
    if args.min_price is not None:
        query += " AND price >= ?"
        params.append(args.min_price)
    
    if args.max_price is not None:
        query += " AND price <= ?"
        params.append(args.max_price)
    
    query += " ORDER BY created_date DESC"
    
    if args.limit:
        query += " LIMIT ?"
        params.append(args.limit)
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    if not rows:
        print("📭 No pieces found matching criteria")
        conn.close()
        return 0
    
    # Summary stats
    cursor.execute("SELECT COUNT(*) FROM pieces")
    total = cursor.fetchone()[0]
    
    print(f"📦 Inventory ({len(rows)} shown, {total} total)")
    print("=" * 80)
    
    for row in rows:
        print(format_piece(row))
    
    print("=" * 80)
    print(f"Status: 🔨 in-progress | ✨ ready-for-sale | 🏷️ listed | 💰 sold | 📦 archived | 🎁 gifted")
    
    conn.close()
    return 0

def cmd_search(args):
    """Search pieces by term"""
    term = args.term.lower()
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT * FROM pieces 
        WHERE LOWER(name) LIKE ? 
           OR LOWER(glaze) LIKE ? 
           OR LOWER(series) LIKE ?
           OR LOWER(notes) LIKE ?
           OR LOWER(materials) LIKE ?
           OR LOWER(dimensions) LIKE ?
        ORDER BY created_date DESC
    """, tuple([f"%{term}%"] * 6))
    
    rows = cursor.fetchall()
    
    if not rows:
        print(f"🔍 No results for '{term}'")
        conn.close()
        return 0
    
    print(f"🔍 Search: '{term}' ({len(rows)} results)")
    print("=" * 80)
    
    for row in rows:
        print(format_piece(row))
    
    conn.close()
    return 0

def cmd_update(args):
    """Update piece metadata"""
    piece_id = args.id
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Check piece exists
    cursor.execute("SELECT * FROM pieces WHERE id = ?", (piece_id,))
    piece = cursor.fetchone()
    
    if not piece:
        print(f"❌ Piece not found: {piece_id}")
        conn.close()
        return 1
    
    print(f"✏️  Updating: {piece['name']} ({piece_id})")
    print("-" * 50)
    print("Current values shown in [brackets]. Press Enter to keep.")
    print("-" * 50)
    
    updates = {}
    
    # Interactive update
    new_name = input(f"Name [{piece['name']}]: ").strip()
    if new_name:
        updates['name'] = new_name
    
    new_glaze = input(f"Glaze [{piece['glaze']}]: ").strip()
    if new_glaze:
        updates['glaze'] = new_glaze
    
    new_price = input(f"Price [{piece['price']}]: ").strip()
    if new_price:
        updates['price'] = float(new_price)
    
    new_cost = input(f"Cost [{piece['cost']}]: ").strip()
    if new_cost:
        updates['cost'] = float(new_cost)
    
    new_series = input(f"Series [{piece['series']}]: ").strip()
    if new_series:
        updates['series'] = new_series or None
    
    new_notes = input(f"Notes [{piece['notes']}]: ").strip()
    if new_notes:
        updates['notes'] = new_notes or None
    
    if not updates:
        print("No changes made.")
        conn.close()
        return 0
    
    # Build update query
    set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
    values = list(updates.values()) + [piece_id]
    
    cursor.execute(f"UPDATE pieces SET {set_clause} WHERE id = ?", values)
    conn.commit()
    
    print(f"\n✅ Updated {len(updates)} fields")
    
    conn.close()
    return 0

def generate_caption(piece, style='aesthetic'):
    """Generate caption for piece"""
    templates = CAPTION_STYLES.get(style, CAPTION_STYLES['aesthetic'])
    template = random.choice(templates)
    
    data = {
        'name': piece['name'],
        'type': piece['type'],
        'glaze': piece['glaze'],
        'materials': piece['materials'] or 'stoneware',
        'dimensions': piece['dimensions'] or '',
        'series': piece['series'] or '',
    }
    
    try:
        caption = template.format(**data)
    except KeyError:
        caption = template
    
    return caption

def generate_hashtags(style='ceramics', count=15):
    """Generate hashtag set"""
    all_tags = []
    all_tags.extend(HASHTAG_SETS['ceramics'])
    all_tags.extend(HASHTAG_SETS['process'])
    all_tags.extend(HASHTAG_SETS['community'])
    
    if style in ['sale', 'shop']:
        all_tags.extend(HASHTAG_SETS['shop'])
    
    if style in ['technical']:
        all_tags.extend(HASHTAG_SETS['glazes'])
    
    selected = random.sample(all_tags, min(count, len(all_tags)))
    return ' '.join(selected)

def get_photo_suggestions(piece_id):
    """Get best photos for posting"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT * FROM photos 
        WHERE piece_id = ? 
        ORDER BY is_primary DESC, 
                 CASE angle 
                    WHEN 'front' THEN 1 
                    WHEN 'detail' THEN 2 
                    WHEN 'lifestyle' THEN 3 
                    ELSE 4 
                 END
    """, (piece_id,))
    
    photos = cursor.fetchall()
    conn.close()
    
    suggestions = []
    for ph in photos[:4]:
        suggestions.append(f"{ph['angle'].upper()}: {ph['path']}")
    
    return suggestions

def cmd_post(args):
    """Generate social post for piece"""
    piece_id = args.piece_id
    style = args.style or 'aesthetic'
    platform = args.platform or 'instagram'
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM pieces WHERE id = ?", (piece_id,))
    piece = cursor.fetchone()
    conn.close()
    
    if not piece:
        print(f"❌ Piece not found: {piece_id}")
        return 1
    
    print(f"📱 Generating {style} post for: {piece['name']}")
    print("=" * 60)
    
    # Generate content
    caption = generate_caption(piece, style)
    hashtags = generate_hashtags(style)
    photos = get_photo_suggestions(piece_id)
    
    print("\n📝 CAPTION:")
    print(caption)
    
    print("\n#️⃣ HASHTAGS:")
    print(hashtags)
    
    if photos:
        print("\n📸 SUGGESTED PHOTOS:")
        for p in photos:
            print(f"  • {p}")
    
    # Save to JSON if requested
    if args.save:
        post_data = {
            'id': f"post-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            'piece_id': piece_id,
            'piece_name': piece['name'],
            'platform': platform,
            'style': style,
            'caption': caption,
            'hashtags': hashtags,
            'photo_suggestions': photos,
            'created_date': datetime.now().isoformat(),
            'status': 'draft'
        }
        
        if os.path.exists(SOCIAL_POSTS_FILE):
            with open(SOCIAL_POSTS_FILE, 'r') as f:
                data = json.load(f)
        else:
            data = {'posts': []}
        
        data['posts'].append(post_data)
        
        with open(SOCIAL_POSTS_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        
        print(f"\n💾 Saved to: {SOCIAL_POSTS_FILE}")
    
    print("\n" + "=" * 60)
    print("✅ Ready to post!")
    
    return 0

def main():
    parser = argparse.ArgumentParser(
        description="Ceramics Business Intelligence CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  ceramics-cli add                    # Add new piece interactively
  ceramics-cli list                   # Show all pieces
  ceramics-cli list --status listed   # Show listed pieces only
  ceramics-cli search blue            # Search for 'blue'
  ceramics-cli update piece-id-123    # Update piece
  ceramics-cli post piece-id-123 --style storytelling
  ceramics-cli post piece-id-123 --style sale --save
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Command to run')
    
    # Add command
    subparsers.add_parser('add', help='Add new piece interactively')
    
    # List command
    list_parser = subparsers.add_parser('list', help='List inventory')
    list_parser.add_argument('--status', choices=STATUSES, help='Filter by status')
    list_parser.add_argument('--series', help='Filter by series')
    list_parser.add_argument('--glaze', help='Filter by glaze')
    list_parser.add_argument('--type', choices=TYPES, help='Filter by type')
    list_parser.add_argument('--min-price', type=float, help='Minimum price')
    list_parser.add_argument('--max-price', type=float, help='Maximum price')
    list_parser.add_argument('--limit', type=int, help='Limit results')
    
    # Search command
    search_parser = subparsers.add_parser('search', help='Search pieces')
    search_parser.add_argument('term', help='Search term')
    
    # Update command
    update_parser = subparsers.add_parser('update', help='Update piece')
    update_parser.add_argument('id', help='Piece ID')
    
    # Post command
    post_parser = subparsers.add_parser('post', help='Generate social post for piece')
    post_parser.add_argument('piece_id', help='Piece ID')
    post_parser.add_argument('--style', 
                           choices=['aesthetic', 'casual', 'storytelling', 'technical', 'sale'],
                           default='aesthetic',
                           help='Caption style')
    post_parser.add_argument('--platform',
                           choices=['instagram', 'tiktok', 'facebook', 'pinterest', 'website', 'newsletter'],
                           default='instagram',
                           help='Target platform')
    post_parser.add_argument('--save', action='store_true',
                           help='Save post to social-posts.json')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    # Route to command handler
    commands = {
        'add': cmd_add,
        'list': cmd_list,
        'search': cmd_search,
        'update': cmd_update,
        'post': cmd_post,
    }
    
    return commands[args.command](args)

if __name__ == '__main__':
    sys.exit(main())
