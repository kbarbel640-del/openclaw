# Tail gateway 容器 log 至 logs/openclaw-gateway.log，內建依大小 rotation（10MB × 3 檔）
logs-tail:
    node docker/gateway-logs-tail.mjs

# Ensure PM2 Docker rebuild daemon is running (start or restart).
# Watches Dockerfile and docker-compose.yml; on change runs just up.
# 同時自動啟動 logs-tail，將 gateway 容器 log 寫入 logs/openclaw-gateway.log
# PM2 --watch docker: 監控 docker/ 變更時自動重啟 openclaw-docker-watch 以載入新邏輯
autorebuild:
    pnpm exec pm2 restart openclaw-docker-watch --log-date-format 'YYYY-MM-DD HH:mm:ss.SSS' 2>/dev/null || \
    pnpm exec pm2 start docker/watch-docker.mjs --name openclaw-docker-watch --watch docker \
        --log-date-format 'YYYY-MM-DD HH:mm:ss.SSS'

# BUILDKIT_PROGRESS=plain 輸出步驟文字，方便分析各層耗時
rebuild:
    BUILDKIT_PROGRESS=plain docker compose up -d --build --force-recreate openclaw-gateway
    docker compose logs -f openclaw-gateway
up:
    BUILDKIT_PROGRESS=plain docker compose up -d --build --force-recreate openclaw-gateway
# build-app：建 Control UI（容器內 volume 掛載後 dist/control-ui 可能不存在，需啟動時建）
# start：前置（tailscale 等） + build-app + exec；Docker ENTRYPOINT 與本地皆可用
# 例：just start node /app/openclaw.mjs gateway --tailscale serve
build-app:
    pnpm ui:build

start *ARGS:
    bash docker/docker-entrypoint.sh --setup-only {{ ARGS }}
    just build-app
    bash -c 'exec "$@"' bash {{ ARGS }}
