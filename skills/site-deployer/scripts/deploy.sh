#!/usr/bin/env bash
set -euo pipefail

# Site Deployer CLI - Deploy to multiple platforms
# Usage: deploy.sh <platform> [options]
#
# Platforms: vercel, netlify, cloudflare, gh-pages, fly, railway, auto
# Requires: npx, git

detect_framework() {
  if [[ -f "next.config.js" || -f "next.config.mjs" || -f "next.config.ts" ]]; then
    echo "nextjs"
  elif [[ -f "astro.config.mjs" || -f "astro.config.ts" ]]; then
    echo "astro"
  elif [[ -f "nuxt.config.ts" || -f "nuxt.config.js" ]]; then
    echo "nuxt"
  elif [[ -f "vite.config.ts" || -f "vite.config.js" ]]; then
    echo "vite"
  elif [[ -f "hugo.toml" || -f "config.toml" ]] && command -v hugo &>/dev/null; then
    echo "hugo"
  elif [[ -f "_config.yml" && -d "_posts" ]]; then
    echo "jekyll"
  elif [[ -f "index.html" ]]; then
    echo "static"
  else
    echo "unknown"
  fi
}

detect_build_dir() {
  local framework="$1"
  case "$framework" in
    nextjs) echo ".next" ;;
    astro)  echo "dist" ;;
    nuxt)   echo ".output/public" ;;
    vite)   echo "dist" ;;
    hugo)   echo "public" ;;
    jekyll) echo "_site" ;;
    static) echo "." ;;
    *)      echo "dist" ;;
  esac
}

detect_build_cmd() {
  if [[ -f "package.json" ]]; then
    local has_build
    has_build=$(jq -r '.scripts.build // empty' package.json 2>/dev/null)
    if [[ -n "$has_build" ]]; then
      if [[ -f "pnpm-lock.yaml" ]]; then
        echo "pnpm build"
      elif [[ -f "yarn.lock" ]]; then
        echo "yarn build"
      elif [[ -f "bun.lockb" ]]; then
        echo "bun run build"
      else
        echo "npm run build"
      fi
      return
    fi
  fi

  local framework
  framework=$(detect_framework)
  case "$framework" in
    hugo)   echo "hugo" ;;
    jekyll) echo "jekyll build" ;;
    *)      echo "" ;;
  esac
}

auto_select_platform() {
  local framework
  framework=$(detect_framework)

  case "$framework" in
    nextjs)          echo "vercel" ;;
    astro|hugo|jekyll|static) echo "netlify" ;;
    nuxt|vite)       echo "vercel" ;;
    *)
      if [[ -f "Dockerfile" ]]; then
        echo "fly"
      elif [[ -f "vercel.json" ]]; then
        echo "vercel"
      elif [[ -f "netlify.toml" ]]; then
        echo "netlify"
      elif [[ -f "wrangler.toml" ]]; then
        echo "cloudflare"
      elif [[ -f "fly.toml" ]]; then
        echo "fly"
      else
        echo "vercel"
      fi
      ;;
  esac
}

build_project() {
  local build_cmd
  build_cmd=$(detect_build_cmd)

  if [[ -n "$build_cmd" ]]; then
    echo "Building: ${build_cmd}"

    # Install deps first if package.json exists
    if [[ -f "package.json" ]]; then
      if [[ -f "pnpm-lock.yaml" ]]; then
        pnpm install --frozen-lockfile 2>/dev/null || pnpm install
      elif [[ -f "yarn.lock" ]]; then
        yarn install --frozen-lockfile 2>/dev/null || yarn install
      elif [[ -f "bun.lockb" ]]; then
        bun install
      else
        npm ci 2>/dev/null || npm install
      fi
    fi

    eval "$build_cmd"
    echo "Build complete."
  else
    echo "No build step detected, deploying as-is."
  fi
}

deploy_vercel() {
  local prod="${1:-true}"
  echo "Deploying to Vercel..."

  local args=(--yes)
  if [[ "$prod" == "true" ]]; then
    args+=(--prod)
  fi

  npx vercel "${args[@]}"
}

deploy_netlify() {
  local build_dir="${1:-dist}"
  local prod="${2:-true}"

  echo "Deploying to Netlify (dir: ${build_dir})..."
  build_project

  local args=(deploy --dir="${build_dir}")
  if [[ "$prod" == "true" ]]; then
    args+=(--prod)
  fi

  npx netlify-cli "${args[@]}"
}

deploy_cloudflare() {
  local build_dir="${1:-dist}"
  local project_name="${2:-}"

  echo "Deploying to Cloudflare Pages (dir: ${build_dir})..."
  build_project

  local args=(pages deploy "${build_dir}")
  if [[ -n "$project_name" ]]; then
    args+=(--project-name="${project_name}")
  fi

  npx wrangler "${args[@]}"
}

deploy_gh_pages() {
  local build_dir="${1:-dist}"

  echo "Deploying to GitHub Pages (dir: ${build_dir})..."
  build_project

  npx gh-pages -d "${build_dir}"
  echo "Deployed to GitHub Pages."

  # Show the URL
  if command -v gh &>/dev/null; then
    local repo
    repo=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null || true)
    if [[ -n "$repo" ]]; then
      local owner="${repo%%/*}"
      local name="${repo##*/}"
      echo "URL: https://${owner}.github.io/${name}/"
    fi
  fi
}

deploy_fly() {
  echo "Deploying to Fly.io..."

  if [[ ! -f "fly.toml" ]]; then
    echo "No fly.toml found. Running 'flyctl launch'..."
    flyctl launch --no-deploy
  fi

  flyctl deploy
}

deploy_railway() {
  echo "Deploying to Railway..."
  railway up
}

# --- Main ---

PLATFORM="${1:-auto}"
shift || true

BUILD_DIR=""
PROD="true"
PROJECT_NAME=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --dir) BUILD_DIR="$2"; shift 2 ;;
    --staging) PROD="false"; shift ;;
    --project) PROJECT_NAME="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Auto-detect platform
if [[ "$PLATFORM" == "auto" ]]; then
  PLATFORM=$(auto_select_platform)
  echo "Auto-detected platform: ${PLATFORM}"
fi

# Auto-detect build dir if not specified
if [[ -z "$BUILD_DIR" ]]; then
  framework=$(detect_framework)
  BUILD_DIR=$(detect_build_dir "$framework")
  echo "Framework: ${framework}, Build dir: ${BUILD_DIR}"
fi

echo "---"
echo "Platform:  ${PLATFORM}"
echo "Build dir: ${BUILD_DIR}"
echo "Mode:      $(if [[ "$PROD" == "true" ]]; then echo "production"; else echo "staging/preview"; fi)"
echo "---"

case "$PLATFORM" in
  vercel)     deploy_vercel "$PROD" ;;
  netlify)    deploy_netlify "$BUILD_DIR" "$PROD" ;;
  cloudflare) deploy_cloudflare "$BUILD_DIR" "$PROJECT_NAME" ;;
  gh-pages)   deploy_gh_pages "$BUILD_DIR" ;;
  fly)        deploy_fly ;;
  railway)    deploy_railway ;;
  *)
    echo "Unknown platform: ${PLATFORM}"
    echo ""
    echo "Supported: vercel, netlify, cloudflare, gh-pages, fly, railway, auto"
    exit 1
    ;;
esac

echo ""
echo "Deployment complete!"
