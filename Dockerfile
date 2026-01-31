# Use Node.js 22 (OpenClaw requires Node >= 22)
FROM node:22-bullseye-slim

# Install Bun (OpenClaw build scripts use Bun) and pnpm
RUN curl -fsSL https://bun.sh/install | bash && export PATH="/root/.bun/bin:$PATH" \
 && corepack enable

# Set working directory
WORKDIR /app

# Copy only package metadata first (for caching dependencies)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY scripts ./scripts

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the source code and build
COPY . .
RUN pnpm build && pnpm ui:install && pnpm ui:build

# Create the data directory and adjust permissions for the non-root user
RUN mkdir -p /data && chown node:node /data

# Switch to a non-root user (Node user)
USER node

# Expose the gateway port (Railway will map this via $PORT)
EXPOSE 8080

# Default environment (can be overridden by Railway)
ENV NODE_ENV=production \
    OPENCLAW_STATE_DIR=/data/.openclaw \
    OPENCLAW_WORKSPACE_DIR=/data/workspace

# Copy entrypoint script and set entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]

# By default, run the OpenClaw gateway (the entrypoint will handle flags)
CMD ["gateway"]
