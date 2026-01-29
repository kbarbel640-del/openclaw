"""
Source Manager - Handles CRUD operations for content sources.
"""

import json
import os
from pathlib import Path
from datetime import datetime

CIS_ROOT = Path.home() / "clawd" / "content-intelligence"
CONFIG_FILE = CIS_ROOT / "config" / "sources.json"


class SourceManager:
    """Manages content source configuration and metadata."""
    
    def __init__(self):
        self.config_file = CONFIG_FILE
        self._ensure_config()
    
    def _ensure_config(self):
        """Ensure config file exists."""
        CIS_ROOT.mkdir(parents=True, exist_ok=True)
        (CIS_ROOT / "config").mkdir(exist_ok=True)
        if not self.config_file.exists():
            with open(self.config_file, 'w') as f:
                json.dump({"sources": {}}, f, indent=2)
    
    def _load_config(self):
        """Load configuration from JSON."""
        with open(self.config_file, 'r') as f:
            return json.load(f)
    
    def _save_config(self, config):
        """Save configuration to JSON."""
        with open(self.config_file, 'w') as f:
            json.dump(config, f, indent=2)
    
    def init_source(self, name, url, platform='substack'):
        """Initialize a new content source."""
        config = self._load_config()
        
        if name in config['sources']:
            raise ValueError(f"Source '{name}' already exists")
        
        # Sanitize name for filesystem
        safe_name = name.lower().replace(' ', '-').replace('_', '-')
        
        # Create source directory structure
        source_dir = CIS_ROOT / "sources" / safe_name
        (source_dir / "archive").mkdir(parents=True, exist_ok=True)
        (source_dir / "insights").mkdir(exist_ok=True)
        (source_dir / "metadata").mkdir(exist_ok=True)
        
        source_data = {
            'name': name,
            'safe_name': safe_name,
            'url': url,
            'platform': platform,
            'created_at': datetime.now().isoformat(),
            'status': 'active',
            'last_check': None,
            'last_harvest': None,
            'last_extract': None,
            'archive_count': 0,
            'insight_count': 0
        }
        
        config['sources'][safe_name] = source_data
        self._save_config(config)
        
        # Create metadata file
        metadata_file = source_dir / "metadata" / "source.json"
        with open(metadata_file, 'w') as f:
            json.dump(source_data, f, indent=2)
        
        return source_data
    
    def get_source(self, name):
        """Get source configuration by name."""
        config = self._load_config()
        safe_name = name.lower().replace(' ', '-').replace('_', '-')
        return config['sources'].get(safe_name)
    
    def list_sources(self):
        """List all configured sources."""
        config = self._load_config()
        return config['sources']
    
    def update_source(self, name, updates):
        """Update source configuration."""
        config = self._load_config()
        safe_name = name.lower().replace(' ', '-').replace('_', '-')
        
        if safe_name not in config['sources']:
            raise ValueError(f"Source '{name}' not found")
        
        config['sources'][safe_name].update(updates)
        self._save_config(config)
        
        # Update metadata file
        source_dir = CIS_ROOT / "sources" / safe_name
        metadata_file = source_dir / "metadata" / "source.json"
        with open(metadata_file, 'w') as f:
            json.dump(config['sources'][safe_name], f, indent=2)
        
        return config['sources'][safe_name]
    
    def interactive_add(self):
        """Interactive wizard to add a new source."""
        print("\n=== Add New Content Source ===\n")
        
        name = input("Name (e.g., 'Nate Jones'): ").strip()
        if not name:
            print("Error: Name is required")
            return 1
        
        url = input("Base URL (e.g., 'https://natejones.substack.com'): ").strip()
        if not url:
            print("Error: URL is required")
            return 1
        
        print("\nPlatform options:")
        platforms = ['substack', 'youtube', 'blog', 'twitter', 'podcast']
        for i, p in enumerate(platforms, 1):
            print(f"  {i}. {p}")
        
        platform_choice = input("\nSelect platform (1-5, default=1): ").strip()
        platform = platforms[int(platform_choice) - 1] if platform_choice.isdigit() and 1 <= int(platform_choice) <= 5 else 'substack'
        
        try:
            source = self.init_source(name, url, platform)
            print(f"\n✓ Successfully added source: {name}")
            print(f"  Directory: ~/clawd/content-intelligence/sources/{source['safe_name']}/")
            print(f"\nNext steps:")
            print(f"  1. Run: clawdbot content harvest {source['safe_name']}")
            print(f"  2. Run: clawdbot content extract {source['safe_name']}")
            return 0
        except ValueError as e:
            print(f"Error: {e}")
            return 1
