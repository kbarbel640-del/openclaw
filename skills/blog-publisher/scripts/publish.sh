#!/usr/bin/env bash
set -euo pipefail

# Blog Platform Detector & Publisher
# Usage: publish.sh [options]
#
# Detects the blog platform in the current directory and creates/publishes a post.
#
# Options:
#   --title "Title"       Post title (required)
#   --content file.md     Markdown content file (required)
#   --tags "t1,t2"        Comma-separated tags
#   --draft               Create as draft (default: published)
#   --slug "custom-slug"  Custom URL slug (auto-generated from title if omitted)
#   --dir /path/to/blog   Blog project directory (default: current dir)

TITLE=""
CONTENT_FILE=""
TAGS=""
DRAFT=false
SLUG=""
BLOG_DIR="."

while [[ $# -gt 0 ]]; do
  case $1 in
    --title) TITLE="$2"; shift 2 ;;
    --content) CONTENT_FILE="$2"; shift 2 ;;
    --tags) TAGS="$2"; shift 2 ;;
    --draft) DRAFT=true; shift ;;
    --slug) SLUG="$2"; shift 2 ;;
    --dir) BLOG_DIR="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$TITLE" || -z "$CONTENT_FILE" ]]; then
  echo "Usage: publish.sh --title \"Post Title\" --content content.md [options]"
  echo ""
  echo "Options:"
  echo "  --tags \"tag1,tag2\"   Comma-separated tags"
  echo "  --draft              Create as draft"
  echo "  --slug \"url-slug\"    Custom slug"
  echo "  --dir /path/to/blog  Blog directory"
  exit 1
fi

if [[ ! -f "$CONTENT_FILE" ]]; then
  echo "Error: Content file not found: $CONTENT_FILE"
  exit 1
fi

cd "$BLOG_DIR"

# Generate slug from title if not provided
if [[ -z "$SLUG" ]]; then
  SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-' | sed 's/--*/-/g; s/^-//; s/-$//')
fi

DATE=$(date +%Y-%m-%d)
DATETIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
CONTENT=$(cat "$CONTENT_FILE")

# Build tags YAML (includes leading newline to avoid blank line when empty)
TAGS_YAML=""
if [[ -n "$TAGS" ]]; then
  TAGS_YAML=$'\n'"tags: [$(echo "$TAGS" | tr ',' '\n' | sed 's/^ *//;s/ *$//' | sed 's/.*/"&"/' | paste -sd',' - | sed 's/,/, /g')]"
fi

DRAFT_VAL="false"
if [[ "$DRAFT" == "true" ]]; then
  DRAFT_VAL="true"
fi

# --- Platform Detection ---

detect_platform() {
  if [[ -f "hugo.toml" || -f "config.toml" ]] && grep -q "baseURL" config.toml hugo.toml 2>/dev/null; then
    echo "hugo"
  elif [[ -f "_config.yml" && -d "_posts" ]]; then
    echo "jekyll"
  elif [[ -f "astro.config.mjs" || -f "astro.config.ts" ]] && [[ -d "src/content" ]]; then
    echo "astro"
  elif [[ -f "next.config.js" || -f "next.config.mjs" || -f "next.config.ts" ]]; then
    echo "nextjs"
  elif [[ -n "${GHOST_API_URL:-}" && -n "${GHOST_ADMIN_API_KEY:-}" ]]; then
    echo "ghost"
  elif [[ -n "${WP_API_URL:-}" && -n "${WP_APP_PASSWORD:-}" ]]; then
    echo "wordpress"
  else
    echo "unknown"
  fi
}

PLATFORM=$(detect_platform)
echo "Detected platform: ${PLATFORM}"

# --- Platform-specific publishing ---

case "$PLATFORM" in
  hugo)
    POST_DIR="content/posts"
    mkdir -p "$POST_DIR"
    POST_FILE="${POST_DIR}/${DATE}-${SLUG}.md"

    cat > "$POST_FILE" << FRONTMATTER
---
title: "${TITLE}"
date: ${DATETIME}
draft: ${DRAFT_VAL}${TAGS_YAML}
---

