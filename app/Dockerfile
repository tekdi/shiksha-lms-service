# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont font-noto
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build


# Set default port (can be overridden via environment variable)
ENV PORT=4000
EXPOSE 4000

# Health check for Docker - checks if service and database are ready
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "const port = process.env.PORT || 4000; require('http').get('http://127.0.0.1:' + port + '/health/ready', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

# Start the application
CMD ["npm", "run", "start:dev"]
