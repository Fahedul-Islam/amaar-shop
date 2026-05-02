# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Accept BACKEND_URL as build arg and expose it during build
ARG BACKEND_URL
ENV BACKEND_URL=$BACKEND_URL

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# ---- Run stage ----
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD sh -c "npx next start -p ${PORT:-3000}"