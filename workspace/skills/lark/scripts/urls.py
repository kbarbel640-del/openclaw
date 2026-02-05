#!/usr/bin/env python3
"""
快速取得 Lark URLs - 給 Claude 用的 helper
"""

import json
from pathlib import Path

CONFIG_PATH = Path(__file__).parent.parent / "config.json"

def main():
    with open(CONFIG_PATH) as f:
        config = json.load(f)

    print("# Lark URLs for Browser MCP")
    print()
    print(f"Tenant: {config['tenant']['name']}")
    print(f"Base URL: {config['tenant']['base_url']}")
    print()
    print("## Quick Links")
    for name, url in config['urls'].items():
        print(f"- {name}: {url}")
    print()
    print("## Team")
    for name, role in config['team'].items():
        print(f"- {name}: {role}")

if __name__ == "__main__":
    main()
