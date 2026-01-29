"""
Simple Harvester - Fetches content using only requests + regex (no bs4 dependency)
"""

import json
import re
from pathlib import Path
from datetime import datetime
import requests

CIS_ROOT = Path.home() / "clawd" / "content-intelligence"


class SimpleHarvester:
    """Harvests content using requests and regex (no bs4 required)."""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
    
    def harvest(self, name, dry_run=False):
        """Harvest content for a source."""
        from source_manager import SourceManager
        
        manager = SourceManager()
        source = manager.get_source(name)
        
        if not source:
            print(f"Error: Source '{name}' not found")
            return False
        
        platform = source.get('platform', 'substack')
        url = source['url']
        
        print(f"Harvesting from: {source['name']} ({platform})")
        print(f"URL: {url}")
        
        if dry_run:
            print("[DRY RUN] Would harvest content to:", CIS_ROOT / "sources" / source['safe_name'] / "archive")
            return True
        
        if platform == 'substack':
            return self._harvest_substack(source)
        elif platform == 'youtube':
            print(f"YouTube harvesting requires yt-dlp. Install with: pip install yt-dlp")
            return False
        else:
            print(f"Platform '{platform}' not yet implemented in simple harvester")
            return False
    
    def _harvest_substack(self, source):
        """Harvest all posts from a Substack using regex."""
        url = source['url']
        safe_name = source['safe_name']
        archive_dir = CIS_ROOT / "sources" / safe_name / "archive"
        
        print("Fetching Substack archive...")
        
        try:
            # Fetch the archive page
            response = self.session.get(f"{url}/archive", timeout=30)
            response.raise_for_status()
            html = response.text
            
            # Find all post links using regex
            # Substack post links: /p/slug-name
            post_pattern = r'href="(/p/[^"]+)"[^>]*>([^<]+)</a>'
            matches = re.findall(post_pattern, html)
            
            posts = []
            seen_slugs = set()
            
            for href, title in matches:
                slug_match = re.search(r'/p/([^/]+)', href)
                if slug_match:
                    slug = slug_match.group(1)
                    
                    if slug in seen_slugs:
                        continue
                    seen_slugs.add(slug)
                    
                    # Check if already archived
                    post_file = archive_dir / f"{slug}.json"
                    if post_file.exists():
                        continue
                    
                    full_url = f"{url}{href}" if href.startswith('/') else href
                    posts.append({
                        'slug': slug,
                        'url': full_url,
                        'title': title.strip()
                    })
            
            print(f"Found {len(posts)} posts to harvest")
            
            harvested = 0
            for post in posts:
                try:
                    print(f"  Fetching: {post['slug'][:50]}...")
                    post_data = self._fetch_substack_post(post['url'], post['slug'], post['title'])
                    
                    if post_data:
                        post_file = archive_dir / f"{post['slug']}.json"
                        with open(post_file, 'w') as f:
                            json.dump(post_data, f, indent=2)
                        harvested += 1
                except Exception as e:
                    print(f"    Error fetching {post['slug']}: {e}")
                    continue
            
            # Update source metadata
            from source_manager import SourceManager
            manager = SourceManager()
            manager.update_source(safe_name, {
                'last_harvest': datetime.now().isoformat(),
                'archive_count': len(list(archive_dir.glob('*.json')))
            })
            
            print(f"\n✓ Harvested {harvested} new posts")
            print(f"  Total archived: {len(list(archive_dir.glob('*.json')))}")
            return True
            
        except Exception as e:
            print(f"Error harvesting Substack: {e}")
            return False
    
    def _fetch_substack_post(self, url, slug, title):
        """Fetch and parse a single Substack post using regex."""
        response = self.session.get(url, timeout=30)
        response.raise_for_status()
        html = response.text
        
        # Extract title
        title_match = re.search(r'<h1[^>]*class="[^"]*post-title[^"]*"[^>]*>([^<]+)</h1>', html)
        if title_match:
            title = title_match.group(1).strip()
        
        # Extract subtitle
        subtitle_match = re.search(r'<h2[^>]*class="[^"]*post-subtitle[^"]*"[^>]*>([^<]+)</h2>', html)
        subtitle = subtitle_match.group(1).strip() if subtitle_match else ''
        
        # Get published date
        date_match = re.search(r'<time[^>]*datetime="([^"]+)"', html)
        published = date_match.group(1) if date_match else None
        
        # Extract content - look for available-content div
        content_match = re.search(r'<div[^>]*class="[^"]*available-content[^"]*"[^>]*>(.*?)</div>\s*(?:<div class="bottom|</article>|<!--)', html, re.DOTALL)
        if not content_match:
            content_match = re.search(r'<article[^>]*>(.*?)</article>', html, re.DOTALL)
        
        content_html = content_match.group(1) if content_match else ''
        
        # Convert HTML to text (basic)
        content_text = re.sub(r'<[^>]+>', ' ', content_html)
        content_text = re.sub(r'\s+', ' ', content_text).strip()
        
        # Get author
        author_match = re.search(r'<a[^>]*class="[^"]*author[^"]*"[^>]*>([^<]+)</a>', html)
        author = author_match.group(1).strip() if author_match else 'Unknown'
        
        return {
            'url': url,
            'slug': slug,
            'title': title,
            'subtitle': subtitle,
            'author': author,
            'published': published,
            'content_html': content_html[:5000],  # Limit size
            'content_text': content_text[:3000],  # Limit size
            'harvested_at': datetime.now().isoformat()
        }
