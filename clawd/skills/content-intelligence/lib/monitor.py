"""
Monitor - Checks for new content from tracked sources.
Runs daily checks and generates weekly digests.
"""

import json
import subprocess
from pathlib import Path
from datetime import datetime, timedelta

CIS_ROOT = Path.home() / "clawd" / "content-intelligence"

# Lazy imports for optional dependencies
def _get_requests():
    try:
        import requests
        return requests
    except ImportError:
        return None

def _get_bs4():
    try:
        from bs4 import BeautifulSoup
        return BeautifulSoup
    except ImportError:
        return None

def _get_yt_dlp():
    try:
        from yt_dlp import YoutubeDL
        return YoutubeDL
    except ImportError:
        return None

def _get_feedparser():
    try:
        import feedparser
        return feedparser
    except ImportError:
        return None


class Monitor:
    """Monitors tracked sources for new content."""
    
    def __init__(self):
        self.check_log = CIS_ROOT / "logs" / "monitor_checks.json"
    
    def check_all(self, dry_run=False):
        """Check all sources for new content."""
        from source_manager import SourceManager
        from harvester import Harvester
        
        manager = SourceManager()
        sources = manager.list_sources()
        
        if not sources:
            print("No sources configured. Use 'add-source' to add one.")
            return 0
        
        print(f"Checking {len(sources)} source(s) for new content...\n")
        
        results = []
        
        for name, source in sources.items():
            print(f"--- Checking: {source['name']} ---")
            
            try:
                # Quick check for new content
                new_items = self._check_source(source)
                
                result = {
                    'source': name,
                    'source_name': source['name'],
                    'checked_at': datetime.now().isoformat(),
                    'new_items_found': len(new_items),
                    'new_items': new_items
                }
                
                if new_items:
                    print(f"  Found {len(new_items)} new item(s)")
                    for item in new_items:
                        print(f"    - {item.get('title', 'Untitled')[:60]}...")
                    
                    if not dry_run:
                        # Auto-harvest new items
                        print(f"  Auto-harvesting...")
                        harvester = Harvester()
                        harvester.harvest(name, dry_run=False)
                        
                        # Auto-extract insights
                        print(f"  Auto-extracting insights...")
                        from insight_extractor import InsightExtractor
                        extractor = InsightExtractor()
                        extractor.extract(name, force=False)
                else:
                    print(f"  No new content")
                
                results.append(result)
                
                # Update last check time
                manager.update_source(name, {'last_check': datetime.now().isoformat()})
                
            except Exception as e:
                print(f"  Error checking {name}: {e}")
                results.append({
                    'source': name,
                    'error': str(e),
                    'checked_at': datetime.now().isoformat()
                })
        
        # Save check log
        self._save_check_log(results)
        
        # Generate summary
        total_new = sum(r.get('new_items_found', 0) for r in results)
        print(f"\n✓ Monitor check complete")
        print(f"  Sources checked: {len(sources)}")
        print(f"  New items found: {total_new}")
        
        return 0
    
    def _check_source(self, source):
        """Check a single source for new content."""
        platform = source.get('platform', 'substack')
        url = source['url']
        safe_name = source['safe_name']
        
        archive_dir = CIS_ROOT / "sources" / safe_name / "archive"
        
        # Get list of already archived items
        archived = set()
        if archive_dir.exists():
            archived = {f.stem for f in archive_dir.glob('*.json')}
        
        new_items = []
        
        if platform == 'substack':
            new_items = self._check_substack(url, archived)
        elif platform == 'youtube':
            new_items = self._check_youtube(url, archived)
        elif platform == 'blog':
            new_items = self._check_blog(url, archived)
        
        return new_items
    
    def _check_substack(self, url, archived):
        """Check Substack for new posts."""
        import requests
        from bs4 import BeautifulSoup
        import re
        
        try:
            response = requests.get(f"{url}/archive", timeout=30, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            post_links = soup.find_all('a', href=re.compile(r'/p/'))
            
            new_items = []
            seen = set()
            
            for link in post_links:
                href = link.get('href', '')
                if href.startswith('/'):
                    href = f"{url}{href}"
                
                slug_match = re.search(r'/p/([^/]+)', href)
                if slug_match:
                    slug = slug_match.group(1)
                    
                    if slug not in seen and slug not in archived:
                        seen.add(slug)
                        new_items.append({
                            'slug': slug,
                            'url': href,
                            'title': link.get_text(strip=True) or slug
                        })
            
            return new_items
            
        except Exception as e:
            print(f"    Error checking Substack: {e}")
            return []
    
    def _check_youtube(self, url, archived):
        """Check YouTube channel for new videos."""
        try:
            from yt_dlp import YoutubeDL
            
            ydl_opts = {
                'quiet': True,
                'extract_flat': True,
                'playlistend': 20,
            }
            
            with YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                
                if 'entries' not in info:
                    return []
                
                new_items = []
                for entry in info['entries']:
                    if not entry:
                        continue
                    
                    video_id = entry.get('id')
                    if video_id and video_id not in archived:
                        new_items.append({
                            'id': video_id,
                            'title': entry.get('title', 'Untitled'),
                            'url': f"https://youtube.com/watch?v={video_id}"
                        })
                
                return new_items
                
        except ImportError:
            print("    yt-dlp not installed, skipping YouTube check")
            return []
        except Exception as e:
            print(f"    Error checking YouTube: {e}")
            return []
    
    def _check_blog(self, url, archived):
        """Check RSS/Atom feed for new entries."""
        try:
            import feedparser
            import re
            
            feed_url = f"{url}/feed" if not url.endswith('/feed') else url
            feed = feedparser.parse(feed_url)
            
            new_items = []
            for entry in feed.entries:
                entry_id = entry.get('id', entry.get('link', ''))
                entry_slug = re.sub(r'[^a-zA-Z0-9]', '-', entry_id)[:50]
                
                if entry_slug not in archived:
                    new_items.append({
                        'slug': entry_slug,
                        'title': entry.get('title', 'Untitled'),
                        'link': entry.get('link', '')
                    })
            
            return new_items
            
        except ImportError:
            print("    feedparser not installed, skipping blog check")
            return []
        except Exception as e:
            print(f"    Error checking blog: {e}")
            return []
    
    def _save_check_log(self, results):
        """Save check results to log file."""
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'results': results
        }
        
        # Load existing log
        log_data = []
        if self.check_log.exists():
            try:
                with open(self.check_log, 'r') as f:
                    log_data = json.load(f)
            except:
                log_data = []
        
        # Append new entry
        log_data.append(log_entry)
        
        # Keep only last 100 entries
        log_data = log_data[-100:]
        
        with open(self.check_log, 'w') as f:
            json.dump(log_data, f, indent=2)
    
    def generate_weekly_digest(self):
        """Generate a weekly digest of new content and insights."""
        # Load check logs from past 7 days
        if not self.check_log.exists():
            return None
        
        with open(self.check_log, 'r') as f:
            log_data = json.load(f)
        
        week_ago = datetime.now() - timedelta(days=7)
        
        weekly_items = []
        for entry in log_data:
            entry_time = datetime.fromisoformat(entry['timestamp'])
            if entry_time > week_ago:
                for result in entry.get('results', []):
                    if result.get('new_items_found', 0) > 0:
                        weekly_items.append({
                            'source': result['source_name'],
                            'items': result.get('new_items', [])
                        })
        
        if not weekly_items:
            return None
        
        # Generate digest
        digest = {
            'week_of': week_ago.strftime('%Y-%m-%d'),
            'generated_at': datetime.now().isoformat(),
            'summary': {
                'sources_with_new_content': len(weekly_items),
                'total_new_items': sum(len(i['items']) for i in weekly_items)
            },
            'details': weekly_items
        }
        
        # Save digest
        digest_file = CIS_ROOT / "logs" / f"weekly-digest-{week_ago.strftime('%Y%m%d')}.json"
        with open(digest_file, 'w') as f:
            json.dump(digest, f, indent=2)
        
        return digest
