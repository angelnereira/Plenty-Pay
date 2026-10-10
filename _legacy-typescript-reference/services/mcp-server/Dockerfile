# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 mcpuser
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/proto ./proto
COPY --from=builder /app/node_modules ./node_modules
USER mcpuser
CMD ["node", "dist/server.js"]
