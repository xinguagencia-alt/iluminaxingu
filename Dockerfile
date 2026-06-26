FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci
COPY apps/api/tsconfig.json apps/api/tsconfig.json
COPY apps/api/src apps/api/src

FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci && npm install tsx
COPY --from=builder /app/apps/api/src ./apps/api/src
EXPOSE 3333
CMD ["npx", "tsx", "apps/api/src/server.ts"]
