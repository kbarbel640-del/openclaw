#!/usr/bin/env python3
"""
Content Intelligence System (CIS) v1.0
CLI tool for tracking, harvesting, and extracting insights from content sources.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from datetime import datetime

# Add lib to path
sys.path.insert(0, str(Path(__file__).parent / "lib"))

from source_manager import SourceManager
try:
    from harvester import Harvester
except ImportError:
    from simple_harvester import SimpleHarvester as Harvester
from insight_extractor import InsightExtractor
from para_router import PARARouter
from monitor import Monitor

CIS_ROOT = Path.home() / "clawd" / "content-intelligence"
CONFIG_FILE = CIS_ROOT / "config" / "sources.json"


def ensure_setup():
    """Ensure CIS directory structure exists."""
    CIS_ROOT.mkdir(parents=True, exist_ok=True)
    (CIS_ROOT / "sources").mkdir(exist_ok=True)
    (CIS_ROOT / "config").mkdir(exist_ok=True)
    (CIS_ROOT / "logs").mkdir(exist_ok=True)
    
    if not CONFIG_FILE.exists():
        with open(CONFIG_FILE, 'w') as f:
            json.dump({"sources": {}}, f, indent=2)


def cmd_init(args):
    """Initialize a new content source."""
    manager = SourceManager()
    source = manager.init_source(args.name, args.url, args.platform)
    print(f"✓ Initialized source: {args.name}")
    print(f"  Platform: {source['platform']}")
    print(f"  URL: {source['url']}")
    print(f"  Created: {source['created_at']}")
    return 0


def cmd_add_source(args):
    """Interactive add new person to track."""
    manager = SourceManager()
    return manager.interactive_add()


def cmd_harvest(args):
    """Fetch historical content for a source."""
    harvester = Harvester()
    
    if args.name == 'all':
        manager = SourceManager()
        sources = manager.list_sources()
        for name in sources:
            print(f"\n--- Harvesting: {name} ---")
            harvester.harvest(name, args.dry_run)
    else:
        result = harvester.harvest(args.name, args.dry_run)
        if not result:
            return 1
    return 0


def cmd_extract(args):
    """AI-powered insight extraction."""
    extractor = InsightExtractor()
    
    if args.name == 'all':
        manager = SourceManager()
        sources = manager.list_sources()
        for name in sources:
            print(f"\n--- Extracting insights: {name} ---")
            extractor.extract(name, args.force)
    else:
        result = extractor.extract(args.name, args.force)
        if not result:
            return 1
    return 0


def cmd_monitor(args):
    """Check for new content."""
    monitor = Monitor()
    return monitor.check_all(args.dry_run)


def cmd_list(args):
    """List all tracked sources."""
    manager = SourceManager()
    sources = manager.list_sources()
    
    if not sources:
        print("No sources tracked yet. Use 'init' or 'add-source' to add one.")
        return 0
    
    print(f"\n{'Name':<20} {'Platform':<12} {'Status':<12} {'Last Check':<20}")
    print("-" * 70)
    
    for name, data in sources.items():
        status = data.get('status', 'unknown')
        last_check = data.get('last_check', 'never')
        platform = data.get('platform', 'unknown')
        print(f"{name:<20} {platform:<12} {status:<12} {last_check}")
    
    return 0


def cmd_route(args):
    """Route insights to PARA categories."""
    router = PARARouter()
    return router.route_insights(args.name, args.dry_run)


def main():
    ensure_setup()
    
    parser = argparse.ArgumentParser(
        description="Content Intelligence System (CIS) - Track and extract insights from content sources",
        prog="clawdbot content"
    )
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # init command
    init_parser = subparsers.add_parser('init', help='Initialize new content source')
    init_parser.add_argument('name', help='Unique name for the source')
    init_parser.add_argument('url', help='Base URL for the source')
    init_parser.add_argument('--platform', choices=['substack', 'youtube', 'blog', 'twitter', 'podcast'], 
                            default='substack', help='Content platform type')
    
    # add-source command
    add_parser = subparsers.add_parser('add-source', help='Interactive: Add new person to track')
    
    # harvest command
    harvest_parser = subparsers.add_parser('harvest', help='Fetch historical content')
    harvest_parser.add_argument('name', help='Source name (or "all" for all sources)')
    harvest_parser.add_argument('--dry-run', action='store_true', help='Show what would be harvested without downloading')
    
    # extract command
    extract_parser = subparsers.add_parser('extract', help='AI-powered insight extraction')
    extract_parser.add_argument('name', help='Source name (or "all" for all sources)')
    extract_parser.add_argument('--force', action='store_true', help='Re-extract even if already processed')
    
    # monitor command
    monitor_parser = subparsers.add_parser('monitor', help='Check for new content')
    monitor_parser.add_argument('--dry-run', action='store_true', help='Show what would be checked without updating')
    
    # list command
    list_parser = subparsers.add_parser('list', help='List all tracked sources')
    
    # route command
    route_parser = subparsers.add_parser('route', help='Route insights to PARA categories')
    route_parser.add_argument('name', nargs='?', default='all', help='Source name (or "all" for all sources)')
    route_parser.add_argument('--dry-run', action='store_true', help='Show routing without saving')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    commands = {
        'init': cmd_init,
        'add-source': cmd_add_source,
        'harvest': cmd_harvest,
        'extract': cmd_extract,
        'monitor': cmd_monitor,
        'list': cmd_list,
        'route': cmd_route,
    }
    
    return commands[args.command](args)


if __name__ == '__main__':
    sys.exit(main())
