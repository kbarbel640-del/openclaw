FROM node:22-bookworm

# Install Bun (required for build scripts)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

RUN corepack enable

WORKDIR /app

ARG OPENCLAW_DOCKER_APT_PACKAGES=""
RUN if [ -n "$OPENCLAW_DOCKER_APT_PACKAGES" ]; then \
      apt-get update && \
      DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends $OPENCLAW_DOCKER_APT_PACKAGES && \
      apt-get clean && \
      rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*; \
    fi

# ── Klyra skill dependencies ──────────────────────────────────────────
# GitHub CLI (gh)
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list && \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      gh ffmpeg python3 python3-pip pipx && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Go (for blogwatcher)
RUN curl -fsSL https://go.dev/dl/go1.23.6.linux-amd64.tar.gz | tar -C /usr/local -xz
ENV PATH="/usr/local/go/bin:/root/go/bin:${PATH}"
RUN go install github.com/Hyaxia/blogwatcher/cmd/blogwatcher@latest && \
    cp /root/go/bin/blogwatcher /usr/local/bin/blogwatcher && \
    rm -rf /usr/local/go /root/go

# npm global tools: bird, clawhub, mcporter, claude-code (coding-agent skill)
RUN npm install -g @steipete/bird clawhub mcporter @anthropic-ai/claude-code

# nano-pdf (Python)
RUN pipx install nano-pdf && \
    ln -s /root/.local/bin/nano-pdf /usr/local/bin/nano-pdf

# himalaya (email CLI) — pre-built binary
RUN curl -fsSL https://github.com/pimalaya/himalaya/releases/download/v1.1.0/himalaya.x86_64-linux.tgz \
      | tar -xz -C /usr/local/bin/ && \
    chmod +x /usr/local/bin/himalaya

# camsnap (camera capture) — pre-built binary
RUN curl -fsSL https://github.com/steipete/camsnap/releases/download/v0.2.0/camsnap_0.2.0_linux_amd64.tar.gz \
      | tar -xz -C /usr/local/bin/ && \
    chmod +x /usr/local/bin/camsnap
# ── End skill dependencies ─────────────────────────────────────────────

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY patches ./patches
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
# Force pnpm for UI build (Bun may fail on ARM/Synology architectures)
ENV OPENCLAW_PREFER_PNPM=1
RUN pnpm ui:build

ENV NODE_ENV=production

# Create openclaw CLI wrapper so the agent can call `openclaw` commands
RUN printf '#!/bin/sh\nexec node /app/dist/index.js "$@"\n' > /usr/local/bin/openclaw && \
    chmod +x /usr/local/bin/openclaw

# Allow non-root user to write temp files during runtime/tests.
RUN chown -R node:node /app

# Security hardening: Run as non-root user
# The node:22-bookworm image includes a 'node' user (uid 1000)
# This reduces the attack surface by preventing container escape via root privileges
USER node

# Start gateway server with default config.
# Binds to loopback (127.0.0.1) by default for security.
#
# For container platforms requiring external health checks:
#   1. Set OPENCLAW_GATEWAY_TOKEN or OPENCLAW_GATEWAY_PASSWORD env var
#   2. Override CMD: ["node","openclaw.mjs","gateway","--allow-unconfigured","--bind","lan"]
CMD ["node", "openclaw.mjs", "gateway", "--allow-unconfigured"]
