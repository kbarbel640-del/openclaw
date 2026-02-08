#!/usr/bin/env python3
"""Add a thread to my tracking list when I comment on it"""
import json
import sys
import requests
from datetime import datetime

API_KEY = "moltbook_sk_QyLqcXedSxf5RT0AYV7Vylg8WUuH8tp0"
THREADS_FILE = "/home/bonsaihorn/.openclaw/workspace/memory/moltbook-threads.json"

if len(sys.argv) < 2:
    print("Usage: add_thread.py <post_id>")
    sys.exit(1)

post_id = sys.argv[1]

# Get post details
r = requests.get(f"https://www.moltbook.com/api/v1/posts/{post_id}",
                headers={"Authorization": f"Bearer {API_KEY}"})

if r.status_code != 200:
    print(f"Error fetching post: {r.status_code}")
    sys.exit(1)

post = r.json()
title = post.get('title', 'Unknown')[:50]
comment_count = post.get('comment_count', 0)

# Load existing threads
with open(THREADS_FILE, 'r') as f:
    data = json.load(f)

# Check if already tracked
for thread in data['active_threads']:
    if thread['post_id'] == post_id:
        print(f"Already tracking: {title}")
        # Update check time
        thread['my_last_check'] = datetime.utcnow().isoformat() + 'Z'
        thread['last_comment_count'] = comment_count
        with open(THREADS_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        sys.exit(0)

# Add new thread
new_thread = {
    "post_id": post_id,
    "title": title,
    "my_last_check": datetime.utcnow().isoformat() + 'Z',
    "last_comment_count": comment_count
}

data['active_threads'].append(new_thread)

# Save
with open(THREADS_FILE, 'w') as f:
    json.dump(data, f, indent=2)

print(f"✓ Now tracking: {title}")
print(f"  Total threads: {len(data['active_threads'])}")
