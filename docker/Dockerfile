FROM node:20-bookworm-slim

# Install dependencies (including jq for JSON handling)
RUN apt-get update && \
    apt-get install -y \
        git \
        curl \
        unzip \
        iproute2 \
        jq \
        && \
    rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN npm install -g pnpm

# Install Bun (required for OpenClaw build)
RUN curl -fsSL https://bun.sh/install | bash && \
    ln -s /root/.bun/bin/bun /usr/local/bin/bun

# Create claw user and directories with proper ownership
RUN useradd -m -d /claw -s /bin/bash claw && \
    mkdir -p /claw/workspace && \
    mkdir -p /claw/.openclaw && \
    chown -R claw:claw /claw

# Clone and build OpenClaw from the trusted-proxy feature branch
WORKDIR /tmp/openclaw-build
RUN git clone --depth 1 --branch feat/trusted-proxy-auth \
    https://github.com/nickytonline/openclaw.git . && \
    pnpm install && \
    pnpm build && \
    pnpm pack && \
    npm install -g openclaw-*.tgz && \
    cd / && \
    rm -rf /tmp/openclaw-build

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Set working directory
WORKDIR /claw/workspace

# Expose gateway port
EXPOSE 18789

# Run as claw user (ownership set in entrypoint before config commands)
USER root
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
