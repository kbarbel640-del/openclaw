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

# Expose the gateway port
EXPOSE 18789

# Security hardening: Run as non-root user
# The node:22-bookworm image includes a 'node' user (uid 1000)
# This reduces the attack surface by preventing container escape via root privileges
# Create state directory structure (will be overwritten by volume mount if used)
# Make extensions dir readable by node user to avoid permission warnings
RUN mkdir -p /home/node/.openclaw \
    && chown -R node:node /home/node/.openclaw /home/node \
    && chmod -R a+rX /app/extensions 2>/dev/null || true

# Copy and set up entrypoint script
COPY --chown=node:node scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER node

# Default: run the gateway server via entrypoint
# The entrypoint script:
# 1. Creates minimal config on first run (trustedProxies, dangerouslyDisableDeviceAuth, etc.)
# 2. Starts the gateway with --bind lan
# 
# To complete setup, connect your local CLI to the remote gateway:
#   openclaw config set gateway.mode remote
#   openclaw config set gateway.remote.url wss://your-domain.com/ws
#   openclaw config set gateway.remote.token YOUR_TOKEN
#   openclaw status  # verify connection
#   openclaw setup   # complete setup wizard
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD []
