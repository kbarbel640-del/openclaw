#!/usr/bin/env python3
"""Probe Sora UI via CDP accessibility tree to find actionable labels."""
import asyncio
import json
import sys
sys.path.insert(0, "/Users/sulaxd/clawd/skills/sora-factory/scripts")
from sora_browser_driver import SoraBrowserDriver

CFG = "/Users/sulaxd/clawd/skills/sora-factory/assets/sora_browser_config.yaml"

d = SoraBrowserDriver.from_config_file(CFG)

async def main():
    await d._attach()
    await d._navigate(d.config.submit_url)
    tree = await d.conn.call("Accessibility.getFullAXTree")
    nodes = tree.get("nodes", [])
    keywords = ("generate", "create", "download", "library", "submit", "start")
    hits = []
    for n in nodes:
        name = (n.get("name") or {}).get("value", "")
        role = (n.get("role") or {}).get("value", "")
        if name and any(k in name.lower() for k in keywords):
            hits.append({"name": name, "role": role, "backendDOMNodeId": n.get("backendDOMNodeId")})
    print(json.dumps(hits[:50], ensure_ascii=False, indent=2))

asyncio.run(main())
