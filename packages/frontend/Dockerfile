# --- Build stage ---
FROM node:20 AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# 1. Install Dependencies
# Copying just the specific package.json is good practice
COPY packages/frontend/package.json ./
RUN npm install

# 2. Install Sharp (Optional but good for images)
RUN npm install sharp

# 3. Build Project
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

# CRITICAL FIX 4: Copy Static Assets to the NESTED location
# The server is at /app/packages/frontend/server.js, so it expects assets relative to that path
COPY --from=builder /app/packages/frontend/public ./packages/frontend/public
COPY --from=builder /app/packages/frontend/.next/static ./packages/frontend/.next/static

# CRITICAL FIX 5: Launch the NESTED server file
CMD ["node", "packages/frontend/server.js"]