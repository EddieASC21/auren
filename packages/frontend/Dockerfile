# --- Build stage ---
FROM node:20 AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# 1. Copy ALL package files for monorepo workspace resolution
COPY package.json package-lock.json ./
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/backend/auren-demo/package.json ./packages/backend/auren-demo/

# 2. Install Dependencies at root level (npm workspaces)
RUN npm install

# 3. Install Sharp (for image optimization)
RUN npm install sharp

# 4. Copy source and build
COPY . .
WORKDIR /app/packages/frontend
RUN npm run build

# --- Runtime stage ---
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
# CRITICAL FIX 1: Bind to 0.0.0.0 (Required for Cloud Run)
ENV HOSTNAME="0.0.0.0"
# CRITICAL FIX 2: Match the port to your gcloud command (3000)
ENV PORT=3000

# CRITICAL FIX 3: Copy Standalone Output
# This copies 'node_modules' AND 'packages/frontend/server.js' to /app
COPY --from=builder /app/packages/frontend/.next/standalone ./

# CRITICAL FIX: Ensure sharp is present (Next.js standalone trace often misses it if not in package.json)
# We copy it from the builder's node_modules to the runner's node_modules
COPY --from=builder /app/node_modules/sharp ./node_modules/sharp

# CRITICAL FIX 4: Copy Static Assets to the NESTED location
# The server is at /app/packages/frontend/server.js, so it expects assets relative to that path
COPY --from=builder /app/packages/frontend/public ./packages/frontend/public
COPY --from=builder /app/packages/frontend/.next/static ./packages/frontend/.next/static

# Launch the standalone server from the monorepo output
CMD ["node", "packages/frontend/server.js"]
