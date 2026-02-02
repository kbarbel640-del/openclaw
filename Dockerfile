FROM node:22-slim

# Install git (required for some npm dependencies)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Install OpenClaw globally - pin version for reproducibility
RUN npm install -g openclaw@2026.1.30

# Create config directory
RUN mkdir -p /root/.openclaw

# Copy OpenClaw configuration
COPY openclaw.json /root/.openclaw/openclaw.json

# Expose gateway port
EXPOSE 18789

# Run OpenClaw gateway
CMD ["openclaw", "gateway", "--port", "18789"]
