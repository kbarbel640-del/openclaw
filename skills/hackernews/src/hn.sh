#!/usr/bin/env bash

# hacker-news fetching script using simple curl and shell commands
# dependencies: curl (and optionally jq if you want better json parsing, though we do a simple regex here)

LIMIT=${1:-10}

echo "🔥 Hacker News Top $LIMIT Stories 🔥"
echo ""

# Get top stories IDs, properly strip brackets
IDS=$(curl -s https://hacker-news.firebaseio.com/v0/topstories.json | tr -d '[]' | tr ',' ' ')

count=0
for id in $IDS; do
    # Skip empty id
    [ -z "$id" ] && continue
    
    if [ "$count" -eq "$LIMIT" ]; then
        break
    fi
    
    # fetch individual story
    story_json=$(curl -s "https://hacker-news.firebaseio.com/v0/item/${id}.json")
    
    # Extract fields with basic regex to avoid jq dependency on minimal systems
    # For robustness, using grep/sed
    title=$(echo "$story_json" | grep -o '"title":"[^"]*"' | sed 's/"title":"//;s/"//g')
    score=$(echo "$story_json" | grep -o '"score":[0-9]*' | sed 's/"score"://')
    by=$(echo "$story_json" | grep -o '"by":"[^"]*"' | sed 's/"by":"//;s/"//g')
    url=$(echo "$story_json" | grep -o '"url":"[^"]*"' | sed 's/"url":"//;s/"//g')
    
    count=$((count+1))
    
    echo "$count. $title"
    echo "   Points: $score | by: $by"
    if [ -n "$url" ]; then
        echo "   Link: $url"
    fi
    echo "   Comments: https://news.ycombinator.com/item?id=$id"
    echo ""
done
