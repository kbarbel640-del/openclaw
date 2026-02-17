# Stage 1: Build admin dashboard
FROM node:22-alpine AS admin-builder
RUN corepack enable
WORKDIR /app/admin
COPY admin/package.json admin/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
COPY admin/ .
RUN pnpm run build

# Stage 2: Build backend
FROM node:22-alpine AS backend-builder
RUN corepack enable && apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# Stage 3: Final image (production deps only)
FROM node:22-alpine
RUN corepack enable && apk add --no-cache python3 make g++ curl
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=backend-builder /app/dist ./dist
COPY --from=admin-builder /app/admin/dist ./admin/dist
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 9876
CMD ["node", "dist/index.js"]
