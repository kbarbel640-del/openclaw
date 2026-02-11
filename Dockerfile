# syntax=docker/dockerfile:1
FROM node:22-bookworm

WORKDIR /app

# Bun 裝到 /app/.bun，之後切到 node 仍可使用（/root 對 node 不可讀）
ENV HOME=/app
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/app/.bun/bin:${PATH}" HOME=/home/node

RUN corepack enable && corepack use pnpm@latest

ARG OPENCLAW_DOCKER_APT_PACKAGES=""
RUN if [ -n "$OPENCLAW_DOCKER_APT_PACKAGES" ]; then \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends $OPENCLAW_DOCKER_APT_PACKAGES && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*; \
    fi

# Docker CLI + buildx：gateway 容器需用主機 Docker 跑 sandbox（搭配 /var/run/docker.sock 掛載）
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable" \
        > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        docker-ce-cli \
        docker-buildx-plugin \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

# Tailscale CLI/runtime for gateway --tailscale modes.
RUN curl -fsSL https://pkgs.tailscale.com/stable/debian/bookworm.noarmor.gpg \
      | tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null \
    && curl -fsSL https://pkgs.tailscale.com/stable/debian/bookworm.tailscale-keyring.list \
      | tee /etc/apt/sources.list.d/tailscale.list >/dev/null \
    && apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends tailscale \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

# just：容器入口改為 just start（前置 + build-app + exec）
RUN curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin

# Homebrew（skills 如 1password、goplaces、summarize、openai-whisper 依賴）；Linux 非互動安裝（Docker 內允許 root）
# 建立 tarball 供 volume 首次掛載時還原；chown node 讓 runtime 可執行 brew install 並持久化（搭配 volume）
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        build-essential procps file git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/* \
    && mkdir -p /home/linuxbrew \
    && touch /.dockerenv \
    && NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" \
    && rm -rf /root/.cache/Homebrew \
    && tar cf /tmp/brew-initial.tar -C /home/linuxbrew . \
    && chown -R node:node /home/linuxbrew
ENV PATH="/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:${PATH}"

# 之後全部以 node 執行；COPY 預設為 root 擁有，須 --chown=node:node 讓 pnpm 可寫入
# corepack/pnpm 會寫入 /home/node/.cache，須先建立並設權限
RUN chown -Rv node:node /app && mkdir -p /home/node/.cache && chown -R node:node /home/node
USER node

# 安裝 uv（二進位）供 skills（如 local-places、nano-banana-pro）使用
RUN brew install uv

# 僅用 lockfile 預填 store，lockfile 未變時此層可快取，避免 package.json 小改就重抓
ENV npm_config_store_dir=/app/.pnpm-store
COPY --chown=node:node pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY --chown=node:node patches ./patches
RUN --mount=type=cache,target=/app/.pnpm-store,id=openclaw-pnpm-store,uid=1000,gid=1000 \
    pnpm fetch

COPY --chown=node:node . .
RUN --mount=type=cache,target=/app/.pnpm-store,id=openclaw-pnpm-store,uid=1000,gid=1000 \
    pnpm install -r --offline --frozen-lockfile
RUN chmod +x scripts/docker-entrypoint.sh
# 容器入口為 just start（見 repo justfile：前置 + build-app + exec）
# Build tool caches (vite/esbuild/tsc) so rebuilds are faster when layer runs
# A2UI bundle needs vendor/apps (excluded by .dockerignore); skip copy when missing
ENV OPENCLAW_A2UI_SKIP_MISSING=1
RUN --mount=type=cache,target=/app/node_modules/.cache,uid=1000,gid=1000 \
    pnpm build
ENV OPENCLAW_PREFER_PNPM=1
# Control UI 改為容器啟動時 build（just start 內 just build-app），不再在 image 內預建
# Gemini CLI（供 onboard Google Gemini CLI OAuth 使用）必須裝在 /app 下，不可改回 /home/node：
# 執行期 /home/node 常被 volume mount 覆蓋，會導致 .npm-global 消失、which gemini 失敗。
# 若改動此路徑，須同步改 docker-compose.yml 兩處 PATH（openclaw-gateway / openclaw-cli）。
ENV NPM_CONFIG_PREFIX=/app/.npm-global
ENV PATH="/app/.npm-global/bin:${PATH}"
RUN mkdir -p /app/.npm-global
# npm 下載快取用 id 讓 BuildKit 穩定重用；--prefer-offline 優先使用快取
# 使用 env -i 最小環境，避免 build 時繼承 host proxy 或 npm config 導致 ECONNREFUSED 127.0.0.1:443
RUN --mount=type=cache,target=/app/.npm,id=openclaw-npm-cache,uid=1000,gid=1000 \
    env -i HOME=/home/node PATH="/app/.npm-global/bin:/usr/local/bin:/usr/bin:/bin" NPM_CONFIG_PREFIX=/app/.npm-global \
    sh -c 'npm install -g npm@latest && npm install -g @google/gemini-cli --prefer-offline'

ENV NODE_ENV=production

# Start gateway server with default config.
# Binds to loopback (127.0.0.1) by default for security.
#
# For container platforms requiring external health checks:
#   1. Set OPENCLAW_GATEWAY_TOKEN or OPENCLAW_GATEWAY_PASSWORD env var
#   2. Override command: ["just", "start", "node", "/app/openclaw.mjs", "gateway", "--bind", "lan"]
# just start = entrypoint 前置（tailscale 等） + just build-app（Control UI） + exec
ENTRYPOINT ["just", "start"]
CMD ["node", "/app/openclaw.mjs", "gateway", "--allow-unconfigured"]