${CONTENT}
FRONTMATTER

    echo "Created: ${POST_FILE}"

    # Verify build
    if command -v hugo &>/dev/null; then
      echo "Verifying build..."
      hugo --quiet
      echo "Hugo build OK."
    fi
    ;;

  jekyll)
    POST_DIR="_posts"
    POST_FILE="${POST_DIR}/${DATE}-${SLUG}.md"

    cat > "$POST_FILE" << FRONTMATTER
---
layout: post
title: "${TITLE}"
date: ${DATETIME}${TAGS_YAML}
published: $(if [[ "$DRAFT" == "true" ]]; then echo "false"; else echo "true"; fi)
---

${CONTENT}
FRONTMATTER

    echo "Created: ${POST_FILE}"

    if command -v jekyll &>/dev/null; then
      echo "Verifying build..."
      jekyll build --quiet 2>/dev/null && echo "Jekyll build OK." || echo "Warning: Jekyll build had issues"
    fi
    ;;

  astro)
    POST_DIR="src/content/blog"
    mkdir -p "$POST_DIR"
    POST_FILE="${POST_DIR}/${SLUG}.md"

    cat > "$POST_FILE" << FRONTMATTER
---
title: "${TITLE}"
pubDate: ${DATETIME}
description: ""
draft: ${DRAFT_VAL}${TAGS_YAML}
---

${CONTENT}
FRONTMATTER

    echo "Created: ${POST_FILE}"

    echo "Verifying build..."
    npx astro check 2>/dev/null && echo "Astro check OK." || echo "Warning: Astro check had issues"
    ;;

  nextjs)
    # Common content dirs for Next.js blogs
    for dir in "content/posts" "content/blog" "posts" "_posts" "data/blog"; do
      if [[ -d "$dir" ]]; then
        POST_DIR="$dir"
        break
      fi
    done
    POST_DIR="${POST_DIR:-content/posts}"
    mkdir -p "$POST_DIR"
    POST_FILE="${POST_DIR}/${SLUG}.md"

    cat > "$POST_FILE" << FRONTMATTER
---
title: "${TITLE}"
date: "${DATETIME}"${TAGS_YAML}
draft: ${DRAFT_VAL}
---

${CONTENT}
FRONTMATTER

    echo "Created: ${POST_FILE}"
    ;;

  ghost)
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    bash "${SCRIPT_DIR}/publish-ghost.sh" \
      --title "$TITLE" \
      --content "$CONTENT_FILE" \
      --tags "${TAGS}" \
      --status "$(if [[ "$DRAFT" == "true" ]]; then echo "draft"; else echo "published"; fi)"
    exit $?
    ;;

  wordpress)
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    bash "${SCRIPT_DIR}/publish-wp.sh" \
      --title "$TITLE" \
      --content "$CONTENT_FILE" \
      --status "$(if [[ "$DRAFT" == "true" ]]; then echo "draft"; else echo "publish"; fi)"
    exit $?
    ;;

  *)
    echo "Error: Could not detect blog platform in $(pwd)"
    echo ""
    echo "Supported platforms:"
    echo "  - Hugo (hugo.toml or config.toml)"
    echo "  - Jekyll (_config.yml + _posts/)"
    echo "  - Astro (astro.config.* + src/content/)"
    echo "  - Next.js (next.config.* + content dir)"
    echo "  - Ghost (GHOST_API_URL + GHOST_ADMIN_API_KEY env vars)"
    echo "  - WordPress (WP_API_URL + WP_APP_PASSWORD env vars)"
    exit 1
    ;;
esac

# Git commit and push for static platforms
if [[ "$PLATFORM" != "ghost" && "$PLATFORM" != "wordpress" ]]; then
  if git rev-parse --is-inside-work-tree &>/dev/null; then
    echo ""
    echo "Committing and pushing..."
    git add "${POST_FILE}"
    git commit -m "blog: add post - ${TITLE}"
    git push
    echo "Published via git push."
  else
    echo ""
    echo "Not a git repo - file created but not pushed."
    echo "To publish: git add ${POST_FILE} && git commit && git push"
  fi
fi
