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

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY patches ./patches
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile

COPY . .
RUN OPENCLAW_A2UI_SKIP_MISSING=1 pnpm build
# Force pnpm for UI build (Bun may fail on ARM/Synology architectures)
ENV OPENCLAW_PREFER_PNPM=1
RUN pnpm ui:build

ENV NODE_ENV=production

# Create startup script that configures OpenAI from env var
RUN cat > /app/docker-entrypoint.sh << 'ENTRYPOINT_EOF'
#!/bin/bash
set -e

STATE_DIR=${OPENCLAW_STATE_DIR:-$HOME/.openclaw}
mkdir -p "$STATE_DIR"
CONFIG_FILE="$STATE_DIR/openclaw.json"

# Build config with OpenAI if API key is provided
if [ ! -f "$CONFIG_FILE" ]; then
  if [ -n "$OPENAI_API_KEY" ]; then
    cat > "$CONFIG_FILE" << EOF
{
  "env": {
    "OPENAI_API_KEY": "$OPENAI_API_KEY"
  },
  "gateway": {
    "controlUi": {
      "allowInsecureAuth": true
    },
    "auth": {
      "mode": "token"
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "openai/gpt-4o"
      }
    }
  }
}
EOF
  else
    cat > "$CONFIG_FILE" << EOF
{
  "gateway": {
    "controlUi": {
      "allowInsecureAuth": true
    },
    "auth": {
      "mode": "token"
    }
  }
}
EOF
  fi
fi

exec node dist/index.js gateway --allow-unconfigured --port ${PORT:-10000} --bind lan
ENTRYPOINT_EOF
RUN chmod +x /app/docker-entrypoint.sh

# Security hardening: Run as non-root user
USER node

CMD ["/app/docker-entrypoint.sh"]
