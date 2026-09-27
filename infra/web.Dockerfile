FROM node:22-bookworm-slim
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends docker.io && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile=false && pnpm --filter @roboforge/web build
CMD ["sh", "-c", "pnpm db:migrate && pnpm db:seed && pnpm start"]
