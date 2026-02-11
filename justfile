# Ensure PM2 Docker rebuild daemon is running (start or restart).
# Watches Dockerfile and docker-compose.yml; on change runs:
#   docker compose up -d --build --force-recreate openclaw-gateway
autorebuild:
    pnpm exec pm2 restart openclaw-docker-watch 2>/dev/null || \
    pnpm exec pm2 start scripts/watch-docker.mjs --name openclaw-docker-watch

# build-app：建 Control UI（容器內 volume 掛載後 dist/control-ui 可能不存在，需啟動時建）
# start：前置（tailscale 等） + build-app + exec；Docker ENTRYPOINT 與本地皆可用
# 例：just start node /app/openclaw.mjs gateway --tailscale serve
build-app:
    pnpm ui:build

start *ARGS:
    bash scripts/docker-entrypoint.sh --setup-only {{ ARGS }}
    just build-app
    bash -c 'exec "$@"' bash {{ ARGS }}
