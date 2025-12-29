# --- Build stage ---
FROM node:20 AS builder
WORKDIR /app

COPY packages/backend/auren-demo/package.json ./
RUN npm install
# copy monorepo (for local imports) then build
COPY . .
WORKDIR /app/packages/backend/auren-demo
RUN npm run build

# --- Runtime stage ---
FROM node:20-slim
WORKDIR /app

# copy the standalone build output
COPY --from=builder /app/packages/backend/auren-demo/.next/standalone ./
COPY --from=builder /app/packages/backend/auren-demo/public ./public
COPY --from=builder /app/packages/backend/auren-demo/.next/static ./.next/static

# Cloud Run will inject GOOGLE_APPLICATION_CREDENTIALS via attached SA (no key file needed)
ENV PORT=8080
EXPOSE 8080

CMD ["node", "packages/backend/auren-demo/server.js"]