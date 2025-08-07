# Simple production Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better caching)
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --only=production

# Copy source
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]