FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY . .
RUN npm run build
USER node
EXPOSE 9876
CMD ["node", "dist/index.js"]
