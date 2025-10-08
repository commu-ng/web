# Multi-stage Dockerfile for pnpm workspace
FROM node:24-slim AS base

WORKDIR /app

# Setup pnpm in single layer
RUN npm install --global corepack@latest && \
     corepack enable pnpm && \
     corepack use pnpm@latest-10

# Copy workspace files for dependency resolution
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
COPY console/package.json ./console/
COPY app/package.json ./app/
COPY api/package.json ./api/

# Install all dependencies (this layer will be cached unless package files change)
RUN pnpm install --frozen-lockfile

# Console build stage
FROM base AS console

# Console environment variables
ARG VITE_DOMAIN=commu.ng
ENV VITE_DOMAIN=$VITE_DOMAIN

ARG VITE_API_BASE_URL=https://api.commu.ng
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Copy console config files
COPY console/components.json \
     console/react-router.config.ts \
     console/tsconfig.json \
     console/vite.config.ts \
     ./console/

# Copy console static assets
COPY console/public/ ./console/public/

# Copy console source code
COPY console/app/ ./console/app/

# Build console
RUN cd console && pnpm run build

EXPOSE 3000
WORKDIR /app/console
CMD ["pnpm", "start"]

# App build stage
FROM base AS app

# App environment variables
ARG VITE_CONSOLE_URL=https://commu.ng
ENV VITE_CONSOLE_URL=$VITE_CONSOLE_URL

ARG VITE_API_BASE_URL=https://api.commu.ng
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Copy app config files
COPY app/components.json \
     app/react-router.config.ts \
     app/tsconfig.json \
     app/vite.config.ts \
     ./app/

# Copy app static assets
COPY app/public/ ./app/public/

# Copy app source code
COPY app/app/ ./app/app/

# Build app
RUN cd app && pnpm run build

EXPOSE 3000
WORKDIR /app/app
CMD ["pnpm", "start"]

# API build stage
FROM base AS api

# Copy API config files
COPY api/tsconfig.json \
     api/drizzle.config.ts \
     ./api/

# Copy API source code
COPY api/src/ ./api/src/

EXPOSE 3000
WORKDIR /app/api
CMD ["pnpm", "exec", "tsx", "src/index.ts"]