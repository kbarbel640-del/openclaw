# Ensure PM2 Docker rebuild daemon is running (start or restart).
# Watches Dockerfile and docker-compose.yml; on change runs:
#   docker compose up -d --build --force-recreate openclaw-gateway
autorebuild:
    pnpm exec pm2 restart openclaw-docker-watch 2>/dev/null || \
    pnpm exec pm2 start scripts/watch-docker.mjs --name openclaw-docker-watch
