# Backend Dockerfile for Taskr Express API
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=4000

# Install dependencies first for efficient layer caching
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy application source
COPY src ./src
COPY scripts ./scripts

# Expose backend port
EXPOSE 4000

# Run API server
CMD ["node", "src/server.js"]
