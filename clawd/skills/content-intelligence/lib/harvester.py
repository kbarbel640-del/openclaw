"""
Harvester - Fetches historical content from various platforms.
Supports: Substack, YouTube, RSS feeds
"""

import json
import re
import subprocess
from pathlib import Path
from datetime import datetime
from urllib.parse import urlparse, urljoin

CIS_ROOT = Path.home() / "clawd" / "content-intelligence"

# Lazy imports for optional dependencies
import requests  # requests is available

def _get_bs4():
    try:
        from bs4 import BeautifulSoup
        return BeautifulSoup
    except ImportError:
        return None


class Harvester:
    """Harvests content from various platforms."""
    
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
            return self._harvest_youtube(source)
        elif platform == 'blog':
            return self._harvest_blog(source)
        else:
            print(f"Platform '{platform}' not yet implemented")
            return False
    
    def _harvest_substack(self, source):
        """Harvest all posts from a Substack."""
        url = source['url']
        safe_name = source['safe_name']
        archive_dir = CIS_ROOT / "sources" / safe_name / "archive"
        
        print("Fetching Substack archive...")
        
        try:
            # Fetch the archive page
            response = self.session.get(f"{url}/archive", timeout=30)
            response.raise_for_status()
            html = response.text
            
            # Try bs4 first, fallback to regex
            BeautifulSoup = _get_bs4()
            
            if BeautifulSoup:
                return self._harvest_substack_bs4(source, html)
            else:
                print("Note: Using regex-based parsing (beautifulsoup4 not installed)")
                return self._harvest_substack_regex(source, html)
            
        except Exception as e:
            print(f"Error harvesting Substack: {e}")
            return False
    
    def _harvest_substack_bs4(self, source, html):
        """Harvest using BeautifulSoup."""
        BeautifulSoup = _get_bs4()
        soup = BeautifulSoup(html, 'html.parser')
        
        url = source['url']
        safe_name = source['safe_name']
        archive_dir = CIS_ROOT / "sources" / safe_name / "archive"
        
        # Find all post links
        posts = []
        post_links = soup.find_all('a', href=re.compile(r'/p/'))
        
        for link in post_links:
            href = link.get('href', '')
            if href.startswith('/'):
                href = urljoin(url, href)
            
            slug_match = re.search(r'/p/([^/]+)', href)
            if slug_match:
                slug = slug_match.group(1)
                
                post_file = archive_dir / f"{slug}.json"
                if post_file.exists():
                    continue
                
                posts.append({
                    'slug': slug,
                    'url': href,
                    'title': link.get_text(strip=True) or slug
                })
        
        return self._process_posts(source, posts)
    
    def _harvest_substack_regex(self, source, html):
        """Harvest using regex (fallback)."""
        url = source['url']
        safe_name = source['safe_name']
        archive_dir = CIS_ROOT / "sources" / safe_name / "archive"
        
        # Find posts using multiple patterns for robustness
        posts = []
        seen_slugs = set()
        
        # Pattern 1: Look for data-testid="post-preview-title" links
        # Example: <a ... href="https://natejones.substack.com/p/coming-soon" ...>Title</a>
        pattern1 = r'<a[^>]*href="([^"]*\/p\/[^"]+)"[^>]*data-testid="post-preview-title"[^>]*>([^<]+)</a>'
        matches1 = re.findall(pattern1, html)
        
        for href, title in matches1:
            slug_match = re.search(r'/p/([^/]+)', href)
            if slug_match:
                slug = slug_match.group(1)
                if slug in seen_slugs:
                    continue
                seen_slugs.add(slug)
                
                post_file = archive_dir / f"{slug}.json"
                if post_file.exists():
                    continue
                
                full_url = href if href.startswith('http') else f"{url}{href}"
                posts.append({
                    'slug': slug,
                    'url': full_url,
                    'title': title.strip()
                })
        
        # Pattern 2: Any link with /p/ in it (broader match)
        if not posts:
            pattern2 = r'href="([^"]*\/p\/[^"]+)"[^>]*>([^<]{5,200})</a>'
            matches2 = re.findall(pattern2, html)
            
            for href, title in matches2:
                slug_match = re.search(r'/p/([^/]+)', href)
                if slug_match:
                    slug = slug_match.group(1)
                    if slug in seen_slugs:
                        continue
                    seen_slugs.add(slug)
                    
                    post_file = archive_dir / f"{slug}.json"
                    if post_file.exists():
                        continue
                    
                    full_url = href if href.startswith('http') else f"{url}{href}"
                    posts.append({
                        'slug': slug,
                        'url': full_url,
                        'title': re.sub(r'<[^>]+>', '', title).strip()[:200]
                    })
        
        # Pattern 3: Extract from JSON data if present
        if not posts:
            json_match = re.search(r'window\._preloads\s*=\s*JSON\.parse\("([^"]+)"\)', html)
            if json_match:
                try:
                    # Unescape the JSON string
                    json_str = json_match.group(1).encode('utf-8').decode('unicode_escape')
                    data = json.loads(json_str)
                    
                    # Look for posts in newPostsForArchive
                    new_posts = data.get('newPostsForArchive', {}).get('pub', [])
                    for post in new_posts:
                        slug = post.get('slug')
                        if not slug or slug in seen_slugs:
                            continue
                        seen_slugs.add(slug)
                        
                        post_file = archive_dir / f"{slug}.json"
                        if post_file.exists():
                            continue
                        
                        posts.append({
                            'slug': slug,
                            'url': f"{url}/p/{slug}",
                            'title': post.get('title', 'Untitled')
                        })
                except:
                    pass
        
        return self._process_posts(source, posts)
    
    def _process_posts(self, source, posts):
        """Process harvested posts."""
        safe_name = source['safe_name']
        archive_dir = CIS_ROOT / "sources" / safe_name / "archive"
        
        # Remove duplicates
        seen_slugs = set()
        unique_posts = []
        for p in posts:
            if p['slug'] not in seen_slugs:
                seen_slugs.add(p['slug'])
                unique_posts.append(p)
        
        print(f"Found {len(unique_posts)} posts to harvest")
        
        harvested = 0
        for post in unique_posts[:20]:  # Limit to 20 posts
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
    
    def _fetch_substack_post(self, url, slug=None, title=None):
        """Fetch and parse a single Substack post."""
        response = self.session.get(url, timeout=30)
        response.raise_for_status()
        html = response.text
        
        # Try bs4 first, fallback to regex
        BeautifulSoup = _get_bs4()
        
        if BeautifulSoup:
            return self._fetch_post_bs4(html, url, slug, title)
        else:
            return self._fetch_post_regex(html, url, slug, title)
    
    def _fetch_post_bs4(self, html, url, slug, title):
        """Parse post using BeautifulSoup."""
        BeautifulSoup = _get_bs4()
        soup = BeautifulSoup(html, 'html.parser')
        
        title_elem = soup.find('h1', class_='post-title')
        title = title_elem.get_text(strip=True) if title_elem else (title or 'Untitled')
        
        subtitle_elem = soup.find('h2', class_='post-subtitle')
        subtitle = subtitle_elem.get_text(strip=True) if subtitle_elem else ''
        
        date_elem = soup.find('time')
        published = date_elem.get('datetime') if date_elem else None
        
        content_div = soup.find('div', class_='available-content')
        if not content_div:
            content_div = soup.find('div', class_='body')
        if not content_div:
            content_div = soup.find('article')
        
        content = str(content_div) if content_div else ''
        content_text = content_div.get_text(strip=True) if content_div else ''
        
        author_elem = soup.find('a', class_='author')
        author = author_elem.get_text(strip=True) if author_elem else 'Unknown'
        
        return {
            'url': url,
            'slug': slug or 'unknown',
            'title': title,
            'subtitle': subtitle,
            'author': author,
            'published': published,
            'content_html': content[:5000],
            'content_text': content_text[:3000],
            'harvested_at': datetime.now().isoformat()
        }
    
    def _fetch_post_regex(self, html, url, slug, title):
        """Parse post using regex."""
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
        
        # Extract content
        content_match = re.search(r'<div[^>]*class="[^"]*available-content[^"]*"[^>]*>(.*?)</div>\s*(?:<div class="bottom|</article>|<!--)', html, re.DOTALL)
        if not content_match:
            content_match = re.search(r'<article[^>]*>(.*?)</article>', html, re.DOTALL)
        
        content_html = content_match.group(1) if content_match else ''
        
        # Convert HTML to text
        content_text = re.sub(r'<[^>]+>', ' ', content_html)
        content_text = re.sub(r'\s+', ' ', content_text).strip()
        
        # Get author
        author_match = re.search(r'<a[^>]*class="[^"]*author[^"]*"[^>]*>([^<]+)</a>', html)
        author = author_match.group(1).strip() if author_match else 'Unknown'
        
        return {
            'url': url,
            'slug': slug or 'unknown',
            'title': title or 'Untitled',
            'subtitle': subtitle,
            'author': author,
            'published': published,
            'content_html': content_html[:5000],
            'content_text': content_text[:3000],
            'harvested_at': datetime.now().isoformat()
        }
    
    def _harvest_youtube(self, source):
        """Harvest YouTube video metadata."""
        from yt_dlp import YoutubeDL
        
        url = source['url']
        safe_name = source['safe_name']
        archive_dir = CIS_ROOT / "sources" / safe_name / "archive"
        
        print("Fetching YouTube channel videos...")
        
        try:
            # Use yt-dlp to list videos
            ydl_opts = {
                'quiet': True,
                'extract_flat': True,
                'playlistend': 50,  # Limit to recent 50 videos
            }
            
            with YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                
                if 'entries' not in info:
                    print("No videos found")
                    return False
                
                videos = []
                for entry in info['entries']:
                    if not entry:
                        continue
                    
                    video_id = entry.get('id')
                    if not video_id:
                        continue
                    
                    # Check if already archived
                    video_file = archive_dir / f"{video_id}.json"
                    if video_file.exists():
                        continue
                    
                    videos.append({
                        'id': video_id,
                        'title': entry.get('title', 'Untitled'),
                        'url': f"https://youtube.com/watch?v={video_id}"
                    })
                
                print(f"Found {len(videos)} new videos to catalog")
                
                harvested = 0
                for video in videos:
                    try:
                        # Get full video info
                        video_opts = {
                            'quiet': True,
                            'skip_download': True,
                        }
                        
                        with YoutubeDL(video_opts) as ydl_video:
                            video_info = ydl_video.extract_info(video['url'], download=False)
                            
                            video_data = {
                                'id': video['id'],
                                'url': video['url'],
                                'title': video_info.get('title', ''),
                                'description': video_info.get('description', ''),
                                'duration': video_info.get('duration', 0),
                                'view_count': video_info.get('view_count', 0),
                                'upload_date': video_info.get('upload_date', ''),
                                'channel': video_info.get('channel', ''),
                                'tags': video_info.get('tags', []),
                                'categories': video_info.get('categories', []),
                                'harvested_at': datetime.now().isoformat()
                            }
                            
                            video_file = archive_dir / f"{video['id']}.json"
                            with open(video_file, 'w') as f:
                                json.dump(video_data, f, indent=2)
                            
                            harvested += 1
                            print(f"  Cataloged: {video['title'][:60]}...")
                            
                    except Exception as e:
                        print(f"    Error cataloging {video['id']}: {e}")
                        continue
                
                # Update source metadata
                from source_manager import SourceManager
                manager = SourceManager()
                manager.update_source(safe_name, {
                    'last_harvest': datetime.now().isoformat(),
                    'archive_count': len(list(archive_dir.glob('*.json')))
                })
                
                print(f"\n✓ Cataloged {harvested} new videos")
                print(f"  Total archived: {len(list(archive_dir.glob('*.json')))}")
                return True
                
        except ImportError:
            print("Error: yt-dlp not installed. Install with: pip install yt-dlp")
            return False
        except Exception as e:
            print(f"Error harvesting YouTube: {e}")
            return False
    
    def _harvest_blog(self, source):
        """Harvest from RSS/Atom feed."""
        import feedparser
        
        url = source['url']
        safe_name = source['safe_name']
        archive_dir = CIS_ROOT / "sources" / safe_name / "archive"
        
        print("Fetching RSS feed...")
        
        try:
            # Try to find RSS feed
            feed_url = f"{url}/feed" if not url.endswith('/feed') else url
            
            feed = feedparser.parse(feed_url)
            
            if not feed.entries:
                # Try atom
                feed_url = f"{url}/atom.xml"
                feed = feedparser.parse(feed_url)
            
            if not feed.entries:
                print("No feed entries found")
                return False
            
            entries = []
            for entry in feed.entries:
                entry_id = entry.get('id', entry.get('link', ''))
                entry_slug = re.sub(r'[^a-zA-Z0-9]', '-', entry_id)[:50]
                
                # Check if already archived
                entry_file = archive_dir / f"{entry_slug}.json"
                if entry_file.exists():
                    continue
                
                entries.append({
                    'slug': entry_slug,
                    'title': entry.get('title', 'Untitled'),
                    'link': entry.get('link', ''),
                    'published': entry.get('published', ''),
                    'summary': entry.get('summary', ''),
                    'content': entry.get('content', [{}])[0].get('value', '') if entry.get('content') else ''
                })
            
            print(f"Found {len(entries)} new entries to archive")
            
            harvested = 0
            for entry in entries:
                entry_data = {
                    'slug': entry['slug'],
                    'url': entry['link'],
                    'title': entry['title'],
                    'published': entry['published'],
                    'summary': entry['summary'],
                    'content': entry['content'],
                    'harvested_at': datetime.now().isoformat()
                }
                
                entry_file = archive_dir / f"{entry['slug']}.json"
                with open(entry_file, 'w') as f:
                    json.dump(entry_data, f, indent=2)
                
                harvested += 1
            
            # Update source metadata
            from source_manager import SourceManager
            manager = SourceManager()
            manager.update_source(safe_name, {
                'last_harvest': datetime.now().isoformat(),
                'archive_count': len(list(archive_dir.glob('*.json')))
            })
            
            print(f"\n✓ Archived {harvested} new entries")
            print(f"  Total archived: {len(list(archive_dir.glob('*.json')))}")
            return True
            
        except ImportError:
            print("Error: feedparser not installed. Install with: pip install feedparser")
            return False
        except Exception as e:
            print(f"Error harvesting blog: {e}")
            return False
