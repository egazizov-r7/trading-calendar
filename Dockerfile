# Stage 1: install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

# Stage 2: build Next.js app
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN touch /app/service-account.json
RUN echo '{}' > /app/service-account.json
RUN npm run build

# Stage 3: production runtime (minimal image)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy only what's needed for standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/column-mapping.json ./column-mapping.json
COPY --from=builder --chown=nextjs:nodejs /app/timeline-config.json ./timeline-config.json
RUN touch /app/service-account.json
RUN echo '{}' > /app/service-account.json

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
