# --- Dependencies ----------------------------------------------------------
# Copied wholesale instead of pruning devDependencies: the generated Prisma
# client lives in node_modules/.prisma and is easy to lose when copying pieces.
# A production build can switch to two-stage `npm ci --omit=dev` + copying
# node_modules/.prisma and node_modules/@prisma once that is worth the effort.
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

# --- Runtime ---------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Run as a non-root user: a container escape should not hand over root.
RUN addgroup -S app && adduser -S app -G app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src

RUN chown -R app:app /app
USER app

EXPOSE 4000

# Default command runs the API; workers reuse this image with another command:
#   node src/workers/booking.worker.js
#   node src/workers/expiration.worker.js
CMD ["node", "src/server.js"]
