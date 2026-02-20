FROM node:22-bookworm-slim

# Install flyctl
RUN apt-get update && apt-get install -y curl && \
    curl -L https://fly.io/install.sh | sh && \
    apt-get remove -y curl && apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*
ENV FLYCTL_INSTALL="/root/.fly"
ENV PATH="$FLYCTL_INSTALL/bin:$PATH"

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", ".next/standalone/server.js"]
