FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/pact/package*.json ./packages/pact/
RUN npm ci --workspace=apps/api --workspace=packages/shared \
  --workspace=packages/pact
COPY . .
RUN npm run build --workspace=packages/shared \
  --workspace=packages/pact --workspace=apps/api
EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]
