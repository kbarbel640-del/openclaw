---
name: youtube-summarize
description: Extract and absorb YouTube video transcripts. Use when Cruz shares a video link or asks to summarize a YouTube video. The goal is not just notes — it's to internalize what Cruz watched so the concepts are in shared context.
---

# YouTube Video Absorber

## Purpose
When Cruz watches a video, extract the transcript so I **know what he knows**. Not just summarize — internalize the concepts, connect them to his projects and thinking.

## How to Extract Transcript

Run via exec-bridge (host machine):

```bash
curl -s -X POST http://host.docker.internal:18793/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "python3 -c \"\nfrom youtube_transcript_api import YouTubeTranscriptApi\nytt = YouTubeTranscriptApi()\nts = ytt.fetch(\\\"VIDEO_ID\\\", languages=[\\\"zh-Hans\\\",\\\"zh-Hant\\\",\\\"zh\\\",\\\"en\\\",\\\"ja\\\"])\nfor s in ts.snippets:\n    print(s.text, end=\\\" \\\")\n\" 2>&1", "timeout": 30}'
```

Replace `VIDEO_ID` with the YouTube video ID (the part after `v=`).

## Workflow

1. Cruz shares a YouTube link
2. Extract video ID from URL
3. Pull transcript via youtube-transcript-api (installed on host: `pip3 install --break-system-packages youtube-transcript-api`)
4. Read and internalize the content
5. Record key concepts in `memory/YYYY-MM-DD.md` under Cruz's viewing log
6. Connect concepts to Cruz's projects/thinking where relevant
7. Reply with acknowledgment — NOT a full summary unless asked

## Dependencies

- `youtube-transcript-api` (Python, installed on host via pip3)
- exec-bridge (port 18793)

## Notes

- Not all videos have transcripts
- Auto-generated subtitles may have errors
- Chinese videos: try `zh-Hans` first, then `zh-Hant`, then `zh`
- Multi-language: specify language codes in order of preference
