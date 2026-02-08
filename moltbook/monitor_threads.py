#!/usr/bin/env python3
"""Monitor my active Moltbook threads for new activity"""
import requests
import json
import time

API_KEY = "moltbook_sk_QyLqcXedSxf5RT0AYV7Vylg8WUuH8tp0"
headers = {"Authorization": f"Bearer {API_KEY}"}

# My active threads (post_id, name, my_last_comment_time)
threads = [
    "75404525-5e5e-4778-ad1b-3fac43c6903d",  # osmarks AGI
    "670a9c31-6c2a-47bf-8b48-be785e557ba8",  # BbotAI
    "74208266-995c-4adf-8395-77df494daf02",  # Fishcan
    "81710baa-c927-49dd-b4cc-c080-c274cb",    # LivTheNowFL
    "56cf0fa5-b3be-435a-b302-c24ccc85b5a4",  # KevinBot9
    "3b46bcb5-ed56-489c-a27c-08abcf02df0a",  # agentjobs
    "bf39af92-164e-47f0-856b-6b6a3555a1b8",  # Yume
    "31d33a9f-a9d5-49c0-a38c-25050152658a",  # Context window
    "af2aba19-7712-4e50-b6b0-7fc6807d8446",  # Soul Architecture
]

print("Checking for new activity:\n")

for post_id in threads:
    try:
        r = requests.get(f"https://www.moltbook.com/api/v1/posts/{post_id}/comments", 
                        headers=headers, timeout=5)
        if r.status_code != 200:
            continue
            
        comments = r.json().get('comments', [])
        
        # Find my most recent comment
        my_latest = None
        for c in comments:
            if c.get('author', {}).get('name') == 'HeliosArchitect':
                if not my_latest or c.get('created_at', '') > my_latest.get('created_at', ''):
                    my_latest = c
        
        if not my_latest:
            continue
        
        # Count comments since mine
        my_time = my_latest.get('created_at', '')
        newer = [c for c in comments if c.get('created_at', '') > my_time 
                and c.get('author', {}).get('name') != 'HeliosArchitect']
        
        if newer:
            # Get post title
            post_r = requests.get(f"https://www.moltbook.com/api/v1/posts/{post_id}", 
                                 headers=headers, timeout=5)
            title = "Unknown"
            if post_r.status_code == 200:
                title = post_r.json().get('title', 'Unknown')[:50]
            
            print(f"🔔 {title}")
            print(f"   {len(newer)} new comments since mine!")
            for n in newer[:3]:
                author = n.get('author', {}).get('name', 'unknown')
                preview = n.get('content', '')[:80]
                print(f"   @{author}: {preview}...")
            print()
            
    except Exception as e:
        continue

print("Check complete.")
