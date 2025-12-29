# --- Build stage ---
FROM node:20 AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Copy only frontend package.json (improves caching)
COPY packages/frontend/package.json ./
RUN npm install

# --- FIX 1: Install 'sharp' for Next.js Image Optimization ---
RUN npm install sharp

# Copy monorepo (for local imports) then build
COPY . .
WORKDIR /app/packages/frontend
RUN npm run build

# --- Runtime stage ---
FROM node:20-slim
WORKDIR /app

# Copy the standalone output
COPY --from=builder /app/packages/frontend/.next/standalone ./
COPY --from=builder /app/packages/frontend/public ./public
COPY --from=builder /app/packages/frontend/.next/static ./.next/static

# --- FIX 2: Copy node_modules (which now includes 'next' and 'sharp') ---
COPY --from=builder /app/node_modules ./node_modules

ENV PORT=8080
EXPOSE 8080

# The server.js is at the root of the standalone folder
CMD ["node", "server.js"]