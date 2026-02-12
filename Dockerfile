# syntax=docker/dockerfile:1
FROM node:22-bookworm

# 清除 proxy 避免 Corepack/npm 連到 127.0.0.1:443 導致 ECONNREFUSED（host 有 proxy 時）
ARG HTTP_PROXY=
ARG HTTPS_PROXY=
ARG http_proxy=
ARG https_proxy=
ENV HTTP_PROXY=
ENV HTTPS_PROXY=
ENV http_proxy=
ENV https_proxy=
ENV NO_PROXY="*"

WORKDIR /app

# Bun 裝到 /app/.bun，之後切到 node 仍可使用（/root 對 node 不可讀）
ENV HOME=/app
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/app/.bun/bin:${PATH}" HOME=/home/node

# 預先 prepare pnpm@10.23.0 避免 workspace 內 pnpm install 時 Corepack 連線下載
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

# apt-get 操作整合至 docker/apt-setup.sh（repo ops、update、install、clean）
ARG OPENCLAW_DOCKER_APT_PACKAGES=""
COPY docker/apt-setup.sh /tmp/apt-setup.sh
RUN chmod +x /tmp/apt-setup.sh \
    && OPENCLAW_DOCKER_APT_PACKAGES="$OPENCLAW_DOCKER_APT_PACKAGES" /tmp/apt-setup.sh \
    && rm /tmp/apt-setup.sh

# just：容器入口改為 just start（前置 + build-app + exec）
RUN curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin

# Homebrew（skills 如 1password、goplaces、summarize、openai-whisper 依賴）；Linux 非互動安裝（Docker 內允許 root）
# 建立 tarball 供 volume 首次掛載時還原；chown node 讓 runtime 可執行 brew install 並持久化（搭配 volume）
RUN mkdir -p /home/linuxbrew \
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

# Phase A：依賴與較少變動的檔（source 變更時此層可快取，節省 pnpm install）
COPY --chown=node:node package.json openclaw.mjs tsdown.config.ts tsconfig.json tsconfig.plugin-sdk.dts.json tsconfig.test.json ./
COPY --chown=node:node packages ./packages
COPY --chown=node:node extensions ./extensions
COPY --chown=node:node apps/shared ./apps/shared
COPY --chown=node:node vendor/a2ui ./vendor/a2ui
COPY --chown=node:node ui/package.json ui/index.html ui/vite.config.ts ui/vitest.config.ts ui/vitest.node.config.ts ./ui/
COPY --chown=node:node ui/public ./ui/public
RUN --mount=type=cache,target=/app/.pnpm-store,id=openclaw-pnpm-store,uid=1000,gid=1000 \
    pnpm install -r --offline --frozen-lockfile

# Gemini CLI（供 onboard Google Gemini CLI OAuth 使用）必須裝在 /app 下，不可改回 /home/node。
# 移至此處：僅 source 變更時可跳過此步驟，節省約 27–49s。
# 若改動此路徑，須同步改 docker-compose.yml 兩處 PATH（openclaw-gateway / openclaw-cli）。
ENV NPM_CONFIG_PREFIX=/app/.npm-global
ENV PATH="/app/.npm-global/bin:${PATH}"
RUN mkdir -p /app/.npm-global
RUN --mount=type=cache,target=/app/.npm,id=openclaw-npm-cache,uid=1000,gid=1000 \
    env -i HOME=/home/node PATH="/app/.npm-global/bin:/usr/local/bin:/usr/bin:/bin" NPM_CONFIG_PREFIX=/app/.npm-global \
    sh -c 'npm install -g npm@latest && npm install -g @google/gemini-cli --prefer-offline'

# Phase B：源碼與 scripts（變更較頻繁；僅此層變時跳過 pnpm install 與 gemini-cli）
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node src ./src
COPY --chown=node:node ui/src ./ui/src
COPY --chown=node:node docker/docker-entrypoint.sh docker/docker-gateway-entrypoint.sh ./docker/
RUN chmod +x docker/docker-entrypoint.sh docker/docker-gateway-entrypoint.sh
# 開發環境不在 image build 階段產生 dist；runtime 由 tsx/vite dev 直接跑 src/ui。
ENV OPENCLAW_PREFER_PNPM=1

ENV NODE_ENV=development

# Start gateway server with default config.
# Binds to loopback (127.0.0.1) by default for security.
#
# For container platforms requiring external health checks:
#   1. Set OPENCLAW_GATEWAY_TOKEN or OPENCLAW_GATEWAY_PASSWORD env var
#   2. Override command: ["just", "start", "node", "/app/openclaw.mjs", "gateway", "--bind", "lan"]
# gateway entrypoint：前置（tailscale 等） + build-app（Control UI） + exec node（PID 1）
# 用 bash 執行避免 volume 掛載覆蓋 execute bit 導致 Permission denied
ENTRYPOINT ["bash", "/app/docker/docker-gateway-entrypoint.sh"]
CMD ["node", "/app/openclaw.mjs", "gateway", "--allow-unconfigured"]
