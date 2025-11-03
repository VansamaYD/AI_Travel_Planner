# Multi-stage Dockerfile for Next.js app (production)
# Build stage
# 使用 Node.js 20 以获得更好的 ESM/CommonJS 兼容性
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (including dev dependencies for build)
# 如果 package-lock.json 有问题，使用 npm install
RUN npm install

# Copy application files
COPY . .

# 在构建时传入 NEXT_PUBLIC_* 环境变量
# 这些变量会被 Next.js 嵌入到客户端代码中
# 注意：ARG 在构建时使用，ENV 在运行时使用
# 这里使用 --build-arg 传入，然后在构建时设置 ENV
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_AMAP_KEY
ARG NEXT_PUBLIC_BASE_URL

# 将这些构建参数设置为环境变量，供构建时使用
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_AMAP_KEY=$NEXT_PUBLIC_AMAP_KEY
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL

# Build the Next.js application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
# 不使用 standalone 模式，直接复制构建产物和依赖
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/polyfills.server.js ./polyfills.server.js

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 使用 npm start 启动 Next.js
CMD ["npm", "run", "start"]
